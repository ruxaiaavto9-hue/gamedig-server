const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 🟢 HEALTH
app.get("/", (req, res) => {
  res.send("CS 1.6 API LIVE 🚀");
});

// 🔥 SERVERS
const servers = [
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

// 🧠 CACHE (anti spam + anti freeze)
let cache = [];
let lastFetch = 0;

// ⏱ timeout wrapper
function timeout(ms) {
  return new Promise(res => setTimeout(() => res(null), ms));
}

// 🔁 SAFE QUERY
async function safeQuery(server) {
  try {
    return await Promise.race([
      Gamedig.query({
        type: "cs16",
        host: server.host,
        port: server.port,
        socketTimeout: 4000,
        attemptTimeout: 4000
      }),
      timeout(6000)
    ]);
  } catch {
    return null;
  }
}

// 🔥 FETCH ALL (FAST + SAFE)
async function fetchServers() {
  // cache 15 sec
  if (Date.now() - lastFetch < 15000 && cache.length) {
    return cache;
  }

  const results = await Promise.all(
    servers.map(async (s) => {
      const state = await safeQuery(s);

      const key = `${s.host}:${s.port}`;

      const players = state?.players?.length ??
                       state?.raw?.numplayers ??
                       0;

      return {
        name: state?.name || `Server ${s.port}`,
        ip: key,
        online: !!state,
        players,
        maxPlayers: state?.maxplayers || 0,
        map: state?.map || "offline"
      };
    })
  );

  cache = results;
  lastFetch = Date.now();

  return results;
}

// 📊 ROUTES
app.get("/servers", async (req, res) => {
  try {
    const data = await fetchServers();
    res.json(data);
  } catch (e) {
    res.json(cache || []); // fallback → NEVER empty crash
  }
});

// 🏆 TOP
app.get("/top-servers", async (req, res) => {
  try {
    const data = await fetchServers();
    const sorted = [...data].sort((a, b) => b.players - a.players);
    res.json(sorted.slice(0, 5));
  } catch {
    res.json([]);
  }
});

// 🚀 START
app.listen(PORT, () => {
  console.log("CS API running on port", PORT);
});
