const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

// 🔥 ADDED (chatისთვის)
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

// 🔥 ADDED
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

const UPDATE_INTERVAL = 20000;
const TIMEOUT = 8000;

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

// 💾 LAST KNOWN GOOD STATE (CRITICAL FIX)
let cache = {};
let rankedServers = [];

// 🔥 ADDED (chat storage)
let chatMessages = [];
let userCooldowns = {};
const MAX_MESSAGES = 50;
const MESSAGE_COOLDOWN = 2000;

// 🔥 QUERY
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

// 📊 UPDATE (NO DATA LOSS LOGIC)
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

// 🚀 INIT
(async () => {
  await updateRanks();
  console.log("🚀 Initial load done");
})();

setInterval(updateRanks, UPDATE_INTERVAL);

// ====================
// 💬 CHAT SOCKET (ADDED)
// ====================
io.on("connection", (socket) => {
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

    if (chatMessages.length > MAX_MESSAGES) {
      chatMessages.shift();
    }

    io.emit("new_message", msg);
  });

  socket.on("disconnect", () => {
    delete userCooldowns[socket.id];
  });
});

// 📡 API
app.get("/servers", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    servers: rankedServers
  });
});

// 🔥 ADDED (optional chat endpoint)
app.get("/chat", (req, res) => {
  res.json({ messages: chatMessages });
});

// 🧪 HEALTH
app.get("/", (req, res) => {
  res.send("NO DROP STABLE SERVER SYSTEM 🚀 + CHAT");
});

// ❗ CHANGED ONLY THIS (socket.io requires it)
server.listen(PORT, () => {
  console.log(`Running on ${PORT}`);
});
