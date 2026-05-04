const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const http = require("http");
const { Server } = require("socket.io");

const fs = require("fs");

// ====================
// 🟢 SUPABASE (SAFE LOAD)
// ====================
let supabase = null;

try {
  const { createClient } = require("@supabase/supabase-js");

  supabase = createClient(
    "YOUR_SUPABASE_URL",
    "YOUR_SUPABASE_KEY"
  );

  console.log("🟢 Supabase connected");
} catch (e) {
  console.log("⚠️ Supabase NOT active (fallback mode)");
}

// ====================
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

const UPDATE_INTERVAL = 20000;
const TIMEOUT = 8000;

// ====================
// 🎮 SERVERS
// ====================
const serversList = [
  { host: "80.241.246.26", port: 222 },
  { host: "80.241.246.26", port: 226 },
  { host: "80.241.246.26", port: 27999 },
  { host: "80.241.246.26", port: 26 },
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 27777 },
  { host: "80.241.246.26", port: 336 },
  { host: "80.241.246.26", port: 666 },
  { host: "80.241.246.26", port: 444 },
  { host: "80.241.246.26", port: 555 },
  { host: "80.241.246.26", port: 266 },
  { host: "80.241.246.26", port: 27020 },
  { host: "80.241.246.26", port: 27019 },
  { host: "80.241.246.26", port: 260 },
  { host: "80.241.246.26", port: 241 },
  { host: "80.241.246.26", port: 888 },
  { host: "80.241.246.26", port: 27446 },
  { host: "80.241.246.26", port: 27017 },
  { host: "80.241.246.26", port: 126 },
  { host: "80.241.246.26", port: 346 }
];

// ====================
// 💾 MEMORY CACHE
// ====================
let cache = {};
let rankedServers = {};

// ====================
// 🎮 GAMEDIG
// ====================
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

// ====================
// 💾 SAVE TO DB
// ====================
async function saveToDB(serverId, players) {
  if (!supabase) return;

  try {
    await supabase.from("server_stats").insert([
      {
        server_id: serverId,
        players,
        timestamp: Date.now()
      }
    ]);
  } catch {}
}

// ====================
// 📥 GET HISTORY (SAFE + FIX)
// ====================
async function getHistory(serverId) {
  if (!supabase) return [];

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const { data } = await supabase
    .from("server_stats")
    .select("*")
    .eq("server_id", serverId)
    .gte("timestamp", cutoff);

  return data || [];
}

// ====================
// 🧠 FIXED SCORE (IMPORTANT PART)
// ====================
function calculateScore(data) {
  if (!data || data.length === 0) {
    return 0.01; // 🔥 FIX: never 0 (prevents players-only ranking)
  }

  const total = data.reduce((sum, d) => sum + d.players, 0);
  const avg = total / data.length;

  const peak = Math.max(...data.map(d => d.players));

  const active = data.filter(d => d.players >= 5).length;
  const stability = active / data.length;

  // 🔥 MORE BALANCED FORMULA (prevents pure "current players wins")
  return Number(
    (
      avg * 0.55 +
      peak * 0.25 +
      stability * 10 +
      data.length * 0.02
    ).toFixed(2)
  );
}

// ====================
// 📊 UPDATE SYSTEM
// ====================
async function updateRanks() {
  await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = cache[key];
      const playersNow = data?.players?.length ?? prev?.players ?? 0;

      // 💾 SAVE HISTORY
      await saveToDB(key, playersNow);

      cache[key] = {
        ip: key,
        name: data?.name || prev?.name || "Unknown Server",
        players: playersNow,
        maxPlayers: data?.maxplayers ?? prev?.maxPlayers ?? 32,
        map: data?.map || prev?.map || "unknown",
        online: !!data,
        lastUpdate: Date.now()
      };
    })
  );

  const enriched = await Promise.all(
    Object.values(cache).map(async (s) => {
      const history = await getHistory(s.ip);

      const score = calculateScore(
        history.map(h => ({ players: h.players }))
      );

      return {
        ...s,
        score
      };
    })
  );

  rankedServers = enriched
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// ====================
// 🚀 INIT
// ====================
(async () => {
  await updateRanks();
  console.log("🚀 FIXED RANKING SYSTEM ONLINE");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
// 📡 API
// ====================
app.get("/servers", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ servers: rankedServers });
});

app.get("/", (req, res) => {
  res.send("FIXED CRASH SAFE CS SERVER SYSTEM 🚀");
});

// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
