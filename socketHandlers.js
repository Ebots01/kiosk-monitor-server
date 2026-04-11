// socketHandlers.js
let connectedKiosks = {}; 

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log('New Dashboard Connection:', socket.id);

        socket.on('register_kiosk', (data) => {
            connectedKiosks[data.kioskId] = socket.id;
            console.log(`Kiosk Online: ${data.kioskId}`);
            io.emit('ui_update', { kioskId: data.kioskId, status: 'Online' });
        });

        socket.on('ui_request_poll', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                io.to(kioskSocketId).emit('poll_request');
            } else {
                socket.emit('ui_error', 'Kiosk is currently offline');
            }
        });

        socket.on('poll_response', (data) => {
            const today = new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterday = yesterdayDate.toISOString().split('T')[0];

            let todayStats = { pages: 0, revenue: 0 };
            let yesterdayStats = { pages: 0, revenue: 0 };
            let history = {};

            // Process logs sent directly from Kiosk
            if (data.logs) {
                data.logs.forEach(log => {
                    const logDate = log.date; // Format: YYYY-MM-DD
                    
                    if (logDate === today) {
                        todayStats.pages += log.pages;
                        todayStats.revenue += log.amount;
                    } else if (logDate === yesterday) {
                        yesterdayStats.pages += log.pages;
                        yesterdayStats.revenue += log.amount;
                    }

                    // Group everything for the "Date-wise check"
                    if (!history[logDate]) history[logDate] = { pages: 0, revenue: 0 };
                    history[logDate].pages += log.pages;
                    history[logDate].revenue += log.amount;
                });
            }

            // Send everything to the UI
            io.emit('ui_update', {
                kioskId: data.kioskId,
                status: 'Online',
                hardware: {
                    wifi: data.wifi ? 'Connected' : 'Disconnected',
                    printer: data.printer ? 'Online' : 'Offline'
                },
                stats: {
                    today: todayStats,
                    yesterday: yesterdayStats,
                    history: history
                }
            });
        });

        socket.on('disconnect', () => {
            for (const [kioskId, socketId] of Object.entries(connectedKiosks)) {
                if (socketId === socket.id) {
                    delete connectedKiosks[kioskId];
                    io.emit('ui_update', { kioskId: kioskId, status: 'Offline' });
                    break;
                }
            }
        });
    });
};
