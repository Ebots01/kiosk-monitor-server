let connectedKiosks = {}; // Maps kioskId -> socket.id
let latestKioskData = {}; // Caches the latest known state for quick dashboard loads

module.exports = function(io, db) {
    io.on('connection', (socket) => {
        console.log('New connection established:', socket.id);

        // --- 1. KIOSK REGISTRATION ---
        socket.on('register_kiosk', (data) => {
            connectedKiosks[data.kioskId] = socket.id;
            latestKioskData[data.kioskId] = latestKioskData[data.kioskId] || { status: 'Online' };
            latestKioskData[data.kioskId].status = 'Online';
            
            console.log(`Kiosk Registered: ${data.kioskId}`);
            io.emit('ui_update', { kioskId: data.kioskId, status: 'Online' });
        });

        // --- 2. DASHBOARD TRIGGERS A CHECK ---
        socket.on('ui_request_poll', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                console.log(`UI requested poll for Kiosk: ${data.kioskId}`);
                io.to(kioskSocketId).emit('poll_request');
            } else {
                socket.emit('ui_error', 'Kiosk is currently offline');
            }
        });

        // --- 3. KIOSK REPLIES WITH DATA ---
        socket.on('poll_response', (data) => {
            console.log(`Received data from ${data.kioskId}`);
            
            // Cache the hardware status
            latestKioskData[data.kioskId] = {
                status: 'Online',
                hardware: {
                    wifi: data.wifi.connected ? `Connected (${data.wifi.signal}%)` : 'Offline',
                    printer: data.printer.connected ? 'Online' : 'Disconnected'
                }
            };

            const syncedIds = [];
            let totalPagesJustSynced = 0;
            let pendingLogs = data.new_logs ? data.new_logs.length : 0;

            // If there are no new logs, just update the UI immediately
            if (pendingLogs === 0) {
                sendUiUpdate(data.kioskId, 0, 0);
                return;
            }

            // Process and save new print logs to SQLite
            data.new_logs.forEach(log => {
                db.saveLog(data.kioskId, log, (err, serverId) => {
                    if (!err) {
                        syncedIds.push(log.id); // The ID from the local Flutter DB
                        totalPagesJustSynced += log.total_pages;
                    }
                    
                    pendingLogs--;
                    // Once all logs are processed
                    if (pendingLogs === 0) {
                        const kioskSocketId = connectedKiosks[data.kioskId];
                        
                        // Tell Flutter app: "I saved these, you can mark them synced"
                        if (kioskSocketId && syncedIds.length > 0) {
                            io.to(kioskSocketId).emit('logs_acknowledged', { synced_ids: syncedIds });
                        }

                        // Tell Dashboard: Update UI
                        sendUiUpdate(data.kioskId, syncedIds.length, totalPagesJustSynced);
                    }
                });
            });
        });

        // Helper to send data to the Web Dashboard
        function sendUiUpdate(kioskId, logsSynced, pagesSynced) {
            io.emit('ui_update', {
                kioskId: kioskId,
                hardware: latestKioskData[kioskId].hardware,
                logsSynced: logsSynced,
                pagesSynced: pagesSynced
            });

            // Push the updated total logs table to the UI
            db.getRecentLogs((err, rows) => {
                if (!err) io.emit('ui_logs_table', rows);
            });
        }

        // --- 4. DISCONNECTION HANDLING ---
        socket.on('disconnect', () => {
            for (const [kioskId, socketId] of Object.entries(connectedKiosks)) {
                if (socketId === socket.id) {
                    delete connectedKiosks[kioskId];
                    if (latestKioskData[kioskId]) latestKioskData[kioskId].status = 'Offline';
                    console.log(`Kiosk Disconnected: ${kioskId}`);
                    io.emit('ui_update', { kioskId: kioskId, status: 'Offline' });
                    break;
                }
            }
        });
    });
};