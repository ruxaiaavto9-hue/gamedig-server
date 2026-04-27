const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🟢 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 DYNAMIC SERVER LIST (can be updated from dashboard)
let servers = [
  { host: "80.241.246.26", port: 27777 },
  { host: "80.241.246.27", port: 27015 }
];

// ➕ ADD SERVER FROM DASHBOARD
app.post("/add-server", (req, res) => {
  const { host, port } = req.body;

  if (!host || !port) {
    return res.status(400).json({ error: "host & port required" });
  }

  servers.push({
    host: host.trim(),
    port: Number(port)
  });

  res.json({
    ok: true,
    message: "Server added successfully",
    servers
  });
});

// 🔥 MAIN LIVE API
app.get("/servers", async (req, res) => {
  try {
    const results = await Promise.all(
      servers.map(async (s) => {
        let state = null;

        // 🔥 TRY CS16 FIRST
        try {
          state = await Gamedig.query({
            type: "cs16",
            host: s.host,
            port: s.port,
            socketTimeout: 7000,
            attemptTimeout: 7000
          });
        } catch (e1) {
          // 🔁 FALLBACK
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

        // 🟢 ONLINE SAFE DATA
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

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
