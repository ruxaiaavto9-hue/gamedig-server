const express = require("express");
const ftp = require("basic-ftp");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔐 FTP CONFIG (Render Environment Variables-ში ჩაწერე)
const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const FTP_PORT = process.env.FTP_PORT || 21;

// 🧪 Test route
app.get("/", (req, res) => {
    res.json({
        status: "OK",
        message: "CS 1.6 FTP Analyzer Backend Running 🚀"
    });
});

// 🔌 FTP CONNECT + LIST PLUGINS
app.get("/api/plugins", async (req, res) => {
    const client = new ftp.Client();
    client.timeout = 10000;

    try {
        await client.access({
            host: FTP_HOST,
            user: FTP_USER,
            password: FTP_PASS,
            port: FTP_PORT,
            secure: false
        });

        // CS 1.6 AMX Mod X plugins folder
        const list = await client.list("/addons/amxmodx/plugins");

        const plugins = list.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            isActive: file.name.endsWith(".amxx")
        }));

        res.json({
            success: true,
            count: plugins.length,
            plugins
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    } finally {
        client.close();
    }
});

// 📊 Server status endpoint
app.get("/api/status", (req, res) => {
    res.json({
        server: "CS 1.6 Analyzer",
        time: new Date(),
        ftp: {
            host: FTP_HOST ? "SET" : "NOT SET"
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
