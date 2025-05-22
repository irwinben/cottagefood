import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import "jspdf-autotable";

// 🔐 Paste your Firebase config here:
const firebaseConfig = {
  apiKey: "AIzaSyA1-_xY_BaqYDBZhKYT0qA-vUc_svleaRM",
  authDomain: "cottage-meal-planner.firebaseapp.com",
  projectId: "cottage-meal-planner",
  storageBucket: "cottage-meal-planner.firebasestorage.app",
  messagingSenderId: "107654447812",
  appId: "1:107654447812:web:379ad2549e95f870eaff91",
  measurementId: "G-FLQ90D3MSC"
};


// 🔧 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState("");
  const [schedule, setSchedule] = useState({});
  const [days, setDays] = useState([]);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "mealScheduler", "sharedPlan");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGuests(data.guests || []);
        setSchedule(data.schedule || {});
        setDays(data.days || []);
        setMeals(data.meals || []);
      }
      setLoading(false);
    };
    fetchData();
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

  const addGuest = () => {
    const name = newGuest.trim();
    if (name && !guests.includes(name)) {
      setGuests([...guests, name]);
      setNewGuest("");
    }
  };

  const addIngredient = (day, meal) => {
    const newIngredients = [...(schedule[day]?.[meal]?.ingredients || []), { name: "", person: "" }];
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day]?.[meal],
          ingredients: newIngredients,
          dish: prev[day]?.[meal]?.dish || ""
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

  const updateDish = (day, meal, dish) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: {
          ...prev[day][meal],
          dish
        }
      }
    }));
  };

  const getExportData = () => {
    const data = [];
    for (const day of days) {
      for (const meal of meals) {
        const dish = schedule[day]?.[meal]?.dish || "";
        for (const item of schedule[day]?.[meal]?.ingredients || []) {
          data.push([day, meal, dish, item.name, item.person]);
        }
      }
    }
    return data;
  };

  const downloadCSV = () => {
    const header = ["Day", "Meal", "Dish", "Ingredient", "Person"];
    const rows = getExportData();
    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "holiday-meal-plan.csv";
    link.click();
  };

  const downloadPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Holiday Meal Schedule", 14, 16);
    docPDF.autoTable({
      startY: 20,
      head: [["Day", "Meal", "Dish", "Ingredient", "Person"]],
      body: getExportData()
    });
    docPDF.save("holiday-meal-plan.pdf");
  };

  const summaryByPerson = () => {
    const result = {};
    for (const day of days) {
      for (const meal of meals) {
        for (const item of schedule[day]?.[meal]?.ingredients || []) {
          if (item.person) {
            if (!result[item.person]) result[item.person] = [];
            result[item.person].push(`${item.name} (${meal}, ${day})`);
          }
        }
      }
    }
    return result;
  };

  const summary = summaryByPerson();

  return (
    <div style={{ fontFamily: "Arial", padding: 20 }}>
      <h1>Holiday Meal Scheduler</h1>

      {loading ? <p>Loading shared plan...</p> : (
        <>
          <h2>Guests</h2>
          <input
            value={newGuest}
            onChange={(e) => setNewGuest(e.target.value)}
            placeholder="Add guest name"
          />
          <button type="button" onClick={addGuest}>Add Guest</button>
          <ul>{guests.map(g => <li key={g}>{g}</li>)}</ul>

          <h2>Edit Days</h2>
          <input
            placeholder="Comma-separated days (e.g. Friday,Saturday)"
            value={days.join(",")}
            onChange={(e) => setDays(e.target.value.split(",").map(d => d.trim()))}
            style={{ width: "100%" }}
          />

          <h2>Edit Meals</h2>
          <input
            placeholder="Comma-separated meals (e.g. Breakfast,Lunch,Dinner)"
            value={meals.join(",")}
            onChange={(e) => setMeals(e.target.value.split(",").map(m => m.trim()))}
            style={{ width: "100%" }}
          />

          <h2>Meal Plan</h2>
          {days.map(day => (
            <div key={day}>
              <h3>{day}</h3>
              {meals.map(meal => (
                <div key={meal} style={{ border: "1px solid #ccc", margin: "10px 0", padding: 10 }}>
                  <h4>{meal}</h4>
                  <input
                    value={schedule[day]?.[meal]?.dish || ""}
                    onChange={(e) => updateDish(day, meal, e.target.value)}
                    placeholder="Dish name"
                    style={{ width: "100%", marginBottom: 5 }}
                  />
                  {(schedule[day]?.[meal]?.ingredients || []).map((ing, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                      <input
                        placeholder="Ingredient"
                        value={ing.name}
                        onChange={(e) => updateIngredient(day, meal, i, "name", e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={ing.person}
                        onChange={(e) => updateIngredient(day, meal, i, "person", e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select person</option>
                        {guests.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <button type="button" onClick={() => addIngredient(day, meal)}>Add Ingredient</button>
                </div>
              ))}
            </div>
          ))}

          <h2>Summary by Person</h2>
          {Object.keys(summary).length === 0 && <p>No assignments yet.</p>}
          {Object.entries(summary).map(([person, items]) => (
            <div key={person}>
              <strong>{person}</strong>
              <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          ))}

          <h2>Export</h2>
          <button type="button" onClick={downloadCSV} style={{ marginRight: 10 }}>Download CSV</button>
          <button type="button" onClick={downloadPDF}>Download PDF</button>
        </>
      )}
    </div>
  );
}
