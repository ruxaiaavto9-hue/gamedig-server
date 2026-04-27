const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 10000;

const servers = [
  { name: "CS Server 1", host: "80.241.246.26", port: 27777 },
  { name: "CS Server 2", host: "80.241.246.27", port: 27015 }
];

app.get("/", (req, res) => {
  res.send("CS API LIVE 🚀");
});

app.get("/servers", async (req, res) => {
  try {
    const results = await Promise.all(
      servers.map(async (s) => {
        try {
          const state = await Gamedig.query({
            type: "cs16",
            host: s.host,
            port: s.port,
            socketTimeout: 3000
          });

          return {
            name: s.name,
            ip: `${s.host}:${s.port}`,
            online: true,
            players: state.players.length,
            maxPlayers: state.maxplayers,
            map: state.map
          };
        } catch (err) {
          return {
            name: s.name,
            ip: `${s.host}:${s.port}`,
            online: false,
            players: 0,
            maxPlayers: 0,
            map: "offline"
          };
        }
      })
    );

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: "API failed" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
