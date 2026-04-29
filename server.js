const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ SETTINGS
const LIVE_REFRESH = 20000;
const HOURLY_RANK = 60 * 60 * 1000;
const DELTA_WINDOW = 4 * 60 * 1000;
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

// 💾 STATE
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

// 📊 FETCH
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = state[key];

      // ✅ UPDATE თუ მოვიდა data
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
        // 🔥 KEEP OLD DATA
        state[key] = {
          ...prev,
          online: true
        };
      } else {
        // fallback
        state[key] = {
          ip: key,
          name: key,
          players: 0,
          maxPlayers: 0,
          map: "unknown",
          online: false
        };
      }

      const currentPlayers = state[key].players;

      // 📊 HISTORY
      if (!history[key]) history[key] = [];

      history[key].push({
        time: Date.now(),
        players: currentPlayers
      });

      history[key] = history[key].filter(
        h => Date.now() - h.time <= DELTA_WINDOW
      );

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

// 🔄 LIVE UPDATE
async function liveUpdate() {
  const data = await fetchServers();

  ranked = ranked.map(r => {
    const updated = data.find(d => d.ip === r.ip);
    return updated ? { ...updated, rank: r.rank } : r;
  });
}

// 🏆 HOURLY RANK
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

// 📡 API (CRITICAL FIX HERE)
app.get("/servers", (req, res) => {
  const final = ranked.map((s, i) => ({
    ...s,
    order: i // 🔒 FORCE ORDER
  }));

  res.set("Cache-Control", "no-store"); // ❗ NO CACHE
  res.json(final);
});

// HEALTH
app.get("/", (req, res) => {
  res.send("FINAL STABLE SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
