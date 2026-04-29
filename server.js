const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱ SETTINGS
const LIVE_REFRESH = 20000;
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

// 💾 STATE (only raw data)
let state = {};
let history = {};

// 🔥 QUERY FUNCTION
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

// 📊 UPDATE ALL SERVERS STATE
async function updateState() {
  await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);
      const prev = state[key];

      if (data) {
        state[key] = {
          ip: key,
          name: data.name || key,
          players: data.players?.length || 0,
          maxPlayers: data.maxplayers || 0,
          map: data.map || "unknown",
          online: true,
          lastSeen: Date.now()
        };
      } else {
        state[key] = {
          ip: key,
          name: prev?.name || key,
          players: 0,
          maxPlayers: prev?.maxPlayers || 0,
          map: "offline",
          online: false
        };
      }

      // HISTORY (optional analytics)
      if (!history[key]) history[key] = [];

      history[key].push({
        time: Date.now(),
        players: state[key].players
      });

      history[key] = history[key].filter(
        h => Date.now() - h.time <= DELTA_WINDOW
      );
    })
  );
}

// 🏆 STABLE RANK CALCULATION (IMPORTANT)
function getRankedServers() {
  return Object.values(state)
    .sort((a, b) => {
      // primary sort: players
      if (b.players !== a.players) return b.players - a.players;

      // secondary sort: IP (fixes random browser differences)
      return a.ip.localeCompare(b.ip);
    })
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 AUTO UPDATE LOOP
setInterval(updateState, LIVE_REFRESH);
updateState(); // initial load

// 📡 API
app.get("/servers", (req, res) => {
  const ranked = getRankedServers();

  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  res.json(ranked);
});

// 🧪 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("CS SERVER API RUNNING 🚀");
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
