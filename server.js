const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱ SETTINGS
const LIVE_REFRESH = 20000;
const TIMEOUT = 8000;

// 📌 REAL SERVERS
const serversList = [
  { host: "80.241.246.26", port: 222, name: "CS 1.6 | Public #1" },
  { host: "80.241.246.26", port: 226, name: "CS 1.6 | Dust2 Only" },
  { host: "80.241.246.26", port: 27999, name: "CS 1.6 | Jailbreak" },
  { host: "80.241.246.26", port: 26, name: "CS 1.6 | AWP Arena" },
  { host: "80.241.246.26", port: 27016, name: "CS 1.6 | Deathmatch" },
  { host: "80.241.246.26", port: 336, name: "CS 1.6 | Classic Mix" },
  { host: "80.241.246.26", port: 27446, name: "CS 1.6 | Public #2" },
  { host: "80.241.246.26", port: 27017, name: "CS 1.6 | Fun Server" },
  { host: "80.241.246.26", port: 126, name: "CS 1.6 | Pro Players" },
  { host: "80.241.246.26", port: 346, name: "CS 1.6 | Hardcore" }
];

// 💾 ALWAYS READY CACHE (CRITICAL FIX)
let cache = [];
let isReady = false;

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

// 📊 BUILD SNAPSHOT
async function buildSnapshot() {
  const results = await Promise.all(
    serversList.map(async (s, index) => {
      const data = await queryServer(s.host, s.port);

      const players = data?.players?.length || 0;

      return {
        ip: `${s.host}:${s.port}`,
        name: s.name,
        players: players,
        maxPlayers: data?.maxplayers || 32,
        map: data?.map || "unknown",
        online: !!data,
        rank: index + 1
      };
    })
  );

  // sort by players (stable)
  cache = results
    .sort((a, b) => {
      if (b.players !== a.players) return b.players - a.players;
      return a.ip.localeCompare(b.ip);
    })
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));

  isReady = true;
  console.log("✅ Snapshot updated");
}

// 🚀 INIT (NO 0 ONLINE FLASH FIX)
(async () => {
  console.log("⏳ Loading servers...");

  await buildSnapshot(); // preload BEFORE requests allowed

  console.log("🚀 READY (no empty state)");
})();

// 🔄 REFRESH LOOP
setInterval(buildSnapshot, LIVE_REFRESH);

// 📡 API (INSTANT RESPONSE)
app.get("/servers", (req, res) => {
  // 🚨 NEVER show loading state
  if (!isReady || cache.length === 0) {
    return res.json(cache);
  }

  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });

  res.json(cache);
});

// 🧪 HEALTH
app.get("/", (req, res) => {
  res.send("STABLE CS 1.6 SERVER LIST 🚀");
});

// 🚀 START
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
