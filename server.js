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

// ====================
// 🧠 FULL AMX ANALYZER ENGINE (NEW)
// ====================
function analyzeFullAMX(plugins = [], logs = [], errors = []) {

  let issues = [];
  let fixes = [];
  let score = 100;

  // 🔌 PLUGINS
  if (plugins.length > 35) {
    issues.push("High plugin count may cause server lag");
    fixes.push("Remove unused plugins");
    score -= 15;
  }

  const names = plugins.map(p => p.name || "");

  if (!names.some(n => n.includes("admin"))) {
    issues.push("Admin plugin missing or broken");
    fixes.push("Reinstall admin.amxx");
    score -= 20;
  }

  if (names.filter(n => n.includes("debug")).length > 2) {
    issues.push("Debug plugins detected");
    fixes.push("Disable debug plugins");
    score -= 10;
  }

  // ❌ ERRORS
  if (errors.length > 0) {
    issues.push(`AMX errors detected: ${errors.length}`);
    fixes.push("Check AMX error logs");
    score -= errors.length * 5;
  }

  // 📉 LOG LAG DETECTION
  const lagSignals = logs.filter(l =>
    l.includes("warning") ||
    l.includes("error") ||
    l.includes("overflow") ||
    l.includes("cpu") ||
    l.includes("timeout") ||
    l.includes("assert")
  );

  if (lagSignals.length > 10) {
    issues.push("Log spam causing instability");
    fixes.push("Reduce logging / disable heavy plugins");
    score -= 20;
  }

  if (score < 0) score = 0;

  return {
    healthScore: score,
    status:
      score > 80 ? "Stable" :
      score > 50 ? "Unstable" :
      "Critical",
    issues,
    fixes
  };
}

// ====================
// 🔥 FULL AMX ANALYZER API (NEW)
// ====================
app.get("/api/amx-full-analyze", async (req, res) => {

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
    const plugins = pluginsRaw.map(p => ({ name: p.name }));

    // 📁 LOGS
    let logs = [];
    try {
      const logFiles = await client.list("/cstrike/logs");
      logs = logFiles.map(l => l.name);
    } catch {}

    // ❌ ERRORS
    let errors = [];
    try {
      const errFiles = await client.list("/addons/amxmodx/logs");
      errors = errFiles.map(e => e.name);
    } catch {}

    // 🧠 ANALYSIS
    const analysis = analyzeFullAMX(plugins, logs, errors);

    res.json({
      success: true,
      scanned: {
        plugins: plugins.length,
        logs: logs.length,
        errors: errors.length
      },
      analysis
    });

  } catch (err) {
    res.json({
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
