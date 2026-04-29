const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱ SETTINGS
const UPDATE_INTERVAL = 20000;
const TIMEOUT = 8000;

// 📌 SERVERS (REAL NAMES FROM GAME SERVER)
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

// 💾 PERSISTED LEADERBOARD
let rankedServers = [];
let lastUpdate = null;

// 🔥 QUERY SERVER
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

// 📊 UPDATE RANKS (ONLY HERE CALCULATED)
async function updateRanks() {
  console.log("🔄 Updating leaderboard...");

  const results = await Promise.all(
    serversList.map(async (s) => {
      const data = await queryServer(s.host, s.port);

      return {
        ip: `${s.host}:${s.port}`,
        name: data?.name || "Unknown Server",
        players: data?.players?.length || 0,
        maxPlayers: data?.maxplayers || 32,
        map: data?.map || "unknown",
        online: !!data
      };
    })
  );

  // 🏆 SORT + ASSIGN RANK
  rankedServers = results
    .sort((a, b) => {
      if (b.players !== a.players) return b.players - a.players;
      return a.ip.localeCompare(b.ip);
    })
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));

  lastUpdate = Date.now();

  console.log("✅ Leaderboard updated");
}

// 🚀 INITIAL LOAD
(async () => {
  await updateRanks();
})();

// 🔄 AUTO UPDATE LOOP
setInterval(updateRanks, UPDATE_INTERVAL);

// 📡 API (NO RECALC HERE)
app.get("/servers", (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  res.json({
    lastUpdate,
    servers: rankedServers
  });
});

// 🧪 HEALTH CHECK
app.get("/", (req, res) => {
  res.send("STABLE CS 1.6 RANK SYSTEM 🚀");
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
