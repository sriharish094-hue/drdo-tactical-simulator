const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- 1. RDBMS / DATABASE SETUP (SQLite) ---
const db = new sqlite3.Database('./c4isr_tactical.db', (err) => {
    if (err) console.error("Database Error:", err.message);
    else console.log("📡 Connected to C4ISR Tactical SQLite Database.");
});

// Create Normalized Tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Commanders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        socket_id TEXT,
        role TEXT,
        score INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS CombatLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_id TEXT,
        weapon_type TEXT,
        destroyed_by_role TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// --- 2. MULTIPLAYER STATE ---
let players = {};

// --- 3. SOCKET.IO NETWORK PROTOCOL ---
io.on('connection', (socket) => {
    console.log(`[LINK ESTABLISHED] Commander Node Connected: ${socket.id}`);

    // Role Assignment
    socket.on('join_role', (role) => {
        players[socket.id] = { role: role, score: 0 };
        console.log(`Node ${socket.id} assigned role: ${role}`);
        db.run(`INSERT INTO Commanders (socket_id, role) VALUES (?, ?)`, [socket.id, role]);
        socket.emit('role_confirmed', { role, message: `Welcome to C4ISR Network, ${role} Commander.` });
    });

    socket.on('disconnect', () => {
        console.log(`[LINK LOST] Commander Node Disconnected: ${socket.id}`);
        delete players[socket.id];
    });
});

// --- 4. START SERVER ---
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 C4ISR Network Server running on port ${PORT}`);
    console.log(`Waiting for Client connections...`);
});