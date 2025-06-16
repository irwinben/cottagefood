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

  const generateGuestIngredientSummary = () => {
    const summary = {};
    for (const day of days) {
      for (const meal of availableMeals) {
        const ingredients = schedule[day]?.[meal]?.ingredients || [];
        for (const { name, person } of ingredients) {
          if (!name || !person) continue;
          if (!summary[person]) summary[person] = [];
          summary[person].push({ name, day, meal });
        }
      }
    }
    return Object.entries(summary)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([person, items]) => ({ person, items }));
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 10 }}>
      <h1>Cottage Meal Scheduler</h1>

      <WeekendSelector
        weekendKey={weekendKey}
        allPlans={allPlans}
        setWeekendKey={(key) => {
          setWeekendKey(key);
          if (allPlans[key]) loadPlan(allPlans[key]);
        }}
        createNewWeekend={createNewWeekend}
        loadPlan={loadPlan}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <GuestEditor guests={guests} setGuests={setGuests} newGuest={newGuest} setNewGuest={setNewGuest} addGuest={addGuest} />
          <ScheduleEditor days={days} setDays={setDays} />
          <DailyMealSelector days={days} dailyMeals={dailyMeals} setDailyMeals={setDailyMeals} availableMeals={availableMeals} />

          <h2>Meal Plan</h2>
          {days.map(day => (
            <div key={day}>
              <h3>{day}</h3>
              {(dailyMeals[day] || []).map(meal => (
                <div key={meal} style={{ marginBottom: 20 }}>
                  <h4>{meal}</h4>
                  <input
                    value={schedule[day]?.[meal]?.dish || ""}
                    onChange={(e) => updateDish(day, meal, e.target.value)}
                    placeholder="Dish name"
                    style={{ marginBottom: 10, width: "100%" }}
                  />

                  {(schedule[day]?.[meal]?.ingredients || []).map((ing, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                      <input
                        value={ing.name}
                        placeholder="Ingredient"
                        onChange={(e) => updateIngredient(day, meal, i, "name", e.target.value)}
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

          <h2>Guest Attendance</h2>
          <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%", marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Guest</th>
                {days.flatMap(day => (dailyMeals[day] || []).map(meal => (
                  <th key={`${day}-${meal}`}>{day} {meal}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {guests.map(guest => (
                <tr key={guest.name}>
                  <td>{guest.name}</td>
                  {days.flatMap(day => (dailyMeals[day] || []).map(meal => (
                    <td key={`${guest.name}-${day}-${meal}`} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={schedule[day]?.[meal]?.guests?.[guest.name] || false}
                        onChange={() => toggleGuestPresence(guest.name, day, meal)}
                      />
                    </td>
                  )))}
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: 40 }}>Ingredient Summary</h2>
          {generateGuestIngredientSummary().map(({ person, items }) => (
            <div key={person} style={{ marginBottom: 15 }}>
              <strong>{person}</strong>
              <ul style={{ marginLeft: 20 }}>
                {items.map((item, idx) => (
                  <li key={idx}>{item.name} ({item.day} – {item.meal})</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 280, borderLeft: "1px solid #ccc", paddingLeft: 10 }}>
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
        </div>
      </div>
    </div>
  );
}
