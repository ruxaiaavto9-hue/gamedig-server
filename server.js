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

  if (!host || !port) {
    return res.status(400).json({ error: "host & port required" });
  }

  servers.push({ host: host.trim(), port: Number(port) });
  res.json({ ok: true });
});

// 🧠 HISTORY FOR AVERAGE
let history = {};

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
          socketTimeout: 6000,
          attemptTimeout: 6000
        });
      } catch {
        state = null;
      }

      const key = `${s.host}:${s.port}`;

      const players =
        state && Array.isArray(state.players)
          ? state.players.length
          : 0;

      if (!history[key]) history[key] = [];
      history[key].push(players);

      if (history[key].length > 30) {
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

// 📊 AVERAGE
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 🏆 SCORING SYSTEM
function rankServers(data) {
  return data
    .map(s => {
      const average = avg(history[s.ip]);
      const peak = Math.max(...(history[s.ip] || [0]));

      const score =
        average * 0.5 +
        peak * 0.3 +
        s.players * 0.2;

      return {
        ...s,
        average: Number(average.toFixed(2)),
        peak,
        score
      };
    })
    .sort((a, b) => b.score - a.score);
}

// 🧠 SNAPSHOT SYSTEM (30 MIN)
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

// ⏱ every 30 minutes
setInterval(updateSnapshot, 30 * 60 * 1000);
updateSnapshot();

// 🔥 LIVE API
app.get("/servers", async (req, res) => {
  const data = await fetchServers();
  res.json(data);
});

// 🏆 TOP 5 SNAPSHOT API
app.get("/top-servers", (req, res) => {
  res.json({
    updated: lastSnapshotTime,
    servers: snapshotTop
  });
});

// 🚀 START
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
