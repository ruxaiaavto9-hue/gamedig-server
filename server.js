const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("🚀 Server is running!");
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
