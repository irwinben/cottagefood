import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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
  const [dailyMeals, setDailyMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [initialized, setInitialized] = useState(false);

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

    const q = query(
  collection(db, `chat_${weekendKey}`),
  orderBy("timestamp", "asc")
);

    const unsubscribe = onSnapshot(q, (snapshot) =>
      setChatMessages(snapshot.docs.map((doc) => doc.data()))
    );
    return () => unsubscribe();
  }, []);

  const loadPlan = (plan) => {
    const loadedGuests = (plan.guests || []).map((g) =>
      typeof g === "string" ? { name: g, adults: 0, children: 0 } : g
    );
    setGuests(loadedGuests);
    setSchedule(plan.schedule || {});
    setDays(plan.days || []);
    setDailyMeals(plan.dailyMeals || []);
    setInitialized(true);
  };

  useEffect(() => {
  if (initialized && weekendKey) {
    const updatedPlans = {
      ...allPlans,
      [weekendKey]: { guests, schedule, days, dailyMeals }
    };
    setAllPlans(updatedPlans);

    updateDoc(doc(db, "mealScheduler", "sharedPlan"), {
  [`weekends.${weekendKey}`]: { guests, schedule, days, meals }
});
    
  }
}, [guests, schedule, days, meals, weekendKey, initialized]);
  
   const createNewWeekend = () => {
    const newKey = prompt("Enter a name for the new weekend:", "New Weekend");
    if (newKey && !allPlans[newKey]) {
      const updatedPlans = {
        ...allPlans,
        [newKey]: { guests: [], schedule: {}, days: [], meals: [] }
      };
      setAllPlans(updatedPlans);
      setWeekendKey(newKey);
      setGuests([]);
      setSchedule({});
      setDays([]);
      setMeals([]);
    } else if (newKey && allPlans[newKey]) {
      alert("That weekend name already exists.");
    }
  };

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
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 3, marginRight: 20 }}>
         
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
  meals={meals}
  setMeals={setMeals}
/>

<DailyMealSelector
  days={days}
  dailyMeals={dailyMeals}
  setDailyMeals={setDailyMeals}
/>

          {/* Unified attendance table */}
          <h2>Guest Attendance</h2>
          <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%", marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Guest</th>
                {days.map(day =>
                  meals.map(meal => (
                    <th key={`${day}-${meal}`}>{day} {meal}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {guests.map(guest => (
                <tr key={guest.name}>
                  <td>{guest.name}</td>
                  {days.map(day =>
                    meals.map(meal => (
                      <td key={`${guest.name}-${day}-${meal}`} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={schedule[day]?.[meal]?.guests?.[guest.name] || false}
                          onChange={() => toggleGuestPresence(guest.name, day, meal)}
                        />
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Meal Plan</h2>
{days.map(day => (
  <div key={day}>
    <h3 style={{ fontSize: "1.5em", marginBottom: "10px" }}>{day}</h3>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
      {meals.map(meal => (
        <div
          key={meal}
          style={{
            flex: "1 1 300px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "15px",
            backgroundColor: "#fdfdfd",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}
        >
          <h4 style={{ fontWeight: "bold", fontSize: "1.2em", marginBottom: 5 }}>{meal}</h4>
          <p style={{ fontStyle: "italic", marginBottom: "10px" }}>
            {(() => {
              const attending = guests.filter(g => schedule[day]?.[meal]?.guests?.[g.name]);
              const totalAdults = attending.reduce((sum, g) => sum + (g.adults || 0), 0);
              const totalChildren = attending.reduce((sum, g) => sum + (g.children || 0), 0);
              return `${totalAdults} adult${totalAdults !== 1 ? "s" : ""}, ${totalChildren} child${totalChildren !== 1 ? "ren" : ""} attending`;
            })()}
          </p>

          <input
            value={schedule[day]?.[meal]?.dish || ""}
            onChange={(e) => updateDish(day, meal, e.target.value)}
            placeholder="Dish name"
            style={{
              width: "100%",
              marginBottom: "10px",
              padding: "8px",
              fontSize: "1em",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
          />

          <div style={{
            marginLeft: "10px",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            borderLeft: "3px solid #ccc",
            borderRadius: "4px",
            marginBottom: "10px"
          }}>
            <strong style={{ display: "block", marginBottom: 5 }}>Ingredients:</strong>
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
        </div>
      ))}
    </div>
  </div>
))}
            
        </div>

        {/* Right-hand chat panel */}
        <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: 20 }}>
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
    
    <h2>Export</h2>
<button onClick={() => {
  const header = ["Day", "Meal", "Dish", "Ingredient", "Person"];
  const rows = [];
  for (const day of days) {
    for (const meal of meals) {
      const dish = schedule[day]?.[meal]?.dish || "";
      for (const item of schedule[day]?.[meal]?.ingredients || []) {
        rows.push([day, meal, dish, item.name, item.person]);
      }
    }
  }
  const csvContent = [header, ...rows].map(r => r.map(cell => `"${cell}"`).join(",")).join("\\n");
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
    for (const meal of meals) {
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
}}>Download PDF</button>
        
            
            
            
            
            </div>
  );
}
