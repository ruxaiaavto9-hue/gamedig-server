const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ SETTINGS
const LIVE_REFRESH = 20000; // 20 sec
const HOURLY_RANK = 60 * 60 * 1000; // 1 hour
const TIMEOUT = 4500;

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

// 💾 STATE
let state = [];
let ranked = [];

// 🔥 IMPORTANT: 6H BASELINE STORAGE
let baseline6h = {};

// 🔥 SAFE QUERY (never crash)
async function queryServer(host, port) {
  try {
    return await Promise.race([
      Gamedig.query({
        type: "cs16",
        host,
        port
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT)
      )
    ]);
  } catch {
    return null;
  }
}

// 📊 FETCH ALL SERVERS
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const players = data?.players?.length || 0;

      // 🟢 INIT BASELINE ONCE (CRITICAL FIX)
      if (baseline6h[key] === undefined) {
        baseline6h[key] = players;
      }

      // 🔥 CORRECT 6H Δ (THIS WAS BUGGED BEFORE)
      const delta = players - baseline6h[key];

      return {
        ip: key,
        name: data?.name || key,
        players,
        maxPlayers: data?.maxplayers || 0,
        map: data?.map || "offline",
        online: !!data,

        // 🔥 FIXED 6H Δ
        change: delta
      };
    })
  );

  return results;
}

// 🏆 HOURLY RANK (ONLY ONCE PER HOUR)
function applyRank(data) {
  return [...data]
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 LIVE UPDATE (Δ ONLY)
async function liveUpdate() {
  state = await fetchServers();
}

// 🏆 HOURLY RANK UPDATE (POSITION CHANGE ONLY HERE)
async function hourlyUpdate() {
  const data = await fetchServers();
  ranked = applyRank(data);

  console.log("🏆 Hourly rank updated");
}

// 🚀 INIT
(async () => {
  const data = await fetchServers();
  state = data;
  ranked = applyRank(data);
})();

// 🔄 LIVE LOOP
setInterval(liveUpdate, LIVE_REFRESH);

// 🏆 HOURLY LOOP
setInterval(hourlyUpdate, HOURLY_RANK);

// 📡 API (UNIFIED FOR ALL DEVICES)
app.get("/servers", (req, res) => {
  const merged = state.map(s => {
    const r = ranked.find(x => x.ip === s.ip);

    return {
      ...s,
      rank: r?.rank || 0
    };
  });

  res.json(merged);
});

// ❤️ health
app.get("/", (req, res) => {
  res.send("FIXED 6H Δ + HOURLY RANK SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
