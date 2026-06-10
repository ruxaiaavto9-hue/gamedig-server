const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const http = require("http");
const { Server } = require("socket.io");

// ====================
// 🔌 FTP MODULE
// ====================
const ftp = require("basic-ftp");

// ====================
// 🟢 SUPABASE SAFE INIT
// ====================
let supabase = null;

try {
  const { createClient } = require("@supabase/supabase-js");

  supabase = createClient(
    process.env.SUPABASE_URL || "YOUR_SUPABASE_URL",
    process.env.SUPABASE_KEY || "YOUR_SUPABASE_KEY"
  );

  console.log("🟢 Supabase enabled");
} catch (e) {
  console.log("⚠️ Supabase not installed → fallback mode");
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
// 🎮 SERVERS LIST
// ====================
const serversList = [
  { host: "80.241.246.26", port: 222 },
  { host: "80.241.246.26", port: 226 },
  { host: "80.241.246.26", port: 27999 },
  { host: "80.241.246.26", port: 26 },
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 27777 },
  { host: "80.241.246.26", port: 27020 }
];

// ====================
let cache = {};
let rankedServers = {};
let adminConfig = {};

// ====================
// 🎮 GAMEDIG QUERY
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
// 📊 SCORE
// ====================
function calculateScore(data) {
  if (!data || data.length < 3) return 0.5;

  const total = data.reduce((s, d) => s + d.players, 0);
  const avg = total / data.length;
  const peak = Math.max(...data.map(d => d.players));

  return Number((avg * 0.7 + peak * 0.3).toFixed(2));
}

// ====================
// 🔄 UPDATE RANKS
// ====================
async function updateRanks() {
  await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      cache[key] = {
        ip: key,
        name: data?.name || "Unknown",
        players: data?.players?.length || 0,
        maxPlayers: data?.maxplayers || 32,
        map: data?.map || "unknown",
        online: !!data
      };
    })
  );

  rankedServers = Object.values(cache)
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  io.emit("servers_update", rankedServers);

  console.log("📊 Updated");
}

// ====================
// 🔌 FTP ANALYZER
// ====================
app.get("/api/plugins", async (req, res) => {
  const client = new ftp.Client();
  client.timeout = 10000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: process.env.FTP_PORT || 21,
      secure: false
    });

    const list = await client.list("/addons/amxmodx/plugins");

    const plugins = list.map(p => ({
      name: p.name,
      size: p.size,
      amxx: p.name.endsWith(".amxx"),
      sma: p.name.endsWith(".sma")
    }));

    res.json({
      success: true,
      count: plugins.length,
      plugins
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    client.close();
  }
});

// ====================
// 🌐 SERVERS API
// ====================
app.get("/servers", (req, res) => {
  res.json({ servers: rankedServers });
});

// ====================
// 🟢 ROOT
// ====================
app.get("/", (req, res) => {
  res.send("CS 1.6 SERVER + FTP ANALYZER RUNNING 🚀");
});

// ====================
(async () => {
  await updateRanks();
  console.log("🚀 SYSTEM READY");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
