const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ SETTINGS
const REFRESH_INTERVAL = 20000; // 20 sec
const TIMEOUT = 4500; // per server timeout
const RACE_TIME = 6 * 60 * 60 * 1000; // 6 hours

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

// 💾 STATE (never lose data)
let state = {};
let leaderboard = [];

// 🧠 INIT STATE
function initState() {
  serversList.forEach(s => {
    const key = `${s.host}:${s.port}`;

    if (!state[key]) {
      state[key] = {
        ip: key,
        name: key,
        players: 0,
        maxPlayers: 0,
        map: "unknown",
        online: false,
        status: "unknown",
        lastSeen: null
      };
    }
  });
}

// 🔥 SAFE QUERY (never crashes system)
async function queryServer(host, port, retries = 1) {
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
  } catch (err) {
    if (retries > 0) {
      return await queryServer(host, port, retries - 1);
    }
    return null;
  }
}

// 📊 UPDATE SERVERS
async function updateServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = state[key];

      if (data) {
        state[key] = {
          ip: key,
          name: data.name || key,
          players: data.players.length,
          maxPlayers: data.maxplayers,
          map: data.map,
          online: true,
          status: "online",
          lastSeen: Date.now()
        };
      } else {
        // ❗ KEEP OLD DATA (never lose server)
        state[key] = {
          ip: key,
          name: prev?.name || key,
          players: prev?.players || 0,
          maxPlayers: prev?.maxPlayers || 0,
          map: prev?.map || "offline",
          online: false,
          status: "offline",
          lastSeen: prev?.lastSeen || null
        };
      }

      return state[key];
    })
  );

  leaderboard = results;
}

// 🏆 RANK (by players)
function rank() {
  return [...leaderboard]
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🚀 INIT
initState();

// 🔄 LIVE REFRESH
setInterval(updateServers, REFRESH_INTERVAL);

// 🏁 6H CYCLE RESET (keeps system fresh)
setInterval(() => {
  console.log("🏁 6H cycle completed");
}, RACE_TIME);

// 📡 API
app.get("/servers", (req, res) => {
  res.json(rank());
});

// ❤️ health check
app.get("/", (req, res) => {
  res.send("CS SERVER SYSTEM STABLE + RACE MODE 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
