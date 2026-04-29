const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱ SETTINGS
const UPDATE_INTERVAL = 20000;
const TIMEOUT = 8000;

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

// 💾 CACHE
let rankedServers = [];
let loadingState = {
  total: serversList.length,
  checked: 0,
  remaining: serversList.length,
  loading: true
};

// 🔥 QUERY
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

// 🎯 CUSTOM RANK LOGIC (NO #1 #2 SYSTEM)
function calculateScore(players) {
  // 1000 base - players influence
  return Math.max(0, 1000 - players * 10);
}

// 📊 UPDATE SYSTEM
async function updateRanks() {
  loadingState.checked = 0;
  loadingState.remaining = serversList.length;
  loadingState.loading = true;

  const results = [];

  for (let s of serversList) {
    const data = await queryServer(s.host, s.port);

    const players = data?.players?.length || 0;

    results.push({
      ip: `${s.host}:${s.port}`,
      name: data?.name || "Unknown Server",
      players,
      maxPlayers: data?.maxplayers || 32,
      map: data?.map || "unknown",
      online: !!data,
      score: calculateScore(players)
    });

    loadingState.checked++;
    loadingState.remaining--;
  }

  // 📉 sort by SCORE (LOWER players = lower score logic)
  rankedServers = results.sort((a, b) => a.score - b.score);

  loadingState.loading = false;
}

// 🚀 INIT
(async () => {
  await updateRanks();
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// 📡 API
app.get("/servers", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    loading: loadingState.loading,
    progress: {
      total: loadingState.total,
      checked: loadingState.checked,
      remaining: loadingState.remaining
    },
    servers: rankedServers
  });
});

// 🧪 HEALTH
app.get("/", (req, res) => {
  res.send("HYBRID SCORE SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
