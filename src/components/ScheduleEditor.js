// src/components/ScheduleEditor.js

import React from "react";

export default function ScheduleEditor({ days, setDays }) {
  return (
    <div>
      <h2>Edit Days</h2>
      <input
        value={days.join(",")}
        onChange={(e) => setDays(e.target.value.split(",").map((d) => d.trim()))}
        placeholder="e.g. Friday,Saturday"
        style={{ width: "100%" }}
      />
    </div>
  );
}
