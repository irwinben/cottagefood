// App.js — Full Updated Version with "4th Meal", Chat, Exports, and Ingredient Summary
import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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
  const availableMeals = ["Breakfast", "Lunch", "Dinner", "4th Meal"];
  const [dailyMeals, setDailyMeals] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSender, setChatSender] = useState("");

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

  // FIX: addGuest was referenced but never defined
  const addGuest = () => {
    if (!newGuest.trim()) return;
    setGuests((prev) => [...prev, { name: newGuest.trim(), adults: 1, children: 0 }]);
    setNewGuest("");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
      const docRef = doc(db, "mealScheduler", "sharedPlan");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Support both old flat structure and new weekends-wrapped structure
        if (data.weekends) {
          // New structure: { weekends: { "Weekend Name": { days, guests, schedule, dailyMeals } } }
          const plans = data.weekends;
          const firstKey = Object.keys(plans)[0] || "First Weekend";
          setAllPlans(plans);
          setWeekendKey(firstKey);
          loadPlan(plans[firstKey]);
        } else {
          // Old flat structure: { days, guests, schedule, meals }
          // Wrap it into the new structure under a default weekend name
          const weekendName = "Memorial Day Weekend";
          const plan = {
            days: data.days || [],
            guests: data.guests || [],
            schedule: data.schedule || {},
            dailyMeals: data.dailyMeals || {}
          };
          const plans = { [weekendName]: plan };
          setAllPlans(plans);
          setWeekendKey(weekendName);
          loadPlan(plan);
        }
      } else {
          alert("No plan found in Firebase. The document does not exist yet.");
        }
      } catch (err) {
        alert("Failed to load plan: " + err.message);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!weekendKey) return;
    // Use a sanitized key (no spaces) to avoid Firestore collection name issues
    const safeKey = weekendKey.replace(/\s+/g, "_");
    const q = query(collection(db, `chat_${safeKey}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) =>
      setChatMessages(snapshot.docs.map((doc) => doc.data()))
    );
    return () => unsubscribe();
  }, [weekendKey]);

  const sendMessage = async () => {
    if (chatInput.trim() === "") return;
    try {
      const safeKey = weekendKey.replace(/\s+/g, "_");
      await addDoc(collection(db, `chat_${safeKey}`), {
        message: chatInput,
        sender: chatSender.trim() || "Anonymous",
        timestamp: new Date()
      });
      setChatInput("");
    } catch (err) {
      alert("Chat failed to send: " + err.message);
    }
  };

  // FIX: Add save function — persists current plan to Firestore
  const savePlan = async () => {
    try {
      const updatedPlans = {
        ...allPlans,
        [weekendKey]: { guests, schedule, days, dailyMeals }
      };
      const docRef = doc(db, "mealScheduler", "sharedPlan");
      // Use setDoc with merge:true so it works whether the document exists or not
      await setDoc(docRef, { weekends: updatedPlans }, { merge: true });
      setAllPlans(updatedPlans);
      alert("Plan saved!");
    } catch (err) {
      alert("Save failed: " + err.message);
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

  const removeIngredient = (day, meal, index) => {
    const updated = (schedule[day]?.[meal]?.ingredients || []).filter((_, i) => i !== index);
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day]?.[meal],
          ingredients: updated
        }
      }
    }));
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

  const thStyle = {
    border: "1px solid #ccc",
    padding: "6px 12px",
    backgroundColor: "#f0f0f0",
    textAlign: "center"
  };

  const tdStyle = {
    border: "1px solid #ccc",
    padding: "6px 12px"
  };

  return (
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex" }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <h1>Cottage Meal Scheduler</h1>

        {/* FIX: pass loadPlan to WeekendSelector so switching weekends works */}
        <WeekendSelector
          weekendKey={weekendKey}
          setWeekendKey={setWeekendKey}
          allPlans={allPlans}
          createNewWeekend={createNewWeekend}
          loadPlan={loadPlan}
        />

        {/* FIX: addGuest is now defined above and passed correctly */}
        <GuestEditor
          guests={guests}
          setGuests={setGuests}
          newGuest={newGuest}
          setNewGuest={setNewGuest}
          addGuest={addGuest}
        />

        {/* FIX: ScheduleEditor was imported but unused — wired in here */}
        <ScheduleEditor days={days} setDays={setDays} />

        <DailyMealSelector
          days={days}
          dailyMeals={dailyMeals}
          setDailyMeals={setDailyMeals}
          availableMeals={availableMeals}
        />

        {days.map(day => {
          const mealsForDay = dailyMeals[day] || [];
          return (
            <div key={day} style={{ marginTop: 20, borderTop: "1px solid #ddd", paddingTop: 10 }}>
              <h2>{day}</h2>

              {/* Dish name inputs — one per meal */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                {mealsForDay.map(meal => (
                  <div key={meal}>
                    <label>
                      <strong>{meal} — Dish: </strong>
                      <input
                        value={schedule[day]?.[meal]?.dish || ""}
                        onChange={(e) => updateDish(day, meal, e.target.value)}
                        placeholder="e.g. Pancakes"
                        style={{ marginLeft: 6, width: 180 }}
                      />
                    </label>
                  </div>
                ))}
              </div>

              {/* Attendance table: guests as rows, meals as columns */}
              {guests.length > 0 && mealsForDay.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <strong>Attendance:</strong>
                  <table style={{ borderCollapse: "collapse", marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Guest</th>
                        {mealsForDay.map(meal => (
                          <th key={meal} style={thStyle}>{meal}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guests.map((g) => (
                        <tr key={g.name}>
                          <td style={tdStyle}>{g.name}</td>
                          {mealsForDay.map(meal => (
                            <td key={meal} style={{ ...tdStyle, textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={schedule[day]?.[meal]?.guests?.[g.name] || false}
                                onChange={() => toggleGuestPresence(g.name, day, meal)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr style={{ borderTop: "2px solid #999", fontStyle: "italic", color: "#555" }}>
                        <td style={tdStyle}>Attending</td>
                        {mealsForDay.map(meal => {
                          const attending = guests.filter(g => schedule[day]?.[meal]?.guests?.[g.name]);
                          const adults = attending.reduce((sum, g) => sum + (g.adults || 0), 0);
                          const children = attending.reduce((sum, g) => sum + (g.children || 0), 0);
                          return (
                            <td key={meal} style={{ ...tdStyle, fontSize: "0.85em" }}>
                              {adults}A {children}C
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ingredients editor — one section per meal */}
              {mealsForDay.map(meal => (
                <div key={meal} style={{ marginBottom: 16, paddingLeft: 10 }}>
                  <strong>{meal} — Ingredients:</strong>
                  {(schedule[day]?.[meal]?.ingredients || []).map((ing, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                      <input
                        value={ing.name}
                        onChange={(e) => updateIngredient(day, meal, idx, "name", e.target.value)}
                        placeholder="Ingredient"
                        style={{ width: 180 }}
                      />
                      <select
                        value={ing.person}
                        onChange={(e) => updateIngredient(day, meal, idx, "person", e.target.value)}
                      >
                        <option value="">-- Who brings it? --</option>
                        {guests.map((g) => (
                          <option key={g.name} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                      <button onClick={() => removeIngredient(day, meal, idx)}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addIngredient(day, meal)} style={{ marginTop: 6 }}>
                    + Add Ingredient
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {/* FIX: Save button — persists plan to Firestore */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={savePlan}
            style={{ backgroundColor: "#2c3e50", color: "white", padding: "8px 16px", fontSize: "1em" }}
          >
            Save Plan
          </button>
        </div>

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

        {/* Chat message display */}
        <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #ccc", padding: 5, marginBottom: 10 }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: "bold", color: "#2c3e50" }}>
                {msg.sender || "Anonymous"}:
              </span>{" "}
              {msg.message}
              <div style={{ fontSize: "0.75em", color: "#999" }}>
                {msg.timestamp?.toDate
                  ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Your name input — only need to type once */}
        <input
          value={chatSender}
          onChange={(e) => setChatSender(e.target.value)}
          placeholder="Your name"
          style={{ width: "100%", marginBottom: 6 }}
        />

        {/* Message input */}
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message"
          style={{ width: "100%", marginBottom: 6 }}
        />
        <button onClick={sendMessage} style={{ width: "100%" }}>Send</button>
      </div>
    </div>
  );
}
