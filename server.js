const express = require("express");
const cors = require("cors");
const Gamedig = require("gamedig");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("CS API LIVE");
});

// SERVERS
const servers = [
  { host: "80.241.246.26", port: 222 },
  { host: "80.241.246.26", port: 226 },
  { host: "80.241.246.26", port: 27999 },
  { host: "80.241.246.26", port: 27016 },
  { host: "80.241.246.26", port: 27017 }
];

// SAFE QUERY (NO HANG)
async function querySafe(host, port) {
  try {
    const result = await Promise.race([
      Gamedig.query({
        type: "cs16",
        host,
        port,
        socketTimeout: 5000,
        attemptTimeout: 5000
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 6000)
      )
    ]);

    return result;
  } catch {
    return null;
  }
}

// MAIN ROUTE (SAFE LOOP)
app.get("/servers", async (req, res) => {
  const results = [];

  for (const s of servers) {
    const state = await querySafe(s.host, s.port);

    results.push({
      ip: `${s.host}:${s.port}`,
      name: state?.name || `Server ${s.port}`,
      online: !!state,
      players: state?.players?.length || 0,
      maxPlayers: state?.maxplayers || 0,
      map: state?.map || "offline"
    });
  }

  res.json(results);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("RUNNING ON", PORT);
});
