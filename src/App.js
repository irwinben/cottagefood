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
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState("");
  const [schedule, setSchedule] = useState({});
  const [days, setDays] = useState([]);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "mealScheduler", "sharedPlan");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        const loadedGuests = (data.guests || []).map(g =>
    typeof g === "string" ? { name: g, adults: 0, children: 0 } : g
  );
        
        setGuests(data.guests || []);
        setSchedule(data.schedule || {});
        setDays(data.days || []);
        setMeals(data.meals || []);
      }
      setLoading(false);
    };
    fetchData();

    const q = query(collection(db, "chat"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map((doc) => doc.data()));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) {
      setDoc(doc(db, "mealScheduler", "sharedPlan"), {
        guests,
        schedule,
        days,
        meals
      });
    }
  }, [guests, schedule, days, meals]);
   const sendMessage = async () => {
    if (chatInput.trim() === "") return;
    await addDoc(collection(db, "chat"), {
      message: chatInput,
      timestamp: new Date()
    });
    setChatInput("");
  };

  const addGuest = () => {
    const name = newGuest.trim();
    if (name && !guests.some(g => g.name === name)) {
      setGuests([...guests, { name, adults: 0, children: 0 }]);
      setNewGuest("");
    }
  };

  const toggleGuestPresence = (guest, day, meal) => {
    setSchedule(prev => {
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
    setSchedule(prev => ({
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
    const newIngredients = [...(schedule[day]?.[meal]?.ingredients || []), { name: "", person: "" }];
    setSchedule(prev => ({
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
    setSchedule(prev => ({
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
      <h1>Holiday Meal Scheduler</h1>

      <h2>Guests</h2>
      <input
        value={newGuest}
        onChange={(e) => setNewGuest(e.target.value)}
        placeholder="Enter guest name"
      />
      <button onClick={addGuest}>Add Guest</button>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {guests.map((g, i) => (
          <li key={g.name} style={{ marginBottom: "10px" }}>
            <div><strong>{g.name || "Unnamed Guest"}</strong></div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <label>
                Adults:
                <input
                  type="number"
                  value={g.adults}
                  min="0"
                  onChange={(e) => {
                    const updated = [...guests];
                    updated[i].adults = parseInt(e.target.value, 10) || 0;
                    setGuests(updated);
                  }}
                  style={{ width: "60px", marginLeft: "5px" }}
                />
              </label>
              <label>
                Children:
                <input
                  type="number"
                  value={g.children}
                  min="0"
                  onChange={(e) => {
                    const updated = [...guests];
                    updated[i].children = parseInt(e.target.value, 10) || 0;
                    setGuests(updated);
                  }}
                  style={{ width: "60px", marginLeft: "5px" }}
                />
              </label>
              <button onClick={() => setGuests(guests.filter((_, j) => j !== i))}>
                ❌ Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Edit Days</h2>
      <input
        value={days.join(",")}
        onChange={(e) => setDays(e.target.value.split(",").map((d) => d.trim()))}
        placeholder="e.g. Friday,Saturday"
        style={{ width: "100%" }}
      />

      <h2>Edit Meals</h2>
      <input
        value={meals.join(",")}
        onChange={(e) => setMeals(e.target.value.split(",").map((m) => m.trim()))}
        placeholder="e.g. Breakfast,Lunch,Dinner"
        style={{ width: "100%" }}
      />

      <h2>Meal Plan</h2>
      {days.map(day => (
        <div key={day}>
          <h3>{day}</h3>
          {meals.map(meal => (
            <div key={meal} style={{ border: "1px solid #ccc", margin: "10px 0", padding: 10 }}>
              <h4 style={{ fontWeight: "bold" }}>{meal}</h4>
              <p style={{ fontStyle: "italic" }}>
                {
                  (() => {
                    const attending = guests.filter(g => schedule[day]?.[meal]?.guests?.[g.name]);
                    const totalAdults = attending.reduce((sum, g) => sum + (g.adults || 0), 0);
                    const totalChildren = attending.reduce((sum, g) => sum + (g.children || 0), 0);
                    return `${totalAdults} adult${totalAdults !== 1 ? "s" : ""}, ${totalChildren} child${totalChildren !== 1 ? "ren" : ""} attending`;
                  })()
                }
              </p>
              <input
                value={schedule[day]?.[meal]?.dish || ""}
                onChange={(e) => updateDish(day, meal, e.target.value)}
                placeholder="Dish name"
                style={{ width: "100%", marginBottom: 10 }}
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

 <h2>Chat</h2>
<div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: 20 }}>
  <h2>Chat</h2>
  <div style={{
    border: "1px solid #ccc",
    padding: 10,
    maxHeight: 300,
    overflowY: "auto",
    marginBottom: 10
  }}>
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
        docPDF.text("Holiday Meal Plan", 14, 16);
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
