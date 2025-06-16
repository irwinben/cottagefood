// CottageMealScheduler_Cleaned.js
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
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [pdfPreview, setPdfPreview] = useState("");

  const loadPlan = (plan) => {
    const loadedGuests = (plan.guests || []).map((g) =>
      typeof g === "string" ? { name: g, adults: 0, children: 0 } : g
    );
    setGuests(loadedGuests);
    setSchedule(plan.schedule || {});
    setDays(plan.days || []);
    setDailyMeals(plan.dailyMeals || {});
    setInitialized(true);
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
      setGuests([]);
      setSchedule({});
      setDays([]);
      setDailyMeals({});
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
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (weekendKey && allPlans[weekendKey]) {
      loadPlan(allPlans[weekendKey]);
    }
  }, [weekendKey, allPlans]);

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

  const addGuest = () => {
    const name = newGuest.trim();
    if (name && !guests.some((g) => g.name === name)) {
      setGuests([...guests, { name, adults: 0, children: 0 }]);
      setNewGuest("");
    }
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

  const generatePDFHTML = () => {
    const data = [];
    for (const day of days) {
      for (const meal of dailyMeals[day] || []) {
        const dish = schedule[day]?.[meal]?.dish || "";
        for (const item of schedule[day]?.[meal]?.ingredients || []) {
          data.push(`<tr><td>${day}</td><td>${meal}</td><td>${dish}</td><td>${item.name}</td><td>${item.person}</td></tr>`);
        }
      }
    }
    return `
      <h2>PDF Preview Table</h2>
      <table border="1" cellpadding="5" style="border-collapse: collapse;">
        <thead><tr><th>Day</th><th>Meal</th><th>Dish</th><th>Ingredient</th><th>Person</th></tr></thead>
        <tbody>${data.join("\n")}</tbody>
      </table>`;
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 20 }}>
      <h1>Cottage Meal Scheduler</h1>

      <WeekendSelector
        weekendKey={weekendKey}
        allPlans={allPlans}
        setWeekendKey={setWeekendKey}
        createNewWeekend={createNewWeekend}
        loadPlan={loadPlan}
      />

      <GuestEditor
        guests={guests}
        setGuests={setGuests}
        newGuest={newGuest}
        setNewGuest={setNewGuest}
        addGuest={addGuest}
      />

      <ScheduleEditor
        days={days}
        setDays={setDays}
      />

      <DailyMealSelector
        days={days}
        dailyMeals={dailyMeals}
        setDailyMeals={setDailyMeals}
        availableMeals={availableMeals}
      />

      <h2>Chat</h2>
      <div style={{ border: "1px solid #ccc", padding: 10, maxHeight: 300, overflowY: "auto", marginBottom: 10 }}>
        {chatMessages.map((msg, i) => (
          <div key={i}>{msg.message}</div>
        ))}
      </div>
      <input
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        placeholder="Type a message"
        style={{ width: "100%", marginBottom: 10 }}
      />
      <button onClick={sendMessage}>Send</button>

      <h2>Export</h2>
      <button onClick={() => {
        const header = ["Day", "Meal", "Dish", "Ingredient", "Person"];
        const rows = [];
        for (const day of days) {
          for (const meal of dailyMeals[day] || []) {
            const dish = schedule[day]?.[meal]?.dish || "";
            for (const item of schedule[day]?.[meal]?.ingredients || []) {
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
      }}>Download CSV</button>

      <button style={{ marginLeft: 10 }} onClick={() => {
        const docPDF = new jsPDF();
        docPDF.text("Cottage Meal Plan", 14, 16);
        const data = [];
        for (const day of days) {
          for (const meal of dailyMeals[day] || []) {
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
        setPdfPreview(generatePDFHTML());
      }}>Download PDF</button>

      {/* Render preview of PDF content as HTML */}
      <div dangerouslySetInnerHTML={{ __html: pdfPreview }} style={{ marginTop: 30 }} />
    </div>
  );
}
