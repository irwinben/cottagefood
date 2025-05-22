
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
  measurementId: "G-FLQ90D3MSC",
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
    if (name && !guests.includes(name)) {
      setGuests([...guests, name]);
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
    const newIngredients = [...(schedule[day]?.[meal]?.ingredients || []), { name: "", person: "" }];
    setSchedule(prev => ({
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
    setSchedule(prev => {
      const dayData = prev[day] || {};
      const mealData = dayData[meal] || { dish: "", ingredients: [], guests: {} };
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
    <div style={{ fontFamily: "Arial", padding: 20, display: "flex" }}>
      {/* ... full UI rendering here ... */}
      <h1>Holiday Meal Scheduler</h1>
      {/* Full JSX continues here including Chat, Guest Grid, Meal Planning */}
    </div>
  );
}
