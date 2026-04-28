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

// 🔥 SERVERS
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

// ➕ ADD SERVER
app.post("/add-server", (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: "host & port required" });

  servers.push({ host, port: Number(port) });
  res.json({ ok: true });
});

// 🧠 HISTORY STORAGE (for average)
let history = {}; 
// { "ip:port": [players, players, players...] }

// 🔥 FETCH LIVE DATA
async function fetchServers() {
  return Promise.all(
    servers.map(async (s) => {
      let state = null;

      try {
        state = await Gamedig.query({
          type: "cs16",
          host: s.host,
          port: s.port,
          socketTimeout: 5000,
          attemptTimeout: 5000
        });
      } catch {
        state = null;
      }

      const key = `${s.host}:${s.port}`;
      const players = state && state.players
        ? state.players.length
        : 0;

      // store history
      if (!history[key]) history[key] = [];
      history[key].push(players);

      // keep last 20 snapshots
      if (history[key].length > 20) {
        history[key].shift();
      }

      return {
        name: state?.name || `Server ${s.port}`,
        ip: key,
        online: !!state,
        players,
        maxPlayers: state?.maxplayers || 0,
        map: state?.map || "offline"
      };
    })
  );
}

// 📊 AVERAGE CALC
function getAverage(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 🏆 RANK BY AVERAGE
function rankByAverage(list) {
  return list
    .map(s => {
      const avg = getAverage(history[s.ip]);
      return { ...s, avg };
    })
    .sort((a, b) => b.avg - a.avg);
}

// 🔥 LIVE API (instant data)
app.get("/servers", async (req, res) => {
  const data = await fetchServers();
  res.json(data);
});

// 🔥 TOP BY AVERAGE (REAL ACTIVITY)
app.get("/top-servers", async (req, res) => {
  const data = await fetchServers();
  const ranked = rankByAverage(data).slice(0, 5);

  res.json(ranked);
});

// 🚀 START
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
