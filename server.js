const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

// 🟢 SUPABASE
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  { host: "80.241.246.26", port: 27016 }
];

// ====================
// 💾 CACHE (fallback only)
// ====================
let cache = {};
let rankedServers = [];

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
// 🧠 SCORE FUNCTION
// ====================
function calculateScore(data) {
  if (!data || !data.length) return 0;

  const total = data.reduce((s, d) => s + d.players, 0);
  const avg = total / data.length;
  const peak = Math.max(...data.map(d => d.players));

  const active = data.filter(d => d.players >= 5).length;
  const stability = active / data.length;

  return Number((avg * 0.6 + peak * 0.3 + stability * 10).toFixed(2));
}

// ====================
// 💾 SAVE TO SUPABASE (CRASH SAFE)
// ====================
async function saveToDB(serverId, players) {
  await supabase.from("server_stats").insert([
    {
      server_id: serverId,
      players,
      timestamp: Date.now()
    }
  ]);
}

// ====================
// 📥 GET FROM SUPABASE (24h)
// ====================
async function getHistory(serverId) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const { data } = await supabase
    .from("server_stats")
    .select("*")
    .eq("server_id", serverId)
    .gte("timestamp", cutoff);

  return data || [];
}

// ====================
// 📊 UPDATE SERVERS
// ====================
async function updateRanks() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const playersNow = data?.players?.length ?? cache[key]?.players ?? 0;

      // 💾 save to DB (NO LOSS ON CRASH)
      await saveToDB(key, playersNow);

      const updated = {
        ip: key,
        players: playersNow,
        name: data?.name || "Unknown",
        map: data?.map || "unknown",
        online: !!data,
        lastUpdate: Date.now()
      };

      cache[key] = updated;
      return updated;
    })
  );

  // ====================
  // 🏆 RANKING FROM DB
  // ====================
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
  console.log("🚀 Crash-safe ranking system started");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
// 📡 API
// ====================
app.get("/servers", (req, res) => {
  res.json({ servers: rankedServers });
});

app.get("/", (req, res) => {
  res.send("CRASH-SAFE RANKING SYSTEM 🚀");
});

// ====================
// 🚀 START
// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
