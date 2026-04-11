// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const setupSocketHandlers = require('./socketHandlers');

const app = express();
app.use(cors());
app.use(express.static('public')); // Serve the frontend dashboard

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Pass ONLY the IO instance (Database removed)
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 OneTapPrint Server running on port ${PORT}`);
});
