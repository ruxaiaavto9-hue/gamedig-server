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
  if (!host || !port) {
    return res.status(400).json({ error: "host & port required" });
  }

  servers.push({ host, port: Number(port) });
  res.json({ ok: true });
});

// 🧠 STORAGE
let history = {};
let cache = null;
let lastFetch = 0;

// ⏱ timeout helper
function timeout(ms) {
  return new Promise(res => setTimeout(() => res(null), ms));
}

// 🔁 QUERY SERVER (retry)
async function queryServer(s) {
  try {
    return await Gamedig.query({
      type: "cs16",
      host: s.host,
      port: s.port,
      socketTimeout: 5000,
      attemptTimeout: 5000
    });
  } catch {
    try {
      return await Gamedig.query({
        type: "cs16",
        host: s.host,
        port: s.port,
        socketTimeout: 7000
      });
    } catch {
      return null;
    }
  }
}

// 🛡 SAFE QUERY
async function safeQuery(s) {
  return await Promise.race([
    queryServer(s),
    timeout(8000)
  ]);
}

// 🔥 FETCH ALL SERVERS (PARALLEL + SAFE)
async function fetchServers() {
  // cache 10 sec
  if (Date.now() - lastFetch < 10000 && cache) {
    return cache;
  }

  const results = await Promise.all(
    servers.map(async (s) => {
      const state = await safeQuery(s);

      const key = `${s.host}:${s.port}`;

      const players = state
        ? (state.players?.length || state.raw?.numplayers || 0)
        : 0;

      // history
      if (!history[key]) history[key] = [];
      history[key].push(players);

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

  cache = results;
  lastFetch = Date.now();

  return results;
}

// 📊 average
function getAverage(arr) {
  if (!arr || arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// 🏆 ranking
function rankByAverage(list) {
  return list
    .map(s => {
      const avg = getAverage(history[s.ip]);
      return { ...s, avg };
    })
    .sort((a, b) => b.avg - a.avg);
}

// 🔥 LIVE API
app.get("/servers", async (req, res) => {
  try {
    const data = await fetchServers();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "failed to fetch servers" });
  }
});

// 🏆 TOP SERVERS
app.get("/top-servers", async (req, res) => {
  try {
    const data = await fetchServers();
    const ranked = rankByAverage(data).slice(0, 5);
    res.json(ranked);
  } catch {
    res.status(500).json({ error: "failed" });
  }
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
