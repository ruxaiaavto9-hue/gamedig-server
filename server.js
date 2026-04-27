const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🟢 HEALTH
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 ALL YOUR SERVERS
let servers = [
  { host: "80.241.246.26", port: 222 },
  { host: "80.241.246.26", port: 226 },
  { host: "80.241.246.26", port: 27999 },
  { host: "80.241.246.26", port: 26 },
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 336 },
  { host: "80.241.246.26", port: 27446 },
  { host: "80.241.246.26", port: 27017 },
  { host: "80.241.246.26", port: 126 },
  { host: "80.241.246.26", port: 346 }
];

// ➕ ADD SERVER (dashboard support)
app.post("/add-server", (req, res) => {
  const { host, port } = req.body;

  if (!host || !port) {
    return res.status(400).json({ error: "host & port required" });
  }

  servers.push({ host, port: Number(port) });

  res.json({ ok: true, servers });
});

// 🔥 LIVE SERVERS API
app.get("/servers", async (req, res) => {
  try {
    const results = await Promise.all(
      servers.map(async (s) => {
        let state = null;

        try {
          state = await Gamedig.query({
            type: "cs16",
            host: s.host,
            port: s.port,
            socketTimeout: 7000,
            attemptTimeout: 7000
          });
        } catch (e1) {
          try {
            state = await Gamedig.query({
              type: "valve",
              host: s.host,
              port: s.port,
              socketTimeout: 7000,
              attemptTimeout: 7000
            });
          } catch (e2) {
            state = null;
          }
        }

        // ❌ OFFLINE
        if (!state) {
          return {
            name: `Server ${s.port}`,
            ip: `${s.host}:${s.port}`,
            online: false,
            players: 0,
            maxPlayers: 0,
            map: "offline"
          };
        }

        // 🟢 ONLINE
        return {
          name:
            state.name?.trim() ||
            state.hostname?.trim() ||
            `Server ${s.port}`,
          ip: `${s.host}:${s.port}`,
          online: true,
          players: Array.isArray(state.players)
            ? state.players.length
            : 0,
          maxPlayers: state.maxplayers || 0,
          map: state.map || "unknown"
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Server crashed" });
  }
});

// 🚀 START
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
