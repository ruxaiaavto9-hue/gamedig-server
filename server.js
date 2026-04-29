const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 💾 cache
let cache = {
  data: [],
  time: 0
};

let rankedData = [];

// ⏱️ 3 HOURS refresh (rank update)
const REFRESH_TIME = 3 * 60 * 60 * 1000;

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

// 🔥 query function
async function queryServer(host, port, retries = 2) {
  try {
    return await Gamedig.query({
      type: "cs16",
      host,
      port
    });
  } catch (err) {
    if (retries > 0) {
      return await queryServer(host, port, retries - 1);
    }
    return null;
  }
}

// 🚀 FETCH ALL SERVERS
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const data = await queryServer(s.host, s.port);

      if (data) {
        return {
          ip: `${s.host}:${s.port}`,
          name: data.name || `${s.host}:${s.port}`,
          online: true,
          players: data.players.length,
          maxPlayers: data.maxplayers,
          map: data.map
        };
      }

      return {
        ip: `${s.host}:${s.port}`,
        name: `${s.host}:${s.port}`,
        online: false,
        players: 0,
        maxPlayers: 0,
        map: "offline"
      };
    })
  );

  return results;
}

// 🏆 RANK SYSTEM (TOP by players)
function generateRank(data) {
  return [...data]
    .sort((a, b) => b.players - a.players)
    .map((server, index) => ({
      ...server,
      rank: index + 1
    }));
}

// 🔄 refresh function (every 3 hours)
async function refreshData() {
  const servers = await fetchServers();

  const ranked = generateRank(servers);

  cache = {
    data: ranked,
    time: Date.now()
  };

  rankedData = ranked;

  console.log("🔄 Servers refreshed + ranked updated");
}

// 🚀 initial load
refreshData();

// ⏱️ every 3 hours refresh
setInterval(refreshData, REFRESH_TIME);

// 📡 API
app.get("/servers", (req, res) => {
  return res.json(cache.data);
});

// ❤️ health
app.get("/", (req, res) => {
  res.send("CS Server API + Rank System 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
