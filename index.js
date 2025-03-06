const express = require("express");
const axios = require("axios");
const cors = require("cors");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");

const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const SOLANA_WALLET = config.SOLANA_WALLET;
const SOLANA_API = config.SOLANA_API;
let UPDATE_INTERVAL = config.UPDATE_INTERVAL;

if (UPDATE_INTERVAL < 2000 || UPDATE_INTERVAL > 30000) {
    console.warn("⚠️ UPDATE_INTERVAL is out of range (2000-30000ms). Using default 5050ms.");
    UPDATE_INTERVAL = 5050;
}

const app = express();
const PORT = 3000;
const WS_PORT = 3001;

let WIDGET_WIDTH = 400;
let WIDGET_HEIGHT = Math.round(WIDGET_WIDTH * 0.3); // 30% от ширины

app.use(cors());
app.use(express.static(path.join(__dirname, "public"))); // Раздаём HTML + файлы

const args = process.argv.slice(2);
if (args.length >= 1) {
    WIDGET_WIDTH = parseInt(args[0]);
    WIDGET_HEIGHT = Math.round(WIDGET_WIDTH * 0.3);
}

console.log(`✅ Server started: http://localhost:${PORT}`);
console.log(`✅ WebSocket running on port ${WS_PORT}`);
console.log(`✅ Widget size: ${WIDGET_WIDTH}x${WIDGET_HEIGHT}`);
console.log(`✅ Update interval: ${UPDATE_INTERVAL}ms`);
console.log(`✅ Using wallet: ${SOLANA_WALLET}`);

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", async (ws) => {
    console.log("✅ Client connected!");

    const startBalance = await getSolanaBalance();
    let currentBalance = startBalance;

    ws.send(JSON.stringify({
        startBalance,
        currentBalance,
        pnl: 0,
        width: WIDGET_WIDTH,
        height: WIDGET_HEIGHT
    }));

    setInterval(async () => {
        currentBalance = await getSolanaBalance();
        if (currentBalance === null) return;

        const pnl = (currentBalance - startBalance).toFixed(2);
        ws.send(JSON.stringify({
            startBalance,
            currentBalance,
            pnl,
            width: WIDGET_WIDTH,
            height: WIDGET_HEIGHT
        }));
    }, UPDATE_INTERVAL);
});

async function getSolanaBalance() {
    try {
        console.log("🔄 Fetching SOL balance...");

        const response = await axios.post(SOLANA_API, {
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [SOLANA_WALLET]
        });

        const balance = response.data.result.value / 1e9;
        console.log(`💰 SOL Balance: ${balance}`);
        return balance;
    } catch (error) {
        console.error("❌ ERROR fetching SOL balance:", error.message);
        return null;
    }
}

// Запуск сервера
app.listen(PORT);
