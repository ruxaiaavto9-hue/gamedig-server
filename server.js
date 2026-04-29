const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ SETTINGS
const LIVE_REFRESH = 20000;
const HOURLY_RANK = 60 * 60 * 1000;
const DELTA_WINDOW = 4 * 60 * 1000; // 4 წუთი
const TIMEOUT = 7000;

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

// 💾 STATE (never lost)
let state = {};
let ranked = [];
let history = {};

// 🔥 SAFE QUERY
async function queryServer(host, port) {
  try {
    return await Promise.race([
      Gamedig.query({ type: "cs16", host, port }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT)
      )
    ]);
  } catch {
    return null;
  }
}

// 📊 FETCH (PARTIAL UPDATE SYSTEM)
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = state[key];

      // ✅ IF DATA EXISTS → UPDATE
      if (data) {
        const players = data.players.length;

        state[key] = {
          ip: key,
          name: data.name || prev?.name || key,
          players,
          maxPlayers: data.maxplayers,
          map: data.map,
          online: true,
          lastSeen: Date.now()
        };
      } else if (prev) {
        // 🔥 KEEP OLD DATA (CRITICAL)
        state[key] = {
          ...prev,
          online: true // ვიზუალურად არ გავთიშოთ
        };
      } else {
        // პირველი load fallback
        state[key] = {
          ip: key,
          name: key,
          players: 0,
          maxPlayers: 0,
          map: "unknown",
          online: false,
          lastSeen: null
        };
      }

      const currentPlayers = state[key].players;

      // 🔥 HISTORY (for Δ)
      if (!history[key]) history[key] = [];

      history[key].push({
        time: Date.now(),
        players: currentPlayers
      });

      // წავშალოთ ძველი (4 წუთზე მეტი)
      history[key] = history[key].filter(
        h => Date.now() - h.time <= DELTA_WINDOW
      );

      // 🔥 DELTA CALCULATION
      const oldest = history[key][0];
      const delta = oldest ? currentPlayers - oldest.players : 0;

      return {
        ...state[key],
        change: delta
      };
    })
  );

  return results;
}

// 🏆 RANK
function applyRank(data) {
  return [...data]
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 LIVE UPDATE (NO RANK CHANGE)
async function liveUpdate() {
  const data = await fetchServers();

  ranked = ranked.map(r => {
    const updated = data.find(d => d.ip === r.ip);
    return updated ? { ...updated, rank: r.rank } : r;
  });
}

// 🏆 HOURLY RANK UPDATE
async function hourlyUpdate() {
  const data = await fetchServers();
  ranked = applyRank(data);

  console.log("🏆 Rank updated");
}

// 🚀 INIT
(async () => {
  const data = await fetchServers();
  ranked = applyRank(data);
})();

// LOOPS
setInterval(liveUpdate, LIVE_REFRESH);
setInterval(hourlyUpdate, HOURLY_RANK);

// API
app.get("/servers", (req, res) => {
  res.json(ranked);
});

// HEALTH
app.get("/", (req, res) => {
  res.send("STABLE CS SERVER SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
