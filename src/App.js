// App.js — Full Updated Version with Admin Mode
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

// Change this to whatever password you want
const ADMIN_PASSWORD = "cottage2025";

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

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);

  // ─── Admin login/logout ───────────────────────────────────────────
  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      const entered = prompt("Enter admin password:");
      if (entered === ADMIN_PASSWORD) {
        setIsAdmin(true);
      } else if (entered !== null) {
        alert("Incorrect password.");
      }
    }
  };

  // ─── Load plan ────────────────────────────────────────────────────
  const loadPlan = (plan) => {
    const loadedGuests = (plan.guests || []).map((g) =>
      typeof g === "string" ? { name: g, adults: 0, children: 0 } : g
    );
    setGuests(loadedGuests);
    setSchedule(plan.schedule || {});
    setDays(plan.days || []);
    setDailyMeals(plan.dailyMeals || {});
  };

  // ─── Save all plans to Firebase ───────────────────────────────────
  const saveAllPlans = async (updatedPlans) => {
    const docRef = doc(db, "mealScheduler", "sharedPlan");
    await setDoc(docRef, { weekends: updatedPlans }, { merge: true });
    setAllPlans(updatedPlans);
  };

  // ─── Create new weekend (admin only) ─────────────────────────────
  const createNewWeekend = () => {
    const newKey = prompt("Enter a name for the new weekend:", "New Weekend");
    if (newKey && !allPlans[newKey]) {
      const updatedPlans = {
        ...allPlans,
        [newKey]: { guests: [], schedule: {}, days: [], dailyMeals: {}, hidden: false }
      };
      setAllPlans(updatedPlans);
      setWeekendKey(newKey);
      loadPlan(updatedPlans[newKey]);
    } else if (newKey && allPlans[newKey]) {
      alert("That weekend name already exists.");
    }
  };

  // ─── Rename weekend (admin only) ─────────────────────────────────
  const renameWeekend = async () => {
    const newName = prompt("Enter new name for this weekend:", weekendKey);
    if (!newName || newName === weekendKey) return;
    if (allPlans[newName]) {
      alert("A weekend with that name already exists.");
      return;
    }
    try {
      const currentPlan = allPlans[weekendKey];
      const updatedPlans = { ...allPlans };
      updatedPlans[newName] = currentPlan;
      delete updatedPlans[weekendKey];
      await saveAllPlans(updatedPlans);
      setWeekendKey(newName);
      alert(`Renamed to "${newName}"`);
    } catch (err) {
      alert("Rename failed: " + err.message);
    }
  };

  // ─── Delete weekend (admin only) ─────────────────────────────────
  const deleteWeekend = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete "${weekendKey}"? This cannot be undone.`)) return;
    try {
      const updatedPlans = { ...allPlans };
      delete updatedPlans[weekendKey];
      await saveAllPlans(updatedPlans);
      const remaining = Object.keys(updatedPlans);
      if (remaining.length > 0) {
        setWeekendKey(remaining[0]);
        loadPlan(updatedPlans[remaining[0]]);
      } else {
        setWeekendKey("");
        loadPlan({ guests: [], schedule: {}, days: [], dailyMeals: {} });
      }
      alert("Weekend deleted.");
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // ─── Toggle hide/show weekend (admin only) ────────────────────────
  const toggleHideWeekend = async () => {
    const currentlyHidden = allPlans[weekendKey]?.hidden || false;
    const action = currentlyHidden ? "unhide" : "hide";
    if (!window.confirm(`${action === "hide" ? "Hide" : "Show"} "${weekendKey}" from regular users?`)) return;
    try {
      const updatedPlans = {
        ...allPlans,
        [weekendKey]: { ...allPlans[weekendKey], hidden: !currentlyHidden }
      };
      await saveAllPlans(updatedPlans);
      alert(`"${weekendKey}" is now ${!currentlyHidden ? "hidden" : "visible"}.`);
    } catch (err) {
      alert("Failed: " + err.message);
    }
  };

  // ─── Add guest ────────────────────────────────────────────────────
  const addGuest = () => {
    if (!newGuest.trim()) return;
    setGuests((prev) => [...prev, { name: newGuest.trim(), adults: 1, children: 0 }]);
    setNewGuest("");
  };

  // ─── Fetch data on load ───────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const docRef = doc(db, "mealScheduler", "sharedPlan");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.weekends) {
            const plans = data.weekends;
            // For regular users, skip hidden weekends when picking the first one to show
            const visibleKeys = Object.keys(plans).filter(k => !plans[k]?.hidden);
            const firstKey = visibleKeys[0] || Object.keys(plans)[0] || "First Weekend";
            setAllPlans(plans);
            setWeekendKey(firstKey);
            loadPlan(plans[firstKey]);
          } else {
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

  // ─── Chat listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!weekendKey) return;
    const safeKey = weekendKey.replace(/\s+/g, "_");
    const q = query(collection(db, `chat_${safeKey}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) =>
      setChatMessages(snapshot.docs.map((doc) => doc.data()))
    );
    return () => unsubscribe();
  }, [weekendKey]);

  // ─── Send chat message ────────────────────────────────────────────
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

  // ─── Save plan ────────────────────────────────────────────────────
  const savePlan = async () => {
    try {
      const updatedPlans = {
        ...allPlans,
        [weekendKey]: {
          ...allPlans[weekendKey],
          guests,
          schedule,
          days,
          dailyMeals
        }
      };
      await saveAllPlans(updatedPlans);
      alert("Plan saved!");
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  };

  // ─── Schedule helpers ─────────────────────────────────────────────
  const toggleGuestPresence = (guest, day, meal) => {
    setSchedule((prev) => {
      const current = prev[day]?.[meal]?.guests?.[guest] || false;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          [meal]: {
            ...prev[day]?.[meal],
            guests: { ...prev[day]?.[meal]?.guests, [guest]: !current }
          }
        }
      };
    });
  };

  const updateDish = (day, meal, dish) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: { ...prev[day]?.[meal], dish } }
    }));
  };

  const addIngredient = (day, meal) => {
    const newIngredients = [
      ...(schedule[day]?.[meal]?.ingredients || []),
      { name: "", person: "" }
    ];
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: { ...prev[day]?.[meal], ingredients: newIngredients } }
    }));
  };

  const updateIngredient = (day, meal, index, field, value) => {
    const updated = [...(schedule[day][meal]?.ingredients || [])];
    updated[index][field] = value;
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: { ...prev[day][meal], ingredients: updated } }
    }));
  };

  const removeIngredient = (day, meal, index) => {
    const updated = (schedule[day]?.[meal]?.ingredients || []).filter((_, i) => i !== index);
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: { ...prev[day]?.[meal], ingredients: updated } }
    }));
  };

  // ─── Summary / export helpers ─────────────────────────────────────
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
  };

  const exportPDF = () => {
    const docPDF = new jsPDF();
    docPDF.setFontSize(16);
    docPDF.text("Cottage Meal Plan — What Each Guest is Bringing", 14, 16);

    // Build a map of person -> list of { day, meal, dish, ingredient }
    const byGuest = {};
    for (const day of days) {
      for (const meal of dailyMeals[day] || []) {
        const dish = schedule[day]?.[meal]?.dish || "";
        for (const item of schedule[day]?.[meal]?.ingredients || []) {
          if (!item.person || !item.name) continue;
          if (!byGuest[item.person]) byGuest[item.person] = [];
          byGuest[item.person].push({ day, meal, dish, ingredient: item.name });
        }
      }
    }

    const sortedGuests = Object.keys(byGuest).sort();

    let currentY = 26;

    for (const person of sortedGuests) {
      const items = byGuest[person];

      // Guest name as a section header
      docPDF.setFontSize(13);
      docPDF.setTextColor(44, 62, 80); // dark blue-grey
      docPDF.text(person, 14, currentY);
      currentY += 2;

      // Table of their items
      docPDF.autoTable({
        head: [["Day", "Meal", "Dish", "Ingredient"]],
        body: items.map(i => [i.day, i.meal, i.dish, i.ingredient]),
        startY: currentY,
        margin: { left: 14 },
        styles: { fontSize: 10 },
        headStyles: { fillColor: [189, 195, 199] }, // light grey header
        didDrawPage: () => {
          // Reset text color after page break
          docPDF.setTextColor(44, 62, 80);
        }
      });

      currentY = docPDF.lastAutoTable.finalY + 10;

      // If we're close to the bottom of the page, add a new page
      if (currentY > 260 && sortedGuests.indexOf(person) < sortedGuests.length - 1) {
        docPDF.addPage();
        currentY = 20;
      }
    }

    // If no ingredients were assigned to anyone
    if (sortedGuests.length === 0) {
      docPDF.setFontSize(11);
      docPDF.setTextColor(100);
      docPDF.text("No ingredients have been assigned to guests yet.", 14, 30);
    }

    docPDF.save("meal-plan-by-guest.pdf");
  };

  // ─── Styles ───────────────────────────────────────────────────────
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

  const adminBtnStyle = {
    padding: "6px 12px",
    marginRight: 8,
    cursor: "pointer",
    backgroundColor: "#fff",
    border: "1px solid #999",
    borderRadius: 4
  };

  // Weekends visible to regular users (non-hidden only)
  const visiblePlans = isAdmin
    ? allPlans
    : Object.fromEntries(Object.entries(allPlans).filter(([, v]) => !v?.hidden));

  const isCurrentWeekendHidden = allPlans[weekendKey]?.hidden || false;

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex" }}>
      <div style={{ flex: 1, paddingRight: 20 }}>

        {/* Header row with title and lock icon */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h1 style={{ margin: 0 }}>Cottage Meal Planner</h1>
          <button
            onClick={handleAdminToggle}
            title={isAdmin ? "Exit admin mode" : "Admin login"}
            style={{ fontSize: "1.4em", background: "none", border: "none", cursor: "pointer" }}
          >
            {isAdmin ? "🔓" : "🔒"}
          </button>
        </div>

        {/* Admin toolbar — only visible when logged in as admin */}
        {isAdmin && (
          <div style={{
            backgroundColor: "#fef9e7",
            border: "1px solid #f0c040",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8
          }}>
            <strong style={{ marginRight: 8 }}>⚙️ Admin:</strong>

            <button style={adminBtnStyle} onClick={createNewWeekend}>
              ➕ New Weekend
            </button>

            <button style={adminBtnStyle} onClick={renameWeekend}>
              ✏️ Rename "{weekendKey}"
            </button>

            <button style={adminBtnStyle} onClick={toggleHideWeekend}>
              {isCurrentWeekendHidden ? "👁 Show Weekend" : "🙈 Hide Weekend"}
            </button>

            <button
              style={{ ...adminBtnStyle, color: "red", borderColor: "red" }}
              onClick={deleteWeekend}
            >
              🗑 Delete Weekend
            </button>

            {isCurrentWeekendHidden && (
              <span style={{ color: "#c0392b", fontStyle: "italic", fontSize: "0.9em" }}>
                ⚠️ This weekend is currently hidden from regular users
              </span>
            )}
          </div>
        )}

        {/* Weekend selector — shows all weekends to admin, only visible ones to others */}
        <WeekendSelector
          weekendKey={weekendKey}
          setWeekendKey={setWeekendKey}
          allPlans={visiblePlans}
          createNewWeekend={isAdmin ? createNewWeekend : null}
          loadPlan={loadPlan}
        />

        <GuestEditor
          guests={guests}
          setGuests={setGuests}
          newGuest={newGuest}
          setNewGuest={setNewGuest}
          addGuest={addGuest}
        />

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

              {/* Dish name inputs */}
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

              {/* Attendance table */}
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

              {/* Ingredients editor */}
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

      {/* Chat sidebar */}
      <div style={{ width: 240, borderLeft: "1px solid #ccc", paddingLeft: 10 }}>
        <h3>Chat</h3>
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
        <input
          value={chatSender}
          onChange={(e) => setChatSender(e.target.value)}
          placeholder="Your name"
          style={{ width: "100%", marginBottom: 6 }}
        />
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
