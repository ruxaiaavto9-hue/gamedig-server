const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const http = require("http");
const { Server } = require("socket.io");

const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

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
// 💾 CACHE + 24H DATA
// ====================
let cache = {};
let rankedServers = {};
let stats24h = {};

// ====================
// 💬 CHAT STORAGE
// ====================
const CHAT_FILE = "./chat.json";
const MAX_MESSAGES = 50;
const MESSAGE_COOLDOWN = 2000;

function loadChat() {
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE));
  } catch {
    return [];
  }
}

function saveChat(data) {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data));
}

let chatMessages = loadChat();
let userCooldowns = {};

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
// 🧠 SCORE FUNCTION
// ====================
function calculateScore(data) {
  if (!data || !data.length) return 0;

  const total = data.reduce((sum, d) => sum + d.players, 0);
  const avg = total / data.length;

  const peak = Math.max(...data.map(d => d.players));

  const active = data.filter(d => d.players >= 5).length;
  const stability = active / data.length;

  return Number((avg * 0.6 + peak * 0.3 + stability * 10).toFixed(2));
}

// ====================
// 📊 UPDATE SERVERS
// ====================
async function updateRanks() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = cache[key];

      const playersNow = data?.players?.length ?? prev?.players ?? 0;

      // init history
      if (!stats24h[key]) stats24h[key] = [];

      // add record
      stats24h[key].push({
        players: playersNow,
        timestamp: Date.now()
      });

      // remove old (24h)
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      stats24h[key] = stats24h[key].filter(d => d.timestamp > cutoff);

      const updated = {
        ip: key,
        name: data?.name || prev?.name || "Unknown Server",
        players: playersNow,
        maxPlayers: data?.maxplayers ?? prev?.maxPlayers ?? 32,
        map: data?.map || prev?.map || "unknown",
        online: data ? true : (prev?.online ?? false),
        lastUpdate: Date.now()
      };

      cache[key] = updated;
      return updated;
    })
  );

  // ====================
  // 🏆 RANKING BY SCORE
  // ====================
  rankedServers = Object.values(cache)
    .map(s => {
      const history = stats24h[s.ip] || [];
      const score = calculateScore(history);

      return {
        ...s,
        score
      };
    })
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
  console.log("🚀 Initial load done");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
// 💬 SOCKET.IO CHAT
// ====================
io.on("connection", (socket) => {
  socket.emit("chat_history", chatMessages);

  socket.on("send_message", ({ nickname, message }) => {
    const now = Date.now();
    const last = userCooldowns[socket.id] || 0;

    if (now - last < MESSAGE_COOLDOWN) {
      socket.emit("spam_warning", "Wait 2 sec");
      return;
    }

    userCooldowns[socket.id] = now;

    const msg = {
      nickname: nickname.slice(0, 16),
      message: message.slice(0, 150),
      time: now
    };

    chatMessages.push(msg);

    if (chatMessages.length >= MAX_MESSAGES) {
      chatMessages = [];
      saveChat(chatMessages);
      io.emit("chat_clear");
      return;
    }

    saveChat(chatMessages);
    io.emit("new_message", msg);
  });

  socket.on("disconnect", () => {
    delete userCooldowns[socket.id];
  });
});

// ====================
// 📡 API
// ====================
app.get("/servers", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ servers: rankedServers });
});

app.get("/chat", (req, res) => {
  res.json({ messages: chatMessages });
});

app.get("/", (req, res) => {
  res.send("NO DROP STABLE SERVER SYSTEM 🚀 + 24H RANKING SYSTEM");
});

// ====================
// 🚀 START
// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
