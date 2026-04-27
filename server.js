const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;

// test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

// 🔥 MAIN API FOR LOVABLE
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
