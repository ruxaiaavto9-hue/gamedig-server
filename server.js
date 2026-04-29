const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱ SETTINGS
const TIMEOUT = 8000;
const REFRESH = 20000;

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
let cache = [];
let isReady = false;
let loadingProgress = 0;

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

// 📊 BUILD SNAPSHOT (WITH PROGRESS)
async function buildSnapshot() {
  loadingProgress = 0;
  const total = serversList.length;

  const results = [];

  for (let i = 0; i < serversList.length; i++) {
    const s = serversList[i];

    const data = await queryServer(s.host, s.port);

    results.push({
      ip: `${s.host}:${s.port}`,
      name: data?.name || "Loading Server...",
      players: data?.players?.length || 0,
      maxPlayers: data?.maxplayers || 32,
      map: data?.map || "unknown",
      online: !!data
    });

    loadingProgress = Math.round(((i + 1) / total) * 100);
  }

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
}

// 🚀 INIT (PRELOAD BEFORE USERS SEE DATA)
(async () => {
  console.log("⏳ Loading servers...");
  await buildSnapshot();
  console.log("🚀 READY");
})();

// 🔄 REFRESH LOOP
setInterval(buildSnapshot, REFRESH);

// 📡 API (LOADING STATE INCLUDED)
app.get("/servers", (req, res) => {
  res.set("Cache-Control", "no-store");

  // ⛔ NOT READY YET
  if (!isReady) {
    return res.json({
      loading: true,
      progress: loadingProgress,
      message: "Loading servers..."
    });
  }

  res.json({
    loading: false,
    progress: 100,
    servers: cache
  });
});

// 🧪 HEALTH
app.get("/", (req, res) => {
  res.send("LOADING SYSTEM READY 🚀");
});

app.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
