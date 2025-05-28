// src/components/WeekendSelector.js

import React from "react";

export default function WeekendSelector({ weekendKey, allPlans, setWeekendKey, createNewWeekend, loadPlan }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 10 }}>
        <strong>Current Weekend:</strong>{" "}
        <span style={{ fontSize: "1.5em", color: "#2c3e50" }}>{weekendKey}</span>
      </div>

      <label><strong>Select Weekend:</strong> </label>
      <select
        value={weekendKey}
        onChange={(e) => {
          setWeekendKey(e.target.value);
          loadPlan(allPlans[e.target.value]);
        }}
      >
        {Object.keys(allPlans).map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <button onClick={createNewWeekend} style={{ marginLeft: 10 }}>
        ➕ New Weekend
      </button>
    </div>
  );
}
