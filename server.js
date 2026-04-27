const express = require("express");
const cors = require("cors");

const app = express();

// 🔥 CORS FIX (CRITICAL)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 10000;

// 🟢 Root route (health check)
app.get("/", (req, res) => {
  res.send("CS 1.6 API is running 🚀");
});

// 🔥 MAIN API ENDPOINT
app.get("/servers", (req, res) => {
  res.json([
    {
      name: "CS Server 1",
      ip: "80.241.246.26:27777",
      online: true,
      players: 12,
      maxPlayers: 32,
      map: "de_dust2"
    },
    {
      name: "CS Server 2",
      ip: "80.241.246.27:27015",
      online: true,
      players: 8,
      maxPlayers: 24,
      map: "de_inferno"
    }
  ]);
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
