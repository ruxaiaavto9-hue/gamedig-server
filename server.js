const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// ⏱️ SETTINGS
const LIVE_REFRESH = 20000;          // live update (20 sec)
const HOURLY_RANK_UPDATE = 60 * 60 * 1000; // 1 hour
const TIMEOUT = 4500;

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
let state = {};
let ranked = [];

// 🧠 INITIAL SNAPSHOT (for 6H Δ baseline)
let baseline = {};
let hourSnapshot = {};

// 🔥 SAFE QUERY
async function queryServer(host, port) {
  try {
    return await Promise.race([
      Gamedig.query({
        type: "cs16",
        host,
        port
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT)
      )
    ]);
  } catch {
    return null;
  }
}

// 📊 FETCH SERVERS
async function fetchServers() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const players = data?.players?.length || 0;

      // 🟢 init baseline once
      if (baseline[key] === undefined) {
        baseline[key] = players;
      }

      return {
        ip: key,
        name: data?.name || key,
        players,
        maxPlayers: data?.maxplayers || 0,
        map: data?.map || "offline",
        online: !!data,

        // 🔥 LIVE CHANGE (6H Δ)
        change: players - baseline[key]
      };
    })
  );

  return results;
}

// 🏆 HOURLY RANK (ONLY ONCE PER HOUR)
function applyRank(data) {
  return [...data]
    .sort((a, b) => b.players - a.players)
    .map((s, i) => ({
      ...s,
      rank: i + 1
    }));
}

// 🔄 LIVE UPDATE (NO RANK CHANGE HERE)
async function liveUpdate() {
  const data = await fetchServers();
  state = data;

  // ⚡ DO NOT CHANGE RANK HERE
  // only live Δ updates
}

// 🏁 HOURLY RANK UPDATE (THIS MOVES POSITIONS)
async function hourlyRankUpdate() {
  const data = await fetchServers();

  ranked = applyRank(data);

  console.log("🏆 HOURLY RANK UPDATED");
}

// 🚀 INIT
(async () => {
  const data = await fetchServers();
  state = data;
  ranked = applyRank(data);

  // snapshot for 6H Δ stability
  data.forEach(s => {
    hourSnapshot[s.ip] = s.players;
  });
})();

// 🔄 LIVE LOOP (Δ ONLY)
setInterval(liveUpdate, LIVE_REFRESH);

// 🏆 HOURLY RANK LOOP
setInterval(hourlyRankUpdate, HOURLY_RANK_UPDATE);

// 📡 API (UNIFIED FOR ALL DEVICES)
app.get("/servers", (req, res) => {
  // merge rank + live
  const merged = state.map(s => {
    const r = ranked.find(x => x.ip === s.ip);

    return {
      ...s,
      rank: r?.rank || 0
    };
  });

  res.json(merged);
});

// ❤️ health
app.get("/", (req, res) => {
  res.send("HOURLY RANK + LIVE Δ SYSTEM 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
