const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const http = require("http");
const { Server } = require("socket.io");

// ====================
// 🟢 SUPABASE SAFE INIT
// ====================
let supabase = null;

try {
  const { createClient } = require("@supabase/supabase-js");

  supabase = createClient(
    "YOUR_SUPABASE_URL",
    "YOUR_SUPABASE_KEY"
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
let cache = {};
let rankedServers = {};
let adminConfig = {};

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
// 💾 SAFE DB INSERT
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
// 📥 HISTORY
// ====================
async function getHistory(serverId) {
  if (!supabase) return [];

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const { data } = await supabase
      .from("server_stats")
      .select("players,timestamp")
      .eq("server_id", serverId)
      .gte("timestamp", cutoff);

    return data || [];
  } catch {
    return [];
  }
}

// ====================
function calculateScore(data) {
  if (!data || data.length < 3) return 0.5;

  const total = data.reduce((s, d) => s + d.players, 0);
  const avg = total / data.length;

  const peak = Math.max(...data.map(d => d.players));
  const active = data.filter(d => d.players >= 5).length;
  const stability = active / data.length;

  return Number(
    (avg * 0.55 + peak * 0.25 + stability * 10 + data.length * 0.01).toFixed(2)
  );
}

// ====================
// 🔥 LOAD ADMIN CONFIG
// ====================
async function loadAdminConfig() {
  if (!supabase) return;

  try {
    const { data } = await supabase.from("servers_config").select("*");

    adminConfig = {};
    (data || []).forEach(row => {
      adminConfig[row.server_id] = row;
    });

    console.log("🔄 ADMIN CONFIG LOADED");
  } catch {
    console.log("⚠️ config load failed");
  }
}

// ====================
// 📊 UPDATE SYSTEM (FIXED SYNC)
// ====================
async function updateRanks() {
  await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = cache[key];
      const playersNow = data?.players?.length ?? prev?.players ?? 0;

      saveToDB(key, playersNow);

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
      const score = calculateScore(history);

      return {
        ...s,
        score,
        boost: adminConfig[s.ip]?.boost || false,
        pinned: adminConfig[s.ip]?.pinned || 0
      };
    })
  );

  rankedServers = enriched
    .sort((a, b) => {
      if (a.pinned && b.pinned) return a.pinned - b.pinned;
      if (a.pinned) return -1;
      if (b.pinned) return 1;

      const boostA = a.boost ? 1000 : 0;
      const boostB = b.boost ? 1000 : 0;

      return (b.score + boostB) - (a.score + boostA);
    })
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));

  // 🔥 FORCE SYNC SIGNAL
  io.emit("servers_update", rankedServers);

  console.log("📊 RANKS UPDATED + SYNCED");
}

// ====================
// 🔐 SAVE API (UNCHANGED LOGIC)
// ====================
app.post("/api/admin/save", async (req, res) => {
  const { changes, nickname } = req.body;

  if (nickname !== "giusha$$") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!supabase) {
    return res.json({ success: false });
  }

  try {
    for (const change of changes) {
      const serverId = change.serverId;

      await supabase
        .from("servers_config")
        .upsert(
          {
            server_id: serverId,
            boost: change.type === "boost" ? change.value : undefined,
            pinned: change.type === "pin" ? change.value : undefined
          },
          { onConflict: "server_id" }
        );
    }

    // 🔥 IMPORTANT FIX: reload + refresh immediately
    await loadAdminConfig();
    await updateRanks();

    res.json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Save failed" });
  }
});

// ====================
// 🌐 API (NO CACHE FIX)
// ====================
app.get("/servers", (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  res.json({ servers: rankedServers });
});

// ====================
app.get("/", (req, res) => {
  res.send("STABLE 24H CS SERVER RANKING 🚀");
});

// ====================
(async () => {
  await loadAdminConfig();
  await updateRanks();
  console.log("🚀 SYSTEM READY WITH ADMIN CONTROL");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
