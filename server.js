const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");
const http = require("http");
const { Server } = require("socket.io");

// ====================
// 🔌 FTP MODULE (SAFE LOAD)
// ====================
let ftp = null;
try {
  ftp = require("basic-ftp");
  console.log("🟢 FTP module loaded");
} catch (e) {
  console.log("⚠️ FTP module not installed");
}

// ====================
// 🟢 SUPABASE SAFE INIT
// ====================
let supabase = null;

try {
  const { createClient } = require("@supabase/supabase-js");

  supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_KEY || ""
  );

  console.log("🟢 Supabase enabled");
} catch (e) {
  console.log("⚠️ Supabase disabled");
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
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 27020 },
  { host: "80.241.246.26", port: 27019 },
  { host: "80.241.246.26", port: 260 }
];

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
// 📊 RANK LOGIC
// ====================
async function updateRanks() {
  await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      cache[key] = {
        ip: key,
        name: data?.name || "Unknown Server",
        players: data?.players?.length || 0,
        maxPlayers: data?.maxplayers || 32,
        map: data?.map || "unknown",
        online: !!data,
        lastUpdate: Date.now()
      };
    })
  );

  rankedServers = Object.values(cache)
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  io.emit("servers_update", rankedServers);
  console.log("📊 Ranking updated");
}

// ====================
// 🧠 SAFE FTP SCANNER
// ====================
async function safeList(client, path) {
  try {
    return await client.list(path);
  } catch {
    return [];
  }
}

// ====================
// 🧠 HEALTH FORMULA ENGINE
// ====================
function calculateHealth(scan) {

  let score = 100;

  score -= Math.min(scan.errors * 3, 30);
  score -= scan.plugins > 45 ? 10 : 0;
  score -= scan.modules < 4 ? 15 : 0;
  score -= scan.configs === 0 ? 20 : 0;
  score -= scan.logs > 1000 ? 10 : 0;
  score -= scan.maps < 5 ? 5 : 0;

  if (score < 0) score = 0;

  return {
    score,
    status:
      score > 80 ? "Stable" :
      score > 50 ? "Unstable" :
      "Critical"
  };
}

// ====================
// 🔥 FULL AMX ANALYZER (PRO)
// ====================
app.get("/api/amx-full-analyze", async (req, res) => {

  if (!ftp) {
    return res.json({
      success: false,
      error: "FTP not available"
    });
  }

  const client = new ftp.Client();
  client.timeout = 15000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false
    });

    // ====================
    // 📁 FULL SCAN (ALL AMX SYSTEM)
    // ====================
    const plugins = await safeList(client, "/addons/amxmodx/plugins");
    const configs = await safeList(client, "/addons/amxmodx/configs");
    const modules = await safeList(client, "/addons/amxmodx/modules");
    const logs = await safeList(client, "/addons/amxmodx/logs");
    const data = await safeList(client, "/addons/amxmodx/data");

    const metamod = await safeList(client, "/addons/metamod");
    const maps = await safeList(client, "/cstrike/maps");

    // ====================
    // ❌ ERROR FILTER
    // ====================
    const errorLogs = logs.filter(l =>
      l.name?.toLowerCase().includes("error") ||
      l.name?.toLowerCase().includes("warn") ||
      l.name?.toLowerCase().includes("crash")
    );

    // ====================
    // 🧠 CALCULATE HEALTH
    // ====================
    const health = calculateHealth({
      plugins: plugins.length,
      configs: configs.length,
      modules: modules.length,
      logs: logs.length,
      maps: maps.length,
      errors: errorLogs.length
    });

    // ====================
    // 📤 RESPONSE
    // ====================
    return res.json({
      success: true,

      scanned: {
        plugins: plugins.length,
        configs: configs.length,
        modules: modules.length,
        logs: logs.length,
        data: data.length,
        maps: maps.length,
        metamod: metamod.length,
        errors: errorLogs.length
      },

      healthScore: health.score,
      status: health.status,

      issues: [
        ...(plugins.length === 0 ? ["No plugins detected"] : []),
        ...(configs.length === 0 ? ["No configs detected"] : []),
        ...(modules.length < 4 ? ["Missing core modules"] : []),
        ...(errorLogs.length > 0 ? ["AMX error logs detected"] : [])
      ],

      fixes: [
        ...(errorLogs.length > 0 ? ["Check AMX logs"] : []),
        ...(plugins.length === 0 ? ["Verify plugins directory"] : [])
      ]
    });

  } catch (err) {
    return res.json({
      success: false,
      error: err.message
    });

  } finally {
    client.close();
  }
});

// ====================
// 📊 SERVERS API (UNCHANGED)
// ====================
app.get("/servers", (req, res) => {
  res.json({ servers: rankedServers });
});

// ====================
// 🟢 ROOT
// ====================
app.get("/", (req, res) => {
  res.send("CS 1.6 RANKING + PRO AMX FULL ANALYZER 🚀");
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
