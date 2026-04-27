const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));

const PORT = process.env.PORT || 10000;

// 🟢 health check
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 servers list
const servers = [
  { host: "80.241.246.26", port: 27777 },
  { host: "80.241.246.27", port: 27015 }
];

// 🔥 MAIN API
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
            socketTimeout: 8000,
            attemptTimeout: 8000
          });
        } catch (e1) {
          // 🔁 FALLBACK
          try {
            state = await Gamedig.query({
              type: "valve",
              host: s.host,
              port: s.port,
              socketTimeout: 8000,
              attemptTimeout: 8000
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

        // 🟢 ONLINE (REAL DATA SAFE PARSE)
        const players =
          Array.isArray(state.players) ? state.players.length : 0;

        return {
          name:
            state.name?.trim() ||
            state.hostname?.trim() ||
            `Server ${s.port}`,
          ip: `${s.host}:${s.port}`,
          online: true,
          players: players,
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

// 🚀 start server
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
