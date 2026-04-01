const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates the file if it doesn't exist)
const dbPath = path.resolve(__dirname, 'print_logs.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create the logs table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS server_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kiosk_id TEXT,
            local_app_id INTEGER,
            total_pages INTEGER,
            total_cost REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

module.exports = {
    // Insert a new log received from the kiosk
    saveLog: (kioskId, logData, callback) => {
        const sql = `INSERT INTO server_logs (kiosk_id, local_app_id, total_pages, total_cost) VALUES (?, ?, ?, ?)`;
        db.run(sql, [kioskId, logData.id, logData.total_pages, logData.total_cost], function(err) {
            callback(err, this.lastID);
        });
    },

    // Get the latest 10 logs for the web dashboard
    getRecentLogs: (callback) => {
        const sql = `SELECT * FROM server_logs ORDER BY timestamp DESC LIMIT 10`;
        db.all(sql, [], (err, rows) => {
            callback(err, rows);
        });
    }
};