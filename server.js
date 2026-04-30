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
  { host: "80.241.246.26", port: 336 },
  { host: "80.241.246.26", port: 27446 },
  { host: "80.241.246.26", port: 27017 },
  { host: "80.241.246.26", port: 126 },
  { host: "80.241.246.26", port: 346 }
];

// ====================
// 💾 CACHE SYSTEM
// ====================
let cache = {};
let rankedServers = [];

// ====================
// 💬 CHAT STORAGE (PERSISTENT FIX)
// ====================
const CHAT_FILE = "./chat.json";
const MAX_MESSAGES = 50;
const MESSAGE_COOLDOWN = 2000;

// load chat from file
function loadChat() {
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE));
  } catch {
    return [];
  }
}

// save chat to file
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
// 📊 UPDATE SERVERS
// ====================
async function updateRanks() {
  const results = await Promise.all(
    serversList.map(async (s) => {
      const key = `${s.host}:${s.port}`;
      const data = await queryServer(s.host, s.port);

      const prev = cache[key];

      const updated = {
        ip: key,
        name: data?.name || prev?.name || "Unknown Server",
        players: data?.players?.length ?? prev?.players ?? 0,
        maxPlayers: data?.maxplayers ?? prev?.maxPlayers ?? 32,
        map: data?.map || prev?.map || "unknown",
        online: data ? true : (prev?.online ?? false),
        lastUpdate: data ? Date.now() : (prev?.lastUpdate || Date.now())
      };

      cache[key] = updated;
      return updated;
    })
  );

  rankedServers = Object.values(cache)
    .sort((a, b) => {
      if (b.players !== a.players) return b.players - a.players;
      return a.ip.localeCompare(b.ip);
    })
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
  console.log("User connected:", socket.id);

  // 🔥 send old chat to new user
  socket.emit("chat_history", chatMessages);

  socket.on("send_message", ({ nickname, message }) => {
    if (!nickname || !message) return;

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

    // 🔥 limit 50 messages
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

// optional chat API
app.get("/chat", (req, res) => {
  res.json({ messages: chatMessages });
});

// ====================
// 🧪 HEALTH
// ====================
app.get("/", (req, res) => {
  res.send("NO DROP STABLE SERVER SYSTEM 🚀 + PERSISTENT CHAT FIXED");
});

// ====================
// 🚀 START
// ====================
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
