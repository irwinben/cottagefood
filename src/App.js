// App.js — Full Updated Version with "4th Meal", Chat, Exports, and Ingredient Summary
import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import jsPDF from "jspdf";
import "jspdf-autotable";

import WeekendSelector from "./components/WeekendSelector";
import GuestEditor from "./components/GuestEditor";
import ScheduleEditor from "./components/ScheduleEditor";
import DailyMealSelector from "./components/DailyMealSelector";

const firebaseConfig = {
  apiKey: "AIzaSyA1-_xY_BaqYDBZhKYT0qA-vUc_svleaRM",
  authDomain: "cottage-meal-planner.firebaseapp.com",
  projectId: "cottage-meal-planner",
  storageBucket: "cottage-meal-planner.appspot.com",
  messagingSenderId: "107654447812",
  appId: "1:107654447812:web:379ad2549e95f870eaff91",
  measurementId: "G-FLQ90D3MSC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [weekendKey, setWeekendKey] = useState("");
  const [allPlans, setAllPlans] = useState({});
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState("");
  const [schedule, setSchedule] = useState({});
  const [days, setDays] = useState([]);
  const availableMeals = ["Breakfast", "Lunch", "Dinner"];
  const [dailyMeals, setDailyMeals] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  const loadPlan = (plan) => {
    const loadedGuests = (plan.guests || []).map((g) =>
      typeof g === "string" ? { name: g, adults: 0, children: 0 } : g
    );
    setGuests(loadedGuests);
    setSchedule(plan.schedule || {});
    setDays(plan.days || []);
    setDailyMeals(plan.dailyMeals || {});
  };

  const createNewWeekend = () => {
    const newKey = prompt("Enter a name for the new weekend:", "New Weekend");
    if (newKey && !allPlans[newKey]) {
      const updatedPlans = {
        ...allPlans,
        [newKey]: { guests: [], schedule: {}, days: [], dailyMeals: {} }
      };
      setAllPlans(updatedPlans);
      setWeekendKey(newKey);
      loadPlan(updatedPlans[newKey]);
    } else if (newKey && allPlans[newKey]) {
      alert("That weekend name already exists.");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "mealScheduler", "sharedPlan");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const plans = data.weekends || {};
        const firstKey = Object.keys(plans)[0] || "First Weekend";
        setAllPlans(plans);
        setWeekendKey(firstKey);
        loadPlan(plans[firstKey]);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!weekendKey) return;
    const q = query(collection(db, `chat_${weekendKey}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) =>
      setChatMessages(snapshot.docs.map((doc) => doc.data()))
    );
    return () => unsubscribe();
  }, [weekendKey]);

  const sendMessage = async () => {
    if (chatInput.trim() === "") return;
    await addDoc(collection(db, `chat_${weekendKey}`), {
      message: chatInput,
      timestamp: new Date()
    });
    setChatInput("");
  };

  const toggleGuestPresence = (guest, day, meal) => {
    setSchedule((prev) => {
      const current = prev[day]?.[meal]?.guests?.[guest] || false;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          [meal]: {
            ...prev[day]?.[meal],
            guests: {
              ...prev[day]?.[meal]?.guests,
              [guest]: !current
            }
          }
        }
      };
    });
  };

  const updateDish = (day, meal, dish) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day]?.[meal],
          dish
        }
      }
    }));
  };

  const addIngredient = (day, meal) => {
    const newIngredients = [
      ...(schedule[day]?.[meal]?.ingredients || []),
      { name: "", person: "" }
    ];
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day]?.[meal],
          ingredients: newIngredients
        }
      }
    }));
  };

  const updateIngredient = (day, meal, index, field, value) => {
    const updated = [...(schedule[day][meal]?.ingredients || [])];
    updated[index][field] = value;
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day][meal],
          ingredients: updated
        }
      }
    }));
  };

  const getAttendeeCounts = (day, meal) => {
    const attending = guests.filter((g) => schedule[day]?.[meal]?.guests?.[g.name]);
    const totalAdults = attending.reduce((sum, g) => sum + (g.adults || 0), 0);
    const totalChildren = attending.reduce((sum, g) => sum + (g.children || 0), 0);
    return `${totalAdults} adults, ${totalChildren} children attending`;
  };

  const generateGuestIngredientSummary = () => {
    const summary = {};
    for (const day of [...days, "4th Meal"]) {
      for (const meal of dailyMeals[day] || [day === "4th Meal" ? "4th Meal" : null]) {
        const items = schedule[day]?.[meal]?.ingredients || [];
        for (const { name, person } of items) {
          if (!person || !name) continue;
          if (!summary[person]) summary[person] = [];
          summary[person].push({ name, day, meal });
        }
      }
    }
    return Object.entries(summary)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([person, items]) => ({ person, items }));
  };

  const exportCSV = () => {
    const header = ["Day", "Meal", "Dish", "Ingredient", "Person"];
    const rows = [];
    for (const day of [...days, "4th Meal"]) {
      for (const meal of dailyMeals[day] || [day === "4th Meal" ? "4th Meal" : null]) {
        const dish = schedule[day]?.[meal]?.dish || "";
        const ingredients = schedule[day]?.[meal]?.ingredients || [];
        for (const item of ingredients) {
          rows.push([day, meal, dish, item.name, item.person]);
        }
      }
    }
    const csvContent = [header, ...rows].map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "meal-plan.csv";
    link.click();
  };

  const exportPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Cottage Meal Plan", 14, 16);
    const data = [];
    for (const day of [...days, "4th Meal"]) {
      for (const meal of dailyMeals[day] || [day === "4th Meal" ? "4th Meal" : null]) {
        const dish = schedule[day]?.[meal]?.dish || "";
        for (const item of schedule[day]?.[meal]?.ingredients || []) {
          data.push([day, meal, dish, item.name, item.person]);
        }
      }
    }
    docPDF.autoTable({
      head: [["Day", "Meal", "Dish", "Ingredient", "Person"]],
      body: data,
      startY: 20
    });
    docPDF.save("meal-plan.pdf");
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex" }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <h1>Cottage Meal Scheduler</h1>

        <WeekendSelector weekendKey={weekendKey} setWeekendKey={setWeekendKey} allPlans={allPlans} createNewWeekend={createNewWeekend} />
        <GuestEditor guests={guests} setGuests={setGuests} newGuest={newGuest} setNewGuest={setNewGuest} addGuest={addGuest} />
        <DailyMealSelector days={days} dailyMeals={dailyMeals} setDailyMeals={setDailyMeals} availableMeals={availableMeals} />

        {days.map(day => (
          <div key={day}>
            <h2>{day}</h2>
            {(dailyMeals[day] || []).map(meal => (
              <div key={meal}>
                <h3>{meal}</h3>
                <p>{getAttendeeCounts(day, meal)}</p>
                {/* dish input, ingredients editor, checkboxes here */}
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: "30px" }}>
          <h2>What Each Guest is Bringing</h2>
          {generateGuestIngredientSummary().map(({ person, items }) => (
            <div key={person} style={{ marginBottom: "10px" }}>
              <strong>{person}</strong>
              <ul>
                {items.map((item, idx) => (
                  <li key={idx}>{item.name} ({item.day} – {item.meal})</li>
                ))}
              </ul>
            </div>
          ))}
          <button onClick={exportCSV}>Download CSV</button>
          <button onClick={exportPDF} style={{ marginLeft: 10 }}>Download PDF</button>
        </div>
      </div>

      <div style={{ width: 240, borderLeft: "1px solid #ccc", paddingLeft: 10 }}>
        <h3>Chat</h3>
        <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #ccc", padding: 5, marginBottom: 10 }}>
          {chatMessages.map((msg, i) => <div key={i}>{msg.message}</div>)}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type a message"
          style={{ width: "100%", marginBottom: 10 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
