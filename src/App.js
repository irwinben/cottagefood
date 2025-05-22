import { useState } from "react";

const days = ["Friday", "Saturday", "Sunday"];
const meals = ["Breakfast", "Lunch", "Dinner", "Snacks"];

const defaultSchedule = {};
days.forEach(day => {
  defaultSchedule[day] = {};
  meals.forEach(meal => {
    defaultSchedule[day][meal] = { dish: "", ingredients: [] };
  });
});

export default function App() {
  const [guests, setGuests] = useState([]);
  const [newGuest, setNewGuest] = useState("");
  const [schedule, setSchedule] = useState(defaultSchedule);

  const addGuest = () => {
    const name = newGuest.trim();
    if (name && !guests.includes(name)) {
      setGuests([...guests, name]);
      setNewGuest("");
    }
  };

  const addIngredient = (day, meal) => {
    const newIngredients = [...schedule[day][meal].ingredients, { name: "", person: "" }];
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: { ...prev[day][meal], ingredients: newIngredients }
      }
    }));
  };

  const updateIngredient = (day, meal, index, field, value) => {
    const updated = [...schedule[day][meal].ingredients];
    updated[index][field] = value;
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: { ...prev[day][meal], ingredients: updated }
      }
    }));
  };

  const updateDish = (day, meal, dish) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: { ...prev[day][meal], dish }
      }
    }));
  };

  const summaryByPerson = () => {
    const result = {};
    for (const day of days) {
      for (const meal of meals) {
        for (const item of schedule[day][meal].ingredients) {
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

      <h2>Guests</h2>
      <input
        value={newGuest}
        onChange={e => setNewGuest(e.target.value)}
        placeholder="Add guest name"
      />
      <button onClick={addGuest}>Add Guest</button>
      <ul>{guests.map(g => <li key={g}>{g}</li>)}</ul>

      <h2>Meal Plan</h2>
      {days.map(day => (
        <div key={day}>
          <h3>{day}</h3>
          {meals.map(meal => (
            <div key={meal} style={{ border: "1px solid #ccc", margin: "10px 0", padding: 10 }}>
              <h4>{meal}</h4>
              <input
                value={schedule[day][meal].dish}
                onChange={e => updateDish(day, meal, e.target.value)}
                placeholder="Dish name"
                style={{ width: "100%", marginBottom: 5 }}
              />
              {schedule[day][meal].ingredients.map((ing, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                  <input
                    placeholder="Ingredient"
                    value={ing.name}
                    onChange={e => updateIngredient(day, meal, i, "name", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select
                    value={ing.person}
                    onChange={e => updateIngredient(day, meal, i, "person", e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select person</option>
                    {guests.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button onClick={() => addIngredient(day, meal)}>Add Ingredient</button>
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
    </div>
  );
}
