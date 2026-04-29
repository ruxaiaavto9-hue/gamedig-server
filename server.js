const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ RACE SETTINGS
const RACE_TIME = 6 * 60 * 60 * 1000; // 6 hours
const REFRESH_INTERVAL = 20000; // 20 sec live update

// 💾 STORAGE
let snapshotStart = {};
let leaderboard = [];
let cache = { data: [], time: 0 };

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

// 🔥 SAFE QUERY (NO CRASH EVER)
async function queryServer(host, port, retries = 1) {
  try {
    return await Promise.race([
      Gamedig.query({
        type: "cs16",
        host,
        port
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      )
    ]);
  } catch (err) {
    if (retries > 0) {
      return await queryServer(host, port, retries - 1);
    }

    // ❗ NEVER FAIL → return safe object
    return {
      name: null,
      players: [],
      maxplayers: 0,
      map: "offline"
    };
  }
}

// 📊 FETCH SERVERS (SAFE MODE)
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const data = await queryServer(s.host, s.port);

      const players = data?.players?.length || 0;

      return {
        ip: `${s.host}:${s.port}`,
        name: data?.name || `${s.host}:${s.port}`,
        players,
        maxPlayers: data?.maxplayers || 0,
        map: data?.map || "offline",
        online: players > 0 || data?.name !== null
      };
    })
  );

  return results;
}

// 🧠 INIT SNAPSHOT (6H START BASELINE)
async function initSnapshot(data) {
  data.forEach(s => {
    snapshotStart[s.ip] = s.players || 0;
  });
}

// 📈 LIVE CHANGE CALCULATION
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

// 🏆 RANK SYSTEM
function rank(data) {
  return [...data]
    .sort((a, b) => b.change - a.change)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 MAIN REFRESH LOOP
async function refresh() {
  const servers = await fetchServers();

  const live = calculateLive(servers);
  leaderboard = rank(live);

  cache = {
    data: leaderboard,
    time: Date.now()
  };

  console.log("🔄 Updated safely");
}

// 🚀 INITIAL START
(async () => {
  const data = await fetchServers();
  await initSnapshot(data);

  leaderboard = calculateLive(data);
  cache.data = leaderboard;
})();

// ⚡ LIVE UPDATE (NO CRASH)
setInterval(refresh, REFRESH_INTERVAL);

// 🏁 RESET RACE EVERY 6 HOURS
setInterval(async () => {
  const data = await fetchServers();
  await initSnapshot(data);

  console.log("🏁 NEW 6H RACE STARTED");
}, RACE_TIME);

// 📡 API
app.get("/servers", (req, res) => {
  res.json(cache.data);
});

// ❤️ HEALTH CHECK
app.get("/", (req, res) => {
  res.send("CS 6H RACE SYSTEM (BULLETPROOF) 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
