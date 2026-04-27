const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🟢 health
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 SERVERS
const servers = [
  { host: "80.241.246.26", port: 27777 },
  { host: "80.241.246.27", port: 27015 }
];

// 🧠 KILL DATABASE (RAM TEMP)
let killLog = [];

// 🔥 LOG KILL (CALL FROM SERVER PLUGIN LATER)
app.post("/log-kill", (req, res) => {
  const { player } = req.body;

  if (!player) {
    return res.status(400).json({ error: "player required" });
  }

  killLog.push({
    player,
    time: Date.now()
  });

  res.json({ ok: true });
});

// 🔥 TOP KILLS LAST 12 HOURS
app.get("/top-kills", (req, res) => {
  const now = Date.now();

  const last12h = killLog.filter(
    k => now - k.time < 12 * 60 * 60 * 1000
  );

  const stats = {};

  last12h.forEach(k => {
    stats[k.player] = (stats[k.player] || 0) + 1;
  });

  const top = Object.entries(stats)
    .map(([player, kills]) => ({ player, kills }))
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 5);

  res.json(top);
});

// 🔥 SERVERS API
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
            socketTimeout: 8000,
            attemptTimeout: 8000
          });
        } catch (e1) {
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

// 🚀 start
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
