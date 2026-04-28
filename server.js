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

// 🧠 HISTORY
let history = {};

// 🔥 RETRY FUNCTION (IMPORTANT FIX)
async function queryServer(host, port, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      return await Gamedig.query({
        type: "cs16",
        host,
        port,
        socketTimeout: 8000,
        attemptTimeout: 8000
      });
    } catch (err) {
      if (i === tries - 1) return null;
    }
  }
}

// 🔥 FETCH LIVE DATA
async function fetchServers() {
  return Promise.all(
    servers.map(async (s) => {

      const state = await queryServer(s.host, s.port);

      const key = `${s.host}:${s.port}`;

      const players =
        state?.players?.length || 0;

      // history safe push
      if (!history[key]) history[key] = [];
      history[key].push(players);

      if (history[key].length > 30) {
        history[key].shift();
      }

      return {
        name: state?.name || `Server ${s.port}`,
        serverName: state?.name || null,
        ip: key,
        online: state ? true : false,
        players,
        maxPlayers: state?.maxplayers || 0,
        map: state?.map || "offline"
      };
    })
  );
}

// 📊 AVERAGE SAFE
function avg(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// 🏆 RANK SYSTEM (FIXED for offline stability)
function rankServers(data) {
  return data
    .map(s => {
      const hist = history[s.ip] || [];

      const average = avg(hist);
      const peak = hist.length ? Math.max(...hist) : 0;

      // ❗ offline servers don't destroy ranking anymore
      const liveBoost = s.online ? 1 : 0.3;

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

// 🧠 SNAPSHOT
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

// ⏱ UPDATE LOOP
setInterval(updateSnapshot, 30 * 60 * 1000);
updateSnapshot();

// 🔥 LIVE API
app.get("/servers", async (req, res) => {
  const data = await fetchServers();
  res.json(data);
});

// 🏆 TOP API
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
