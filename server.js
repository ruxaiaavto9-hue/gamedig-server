const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔥 Cache (ძალიან მნიშვნელოვანი)
let cache = {
  data: [],
  lastUpdate: 0
};

// ⏱️ Cache time (60 წამი)
const CACHE_TIME = 60 * 1000;

// 🧠 Retry function
async function queryServer(ip, port, retries = 2) {
  try {
    return await Gamedig.query({
      type: "cs16",
      host: ip,
      port: port
    });
  } catch (err) {
    if (retries > 0) {
      return await queryServer(ip, port, retries - 1);
    }
    return null;
  }
}

// 📡 შენი სერვერების სია (აქ დაამატე შენი IP-ები)
const serversList = [
  { ip: "80.241.246.26", port: 222, name: "Server 222" },
  // დაამატე სხვა სერვერები აქ
];

// 🚀 მთავარი endpoint
app.get("/servers", async (req, res) => {
  const now = Date.now();

  // ✅ 1. თუ cache ჯერ ვალიდურია → დაბრუნება
  if (cache.data.length > 0 && now - cache.lastUpdate < CACHE_TIME) {
    return res.json(cache.data);
  }

  let results = [];

  // 🔁 ყველა სერვერზე შემოწმება
  for (const server of serversList) {
    const data = await queryServer(server.ip, server.port);

    if (data) {
      results.push({
        ip: `${server.ip}:${server.port}`,
        name: server.name,
        online: true,
        players: data.players.length,
        maxPlayers: data.maxplayers,
        map: data.map
      });
    } else {
      // ❗ თუ offline არის → არ ვშლით, უბრალოდ ვანიშნებთ
      results.push({
        ip: `${server.ip}:${server.port}`,
        name: server.name,
        online: false,
        players: 0,
        maxPlayers: 0,
        map: "offline"
      });
    }
  }

  // 💾 cache update
  cache = {
    data: results,
    lastUpdate: Date.now()
  };

  // ❗ თუ API ჩავარდა → ძველი cache მაინც ინარჩუნებს
  if (!results || results.length === 0) {
    return res.json(cache.data);
  }

  res.json(results);
});

// ❤️ health check (Render wake-up fix)
app.get("/", (req, res) => {
  res.send("CS Server API is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
