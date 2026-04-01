const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import our custom modules
const db = require('./database');
const setupSocketHandlers = require('./socketHandlers');

const app = express();
app.use(cors());
app.use(express.static('public')); // Serve the frontend dashboard

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Allows your Flutter app to connect from anywhere
        methods: ["GET", "POST"]
    }
});

// Pass the IO instance and Database to our handlers
setupSocketHandlers(io, db);

// Render sets the PORT automatically. Default to 3000 for local testing.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Monitoring Server running on port ${PORT}`);
});