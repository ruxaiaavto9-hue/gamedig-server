const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 💾 LAST KNOWN DATA (ძალიან მნიშვნელოვანი)
let lastGoodData = [];

// ⏱️ cache
let cache = {
  data: [],
  time: 0
};

const CACHE_TIME = 30 * 1000; // 30 sec (უფრო სტაბილურია)

// 📌 შენი სერვერები
const serversList = [
  { ip: "80.241.246.26", port: 222, name: "Server 1" },
  // დაამატე აქ დანარჩენები
];

// 🔥 safe query with timeout + retry
async function queryServer(ip, port, retries = 2) {
  try {
    return await Promise.race([
      Gamedig.query({
        type: "cs16",
        host: ip,
        port: port
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      )
    ]);
  } catch (err) {
    if (retries > 0) {
      return await queryServer(ip, port, retries - 1);
    }
    return null;
  }
}

// 🚀 MAIN API
app.get("/servers", async (req, res) => {
  const now = Date.now();

  // ✅ cache return
  if (cache.data.length > 0 && now - cache.time < CACHE_TIME) {
    return res.json(cache.data);
  }

  const results = await Promise.all(
    serversList.map(async (server) => {
      const data = await queryServer(server.ip, server.port);

      // 🟢 ONLINE
      if (data) {
        return {
          ip: `${server.ip}:${server.port}`,
          name: data.name || server.name,
          online: true,
          players: data.players.length,
          maxPlayers: data.maxplayers,
          map: data.map
        };
      }

      // 🔴 OFFLINE (მაგრამ არ ქრება!)
      return {
        ip: `${server.ip}:${server.port}`,
        name: server.name,
        online: false,
        players: 0,
        maxPlayers: 0,
        map: "offline"
      };
    })
  );

  // 💾 cache update
  cache = {
    data: results,
    time: Date.now()
  };

  // 💡 last known good state backup
  if (results.length > 0) {
    lastGoodData = results;
  }

  // 🚨 თუ რამე გაფუჭდა → ძველი მონაცემი დააბრუნე
  if (!results || results.length === 0) {
    return res.json(lastGoodData);
  }

  res.json(results);
});

// ❤️ wake-up endpoint (Render fix)
app.get("/", (req, res) => {
  res.send("CS Server API Running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
