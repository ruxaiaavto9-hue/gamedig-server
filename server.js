const Gamedig = require("gamedig");

app.get("/servers", async (req, res) => {
  const servers = [
    { name: "CS Server 1", host: "80.241.246.26", port: 27777 },
    { name: "CS Server 2", host: "80.241.246.27", port: 27015 }
  ];

  const data = await Promise.all(
    servers.map(async (s) => {
      try {
        const state = await Gamedig.query({
          type: "cs16",
          host: s.host,
          port: s.port
        });

        return {
          name: s.name,
          ip: `${s.host}:${s.port}`,
          online: true,
          players: state.players.length,   // 🔥 REAL
          maxPlayers: state.maxplayers,
          map: state.map
        };
      } catch (e) {
        return {
          name: s.name,
          ip: `${s.host}:${s.port}`,
          online: false,
          players: 0,
          maxPlayers: 0,
          map: "unknown"
        };
      }
    })
  );

  res.json(data);
});
