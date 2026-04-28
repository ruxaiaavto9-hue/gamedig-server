const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🟢 HEALTH
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 SERVERS
const servers = [
  { host: "80.241.246.26", port: 222 },
  { host: "80.241.246.26", port: 226 },
  { host: "80.241.246.26", port: 27999 },
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 27017 }
];

// 🧠 history safe store
const history = {};

// 🔥 SAFE QUERY (NO CRASH, NO HANG)
async function queryServer(host, port) {
  const types = ["cs16", "protocol-valve"];

  for (const type of types) {
    try {
      return await Gamedig.query({
        type,
        host,
        port,
        socketTimeout: 8000,
        attemptTimeout: 8000
      });
    } catch (e) {
      // try next type
    }
  }

  return null;
}

// 🔥 FETCH DATA SAFE MODE
async function fetchServers() {
  const results = [];

  for (const s of servers) {
    const key = `${s.host}:${s.port}`;

    let state = null;

    try {
      state = await queryServer(s.host, s.port);
    } catch (e) {
      state = null;
    }

    const players = state?.players?.length ?? null;

    // ❗ IMPORTANT: DO NOT store fake 0 on failure
    if (!history[key]) history[key] = [];

    if (players !== null) {
      history[key].push(players);
      if (history[key].length > 30) history[key].shift();
    }

    results.push({
      ip: key,
      name: state?.name || `Server ${s.port}`,
      serverName: state?.name || null,
      online: !!state,
      players: players ?? 0,
      maxPlayers: state?.maxplayers || 0,
      map: state?.map || "offline"
    });
  }

  return results;
}

// 📊 average helper
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 🏆 ranking (safe, no fake drops)
function rankServers(data) {
  return data
    .map(s => {
      const hist = history[s.ip] || [];

      const average = avg(hist);
      const peak = hist.length ? Math.max(...hist) : 0;

      // ⚡ stable boost (not too punishing offline)
      const boost = s.online ? 1 : 0.8;

      const score =
        (average * 0.5 +
        peak * 0.3 +
        s.players * 0.2) * boost;

      return {
        ...s,
        average: Number(average.toFixed(2)),
        peak,
        score: Number(score.toFixed(2))
      };
    })
    .sort((a, b) => b.score - a.score);
}

// 🧠 TOP CACHE
let snapshotTop = [];
let lastUpdate = 0;

// update snapshot safely
async function updateSnapshot() {
  try {
    const data = await fetchServers();
    const ranked = rankServers(data).slice(0, 5);

    snapshotTop = ranked.map((s, i) => ({
      rank: i + 1,
      ...s,
      crown: i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null
    }));

    lastUpdate = Date.now();
  } catch (e) {
    console.log("snapshot error:", e.message);
  }
}

// refresh every 30 min
setInterval(updateSnapshot, 30 * 60 * 1000);
updateSnapshot();

// 🔥 LIVE API
app.get("/servers", async (req, res) => {
  try {
    const data = await fetchServers();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "server error" });
  }
});

// 🏆 TOP API
app.get("/top-servers", (req, res) => {
  res.json({
    updated: lastUpdate,
    servers: snapshotTop
  });
});

// 🚀 START
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
