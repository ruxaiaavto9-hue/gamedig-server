const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ IMPORTANT: Render PORT FIX
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

// 🧠 HISTORY (ranking stability)
let history = {};

// 🔥 SAFE QUERY (prevents crash)
async function queryServer(host, port) {
  const types = ["cs16", "protocol-valve"];

  for (const type of types) {
    try {
      const res = await Gamedig.query({
        type,
        host,
        port,
        socketTimeout: 12000,
        attemptTimeout: 12000
      });

      return res;
    } catch (e) {
      // ignore and try next type
    }
  }

  return null;
}

// 🔥 FETCH SERVERS (CRASH SAFE)
async function fetchServers() {
  const results = [];

  for (const s of servers) {
    try {
      const state = await queryServer(s.host, s.port);

      const key = `${s.host}:${s.port}`;

      const players = state?.players?.length ?? 0;

      // history SAFE push (no fake data)
      if (!history[key]) history[key] = [];
      if (state) {
        history[key].push(players);
        if (history[key].length > 30) history[key].shift();
      }

      results.push({
        name: state?.name || `Server ${s.port}`,
        serverName: state?.name || null,
        ip: key,
        online: !!state,
        players,
        maxPlayers: state?.maxplayers || 0,
        map: state?.map || "offline"
      });

    } catch (err) {
      results.push({
        name: `Server ${s.port}`,
        serverName: null,
        ip: `${s.host}:${s.port}`,
        online: false,
        players: 0,
        maxPlayers: 0,
        map: "offline"
      });
    }
  }

  return results;
}

// 📊 AVERAGE
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 🏆 RANK SYSTEM (SAFE)
function rankServers(data) {
  return data
    .map(s => {
      const hist = history[s.ip] || [];

      const average = avg(hist);
      const peak = hist.length ? Math.max(...hist) : 0;

      const liveBoost = s.online ? 1 : 0.6;

      const score =
        (average * 0.5 +
        peak * 0.3 +
        s.players * 0.2) * liveBoost;

      return {
        ...s,
        average: Number(average.toFixed(2)),
        peak,
        score: Number(score.toFixed(2))
      };
    })
    .sort((a, b) => b.score - a.score);
}

// 🧠 SNAPSHOT TOP 5
let snapshotTop = [];
let lastSnapshotTime = 0;

async function updateSnapshot() {
  const data = await fetchServers();
  const ranked = rankServers(data).slice(0, 5);

  snapshotTop = ranked.map((s, i) => ({
    rank: i + 1,
    ...s,
    crown:
      i === 0 ? "gold" :
      i === 1 ? "silver" :
      i === 2 ? "bronze" :
      null
  }));

  lastSnapshotTime = Date.now();
}

// ⏱ refresh every 30 min
setInterval(updateSnapshot, 30 * 60 * 1000);
updateSnapshot();

// 🔥 LIVE API
app.get("/servers", async (req, res) => {
  try {
    const data = await fetchServers();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "API crash safe fallback" });
  }
});

// 🏆 TOP API
app.get("/top-servers", (req, res) => {
  res.json({
    updated: lastSnapshotTime,
    servers: snapshotTop
  });
});

// 🚀 START (IMPORTANT FOR RENDER)
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
