// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs'); // Added for file system access
const path = require('path'); // Added for path resolution

const setupSocketHandlers = require('./socketHandlers');

const app = express();
app.use(cors());
app.use(express.static('public')); // Serve the frontend dashboard

// Added Endpoint to clear downloads
app.post('/api/clear-downloads', (req, res) => {
    // Replace with the actual absolute path to the Linux downloads folder
    const downloadDir = '/home/username/Downloads'; 

    fs.readdir(downloadDir, (err, files) => {
        if (err) {
            console.error('Could not list the directory.', err);
            return res.status(500).send('Error reading directory');
        }

        for (const file of files) {
            const filePath = path.join(downloadDir, file);
            // Delete each file
            fs.unlink(filePath, err => {
                if (err) console.error(`Error deleting file: ${filePath}`, err);
            });
        }
        res.status(200).send('Download folder cleared');
    });
});

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
