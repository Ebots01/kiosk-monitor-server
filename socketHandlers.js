let connectedKiosks = {}; // Maps kioskId -> socket.id
let latestKioskData = {}; // Caches the latest known state for quick dashboard loads

// Helper function to group individual logs by Date
function aggregateHistoryByDate(historyArray) {
    const grouped = {};
    
    historyArray.forEach(log => {
        // Extract just the date part (YYYY-MM-DD) from the timestamp
        const dateObj = new Date(log.timestamp);
        const dateString = dateObj.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }); // Example output: "Apr 1, 2026"

        if (!grouped[dateString]) {
            grouped[dateString] = { 
                dateStr: dateString, 
                total_pages: 0, 
                total_cost: 0 
            };
        }
        
        // Add pages and cost to that specific date
        grouped[dateString].total_pages += log.total_pages;
        grouped[dateString].total_cost += log.total_cost;
    });

    // Convert the grouped object back into an array
    return Object.values(grouped);
}

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

            // --- DATE-WISE HISTORY LOGIC ---
            // Take the permanent history from the Kiosk, group it by date, and send to UI
            if (data.history && data.history.length > 0) {
                const dateWisedData = aggregateHistoryByDate(data.history);
                io.emit('ui_logs_table', dateWisedData);
            } else {
                io.emit('ui_logs_table', []); // Clear table if no history
            }

            const syncedIds = [];
            let totalPagesJustSynced = 0;
            let pendingLogs = data.new_logs ? data.new_logs.length : 0;

            // If there are no new logs to mark as synced, update the UI immediately
            if (pendingLogs === 0) {
                sendUiUpdate(data.kioskId, 0, 0);
                return;
            }

            // Process new logs so the kiosk knows they were received
            data.new_logs.forEach(log => {
                db.saveLog(data.kioskId, log, (err, serverId) => {
                    if (!err) {
                        syncedIds.push(log.id); 
                        totalPagesJustSynced += log.total_pages;
                    }
                    
                    pendingLogs--;
                    if (pendingLogs === 0) {
                        const kioskSocketId = connectedKiosks[data.kioskId];
                        
                        // Tell Flutter app to mark them synced
                        if (kioskSocketId && syncedIds.length > 0) {
                            io.to(kioskSocketId).emit('logs_acknowledged', { synced_ids: syncedIds });
                        }

                        // Tell Dashboard to update the status text
                        sendUiUpdate(data.kioskId, syncedIds.length, totalPagesJustSynced);
                    }
                });
            });
        });

        // Helper to send hardware data to the Web Dashboard
        function sendUiUpdate(kioskId, logsSynced, pagesSynced) {
            io.emit('ui_update', {
                kioskId: kioskId,
                hardware: latestKioskData[kioskId].hardware,
                logsSynced: logsSynced,
                pagesSynced: pagesSynced
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
