// socketHandlers.js
let connectedKiosks = {}; 

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log('New Dashboard Connection:', socket.id);
        socket.on('ui_request_shutdown', (data) => {
    const kioskSocketId = connectedKiosks[data.kioskId];
    if (kioskSocketId) {
        console.log(`Sending shutdown command to: ${data.kioskId}`);
        io.to(kioskSocketId).emit('shutdown_command');
    } else {
        socket.emit('ui_error', 'Cannot shutdown: Kiosk is offline');
          }
        });

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
            // Calculate Today and Yesterday dynamically
            const todayObj = new Date();
            const today = todayObj.getFullYear() + '-' + String(todayObj.getMonth() + 1).padStart(2, '0') + '-' + String(todayObj.getDate()).padStart(2, '0');
            
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            const yesterday = yesterdayObj.getFullYear() + '-' + String(yesterdayObj.getMonth() + 1).padStart(2, '0') + '-' + String(yesterdayObj.getDate()).padStart(2, '0');

            let todayStats = { pages: 0, revenue: 0 };
            let yesterdayStats = { pages: 0, revenue: 0 };
            let history = {};

            if (data.logs) {
                data.logs.forEach(log => {
                    const logDate = log.date; 
                    
                    if (logDate === today) {
                        todayStats.pages += log.pages;
                        todayStats.revenue += log.amount;
                    } else if (logDate === yesterday) {
                        yesterdayStats.pages += log.pages;
                        yesterdayStats.revenue += log.amount;
                    }

                    if (!history[logDate]) history[logDate] = { pages: 0, revenue: 0 };
                    history[logDate].pages += log.pages;
                    history[logDate].revenue += log.amount;
                });
            }

            io.emit('ui_update', {
                kioskId: data.kioskId,
                status: 'Online',
                hardware: {
                    wifi: data.wifi ? 'Connected' : 'Disconnected',
                    printer: data.printer ? 'Ready' : 'Offline'
                },
                stats: {
                    today: todayStats,
                    yesterday: yesterdayStats,
                    history: history
                },
                excelFile: data.excel_file // Forward the file to the UI
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
