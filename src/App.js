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
  storageBucket: "cottage-meal-planner.firebasestorage.app",
  messagingSenderId: "107654447812",
  appId: "1:107654447812:web:379ad2549e95f870eaff91",
  measurementId: "G-FLQ90D3MSC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  const [guests, setGuests] = useState([]); // guests: [{ name, adults, children }]
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
          ingredients: newIngredients,
          dish: prev[day]?.[meal]?.dish || "",
          guests: prev[day]?.[meal]?.guests || {}
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

  const updateDish = (day, meal, dish) => {
    setSchedule((prev) => {
      const dayData = prev[day] || {};
      const mealData = dayData[meal] || {
        dish: "",
        ingredients: [],
        guests: {}
      };
      return {
        ...prev,
        [day]: {
          ...dayData,
          [meal]: {
            ...mealData,
            dish
          }
        }
      };
    });
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
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex", flexDirection: "row" }}>
      <div style={{ flex: 3, paddingRight: 20 }}>
        <h1>Holiday Meal Scheduler</h1>

        {loading ? (
          <p>Loading shared plan...</p>
        ) : (
          <>
            <h2>Guests</h2>
            <input
              value={newGuest}
              onChange={(e) => setNewGuest(e.target.value)}
              placeholder="Add guest name"
            />
            <button type="button" onClick={addGuest}>Add Guest</button>
            
                
          <ul>
  {guests.map((g, i) => (
    <li key={g.name}>
      <strong>{g.name}</strong>
      <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
        <label>Adults:
          <input
            type="number"
            value={g.adults}
            min="0"
            onChange={(e) => {
              const updated = [...guests];
              updated[i].adults = parseInt(e.target.value, 10) || 0;
              setGuests(updated);
            }}
          />
        </label>
        <label>Children:
          <input
            type="number"
            value={g.children}
            min="0"
            onChange={(e) => {
              const updated = [...guests];
              updated[i].children = parseInt(e.target.value, 10) || 0;
              setGuests(updated);
            }}
          />
        </label>
        <button onClick={() => setGuests(guests.filter((_, j) => j !== i))}>❌ Remove</button>
      </div>
    </li>
  ))}
</ul>


              
            <h2>Guest Availability</h2>
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <div style={{ minWidth: '600px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{
                        border: '1px solid #ccc',
                        padding: '8px',
                        minWidth: 120,
                        background: '#f0f0f0',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2
                      }}>Guest</th>
                      {days.flatMap(day =>
                        meals.map(meal => (
                          <th
                            key={`${day}-${meal}`}
                            style={{
                              border: '1px solid #ccc',
                              padding: '4px',
                              writingMode: 'vertical-rl',
                              textAlign: 'left',
                              minWidth: '40px',
                              background: '#f9f9f9'
                            }}
                          >
                            {day} - {meal}
                            <div>
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSchedule(prev => {
                                    const updated = { ...prev };
                                    guests.forEach(guest => {
                                      if (!updated[day]) updated[day] = {};
                                      if (!updated[day][meal])
                                        updated[day][meal] = { guests: {}, ingredients: [], dish: "" };
                                      updated[day][meal].guests[guest] = checked;
                                    });
                                    return updated;
                                  });
                                }}
                              />
                            </div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((guest, rowIndex) => (
                      <tr key={guest} style={{ backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f7f7f7' }}>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          position: 'sticky',
                          left: 0,
                          background: '#fff',
                          zIndex: 1
                        }}>
                          {guest}
                        </td>
                        {days.flatMap(day =>
                          meals.map(meal => (
                            <td key={`${guest}-${day}-${meal}`} style={{ border: '1px solid #ccc', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={schedule[day]?.[meal]?.guests?.[guest] || false}
                                onChange={() => toggleGuestPresence(guest, day, meal)}
                              />
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <h2>Edit Days</h2>
            <input
              placeholder="Comma-separated days (e.g. Friday,Saturday)"
              value={days.join(",")}
              onChange={(e) => setDays(e.target.value.split(",").map((d) => d.trim()))}
              style={{ width: "100%" }}
            />

            <h2>Edit Meals</h2>
            <input
              placeholder="Comma-separated meals (e.g. Breakfast,Lunch,Dinner)"
              value={meals.join(",")}
              onChange={(e) => setMeals(e.target.value.split(",").map((m) => m.trim()))}
              style={{ width: "100%" }}
            />

            <h2>Meal Plan</h2>
            {days.map(day => (
              <div key={day}>
                <h3>{day}</h3>
                {meals.map(meal => (
                  <div key={meal} style={{ border: "1px solid #ccc", margin: "10px 0", padding: 10 }}>
                    <h4 style={{ fontWeight: "bold" }}>{meal}</h4>
                    
                          <div> 
                           <p style={{ fontStyle: "italic", marginBottom: 5 }}>
  {
    (() => {
      const attending = guests.filter(g => schedule[day]?.[meal]?.guests?.[g.name]);
      const totalAdults = attending.reduce((sum, g) => sum + (g.adults || 0), 0);
      const totalChildren = attending.reduce((sum, g) => sum + (g.children || 0), 0);
      return `${totalAdults} adult${totalAdults !== 1 ? 's' : ''}, ${totalChildren} child${totalChildren !== 1 ? 'ren' : ''} attending`;
    })()
  }
</p>
  </div>
          
            <p style={{ fontStyle: "italic", marginBottom: 5 }}>
  {
    (() => {
      const attending = guests.filter(g => schedule[day]?.[meal]?.guests?.[g.name]);
      const totalAdults = attending.reduce((sum, g) => sum + (parseInt(g.adults, 10) || 0), 0);
      const totalChildren = attending.reduce((sum, g) => sum + (parseInt(g.children, 10) || 0), 0);
      return `${totalAdults} adult${totalAdults !== 1 ? 's' : ''}, ${totalChildren} child${totalChildren !== 1 ? 'ren' : ''} attending`;
    })()
  }
           
             
                    </p>
                    <input
                      value={schedule[day]?.[meal]?.dish || ""}
                      onChange={(e) => updateDish(day, meal, e.target.value)}
                      placeholder="Dish name"
                      style={{ width: "100%", marginBottom: 10 }}
                    />
                    <div>
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
                            <option value="">Unassigned</option>
                            {guests.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      <button type="button" onClick={() => addIngredient(day, meal)}>Add Ingredient</button>
                    </div>
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
            <button type="button" onClick={() => {
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
              const csvContent = [header, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = "holiday-meal-plan.csv";
              link.click();
            }} style={{ marginRight: 10 }}>Download CSV</button>

            <button type="button" onClick={() => {
              const docPDF = new jsPDF();
              docPDF.text("Holiday Meal Schedule", 14, 16);
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
                startY: 20,
                head: [["Day", "Meal", "Dish", "Ingredient", "Person"]],
                body: data
              });
              docPDF.save("holiday-meal-plan.pdf");
            }}>Download PDF</button>
          </>
        )}
      </div>

      <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: 20 }}>
        <h2>Chat</h2>
        <div style={{
          height: "300px",
          overflowY: "auto",
          border: "1px solid #ddd",
          padding: 10,
          marginBottom: 10
        }}>
          {chatMessages.map((msg, i) => (
            <p key={i} style={{ margin: "5px 0" }}>{msg.message}</p>
          ))}
        </div>
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Type a message"
          style={{ width: "100%", marginBottom: 10 }}
        />
        <button type="button" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
