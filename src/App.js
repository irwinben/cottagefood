// App.js (Cottage Meal Scheduler with compact chat and improved attendance display)
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
      const newPlan = { guests: [], schedule: {}, days: [], dailyMeals: {} };
      const updatedPlans = {
        ...allPlans,
        [newKey]: newPlan
      };
      setAllPlans(updatedPlans);
      setWeekendKey(newKey);
      loadPlan(newPlan);
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
      setLoading(false);
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

  useEffect(() => {
    if (initialized && weekendKey) {
      const updatedPlans = {
        ...allPlans,
        [weekendKey]: { guests, schedule, days, dailyMeals }
      };
      setAllPlans(updatedPlans);
      updateDoc(doc(db, "mealScheduler", "sharedPlan"), {
        [`weekends.${weekendKey}`]: { guests, schedule, days, dailyMeals }
      });
    }
  }, [guests, schedule, days, dailyMeals, weekendKey, initialized]);

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
    const attendees = guests.filter((g) => schedule[day]?.[meal]?.guests?.[g.name]);
    const adults = attendees.reduce((sum, g) => sum + (g.adults || 0), 0);
    const children = attendees.reduce((sum, g) => sum + (g.children || 0), 0);
    return `${adults} adult${adults !== 1 ? "s" : ""}, ${children} child${children !== 1 ? "ren" : ""}`;
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex" }}>
      <div style={{ flex: 1 }}>
        <h1>Cottage Meal Scheduler</h1>

        <WeekendSelector {...{ weekendKey, allPlans, setWeekendKey, createNewWeekend, loadPlan }} />
        <GuestEditor {...{ guests, setGuests, newGuest, setNewGuest, addGuest }} />
        <ScheduleEditor {...{ days, setDays }} />
        <DailyMealSelector {...{ days, dailyMeals, setDailyMeals, availableMeals }} />

        {days.map((day) => (
          <div key={day}>
            <h2>{day}</h2>
            {(dailyMeals[day] || []).map((meal) => (
              <div key={meal} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
                <h3>{meal}</h3>
                <p>{getAttendeeCounts(day, meal)}</p>
                <input
                  value={schedule[day]?.[meal]?.dish || ""}
                  onChange={(e) => updateDish(day, meal, e.target.value)}
                  placeholder="Dish"
                  style={{ width: "100%", marginBottom: 10 }}
                />
                {(schedule[day]?.[meal]?.ingredients || []).map((ing, i) => (
                  <div key={i} style={{ marginLeft: 20, display: "flex", gap: 10, marginBottom: 5 }}>
                    <input
                      value={ing.name}
                      onChange={(e) => updateIngredient(day, meal, i, "name", e.target.value)}
                      placeholder="Ingredient"
                      style={{ flex: 1 }}
                    />
                    <select
                      value={ing.person}
                      onChange={(e) => updateIngredient(day, meal, i, "person", e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Unassigned</option>
                      {guests.map((g) => (
                        <option key={g.name} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <button onClick={() => addIngredient(day, meal)}>Add Ingredient</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ width: 240, marginLeft: 20 }}>
        <h2 style={{ fontSize: "16px" }}>Chat</h2>
        <div style={{ border: "1px solid #ccc", padding: 10, height: 300, overflowY: "auto" }}>
          {chatMessages.map((msg, idx) => (
            <div key={idx}>{msg.message}</div>
          ))}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type a message"
          style={{ width: "100%", marginTop: 10 }}
        />
        <button onClick={sendMessage} style={{ width: "100%", marginTop: 5 }}>Send</button>
      </div>
    </div>
  );
}
