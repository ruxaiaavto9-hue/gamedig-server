const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ 6 HOURS RACE WINDOW
const RACE_TIME = 6 * 60 * 60 * 1000;

// 💾 storage
let snapshotStart = {};
let leaderboard = [];
let lastUpdate = Date.now();

// 📌 SERVERS
const serversList = [
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

// 🔥 query
async function queryServer(host, port) {
  try {
    return await Gamedig.query({
      type: "cs16",
      host,
      port
    });
  } catch {
    return null;
  }
}

// 📊 fetch all servers
async function fetchData() {
  return Promise.all(
    serversList.map(async (s) => {
      const data = await queryServer(s.host, s.port);

      const players = data ? data.players.length : 0;

      return {
        ip: `${s.host}:${s.port}`,
        name: data?.name || `${s.host}:${s.port}`,
        players,
        online: !!data
      };
    })
  );
}

// 🧠 INIT SNAPSHOT (start of race)
async function initSnapshot(data) {
  data.forEach(s => {
    snapshotStart[s.ip] = s.players;
  });
}

// 🔥 CALCULATE LIVE CHANGE
function calculateLive(data) {
  return data.map(server => {
    const start = snapshotStart[server.ip] || 0;
    const change = server.players - start;

    return {
      ...server,
      change,
      status:
        change > 0 ? "📈 rising" :
        change < 0 ? "📉 falling" :
        "➡️ stable"
    };
  });
}

// 🏆 RANK by gain (NOT current players)
function rank(data) {
  return [...data]
    .sort((a, b) => b.change - a.change)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 refresh system
async function refresh() {
  const data = await fetchData();

  const live = calculateLive(data);
  const ranked = rank(live);

  leaderboard = ranked;
  lastUpdate = Date.now();

  console.log("🔄 Race updated");
}

// 🚀 FIRST LOAD
(async () => {
  const data = await fetchData();
  await initSnapshot(data);
  leaderboard = calculateLive(data);
})();

// 🔁 LIVE refresh every 20 sec
setInterval(refresh, 20000);

// 🏁 RESET RACE every 6 hours
setInterval(async () => {
  const data = await fetchData();
  await initSnapshot(data);
  console.log("🏁 NEW 6H RACE STARTED");
}, RACE_TIME);

// 📡 API
app.get("/servers", (req, res) => {
  res.json(leaderboard);
});

// ❤️ health
app.get("/", (req, res) => {
  res.send("CS 6H RACE SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
