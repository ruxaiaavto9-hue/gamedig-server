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
// 📊 RANK LOGIC (UNCHANGED)
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

// =======================================================
// 🔥 NEW: AMX FULL ANALYZER ENGINE (SAFE ADDITION)
// =======================================================

function analyzeAMX(plugins = [], logs = [], errors = []) {

  let report = {
    pluginCount: plugins.length,
    errorCount: errors.length,
    warnings: [],
    score: 100
  };

  // ❗ too many plugins
  if (plugins.length > 40) {
    report.warnings.push("Too many plugins may cause lag");
    report.score -= 10;
  }

  // ❗ missing core plugins
  const pluginNames = plugins.map(p => p.name || "");

  if (!pluginNames.some(p => p.includes("admin"))) {
    report.warnings.push("Admin plugin missing or broken");
    report.score -= 20;
  }

  // ❗ error spikes
  if (errors.length > 0) {
    report.warnings.push("AMX errors detected in logs");
    report.score -= errors.length * 5;
  }

  // ❗ suspicious logs
  const lagPatterns = logs.filter(l =>
    l.includes("warning") ||
    l.includes("error") ||
    l.includes("cpu") ||
    l.includes("overflow")
  );

  if (lagPatterns.length > 0) {
    report.warnings.push("Possible performance issues detected");
    report.score -= 15;
  }

  if (report.score < 0) report.score = 0;

  return report;
}

// ====================
// 🔥 NEW API: FULL AMX SCAN
// ====================
app.get("/api/amx-scan", async (req, res) => {

  if (!ftp) {
    return res.json({
      success: false,
      error: "FTP not available"
    });
  }

  const client = new ftp.Client();
  client.timeout = 10000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false
    });

    // 📁 PLUGINS
    const pluginsRaw = await client.list("/addons/amxmodx/plugins");

    const plugins = pluginsRaw.map(p => ({
      name: p.name,
      type: p.name.split(".").pop()
    }));

    // 📁 LOGS
    let logs = [];
    try {
      const logFiles = await client.list("/cstrike/logs");
      logs = logFiles.map(l => l.name);
    } catch {}

    // ❌ ERROR LOGS
    let errors = [];
    try {
      const errFiles = await client.list("/addons/amxmodx/logs");
      errors = errFiles.map(e => e.name);
    } catch {}

    // 🧠 ANALYZE
    const analysis = analyzeAMX(plugins, logs, errors);

    res.json({
      success: true,
      pluginsCount: plugins.length,
      logsCount: logs.length,
      errorsCount: errors.length,
      plugins,
      analysis
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
// 📊 EXISTING API (UNCHANGED)
// ====================
app.get("/servers", (req, res) => {
  res.json({ servers: rankedServers });
});

// ====================
// 🟢 ROOT
// ====================
app.get("/", (req, res) => {
  res.send("CS 1.6 RANKING + FULL AMX ANALYZER 🚀");
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
