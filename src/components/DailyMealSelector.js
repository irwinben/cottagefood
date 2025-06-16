// src/components/DailyMealSelector.js

import React from "react";

export default function DailyMealSelector({
  days = [],
  dailyMeals = {},
  setDailyMeals,
  availableMeals = []
}) {
  return (
    <div style={{ marginTop: 30 }}>
      <h2>Select Meals Per Day</h2>
      {days.map((day) => (
        <div key={day} style={{ marginBottom: 10 }}>
          <strong>{day}</strong>
          <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
            {availableMeals.map((meal) => (
              <label key={`${day}-${meal}`}>
                <input
                  type="checkbox"
                  checked={(dailyMeals[day] || []).includes(meal)}
                  onChange={(e) => {
                    const current = dailyMeals[day] || [];
                    const updated = e.target.checked
                      ? [...current, meal]
                      : current.filter((m) => m !== meal);
                    setDailyMeals({
                      ...dailyMeals,
                      [day]: updated
                    });
                  }}
                />
                {meal}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
