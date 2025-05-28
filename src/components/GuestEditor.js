// src/components/GuestEditor.js

import React from "react";

export default function GuestEditor({ guests, setGuests, newGuest, setNewGuest, addGuest }) {
  return (
    <div>
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
    </div>
  );
}
