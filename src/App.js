
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

    const q = query(collection(db, `chat_${weekendKey}`), orderBy("timestamp", "asc"));
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
    setDailyMeals(plan.dailyMeals || {});
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
        [`weekends.${weekendKey}`]: { guests, schedule, days, dailyMeals }
      });
    }
  }, [guests, schedule, days, dailyMeals, weekendKey, initialized]);

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
        const mealData = schedule[day]?.[meal];
        if (!mealData || !mealData.ingredients) continue;

        for (const { name, person } of mealData.ingredients) {
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

return (
  <div style={{ fontFamily: "Arial", padding: 20 }}>
    <h1>Cottage Meal Scheduler</h1>

    {/* Replace these props with your actual handler functions */}
    <WeekendSelector
      weekendKey={weekendKey}
      setWeekendKey={setWeekendKey}
      allPlans={allPlans}
      createNewWeekend={createNewWeekend}
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
      schedule={schedule}
      setSchedule={setSchedule}
      guests={guests}
      toggleGuestPresence={toggleGuestPresence}
      updateDish={updateDish}
      addIngredient={addIngredient}
      updateIngredient={updateIngredient}
    />

    <DailyMealSelector
      dailyMeals={dailyMeals}
      setDailyMeals={setDailyMeals}
      availableMeals={availableMeals}
    />

    {/* ✅ NEW GUEST INGREDIENT SUMMARY SECTION */}
    <div style={{ marginTop: "40px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "10px" }}>
        What Each Guest is Bringing
      </h2>
      {generateGuestIngredientSummary().map(({ person, items }) => (
        <div key={person} style={{ marginBottom: "15px" }}>
          <strong>{person}</strong>
          <ul style={{ marginLeft: "20px" }}>
            {items.map((item, idx) => (
              <li key={idx}>
                {item.name} ({item.day} – {item.meal})
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);
}
