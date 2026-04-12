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

        // Route Remote Shutdown
        socket.on('ui_request_shutdown', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                io.to(kioskSocketId).emit('shutdown_command');
            } else {
                socket.emit('ui_error', 'Cannot shutdown: Kiosk is offline');
            }
        });

        // Route Remote Test Print
        socket.on('ui_request_test_print', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                console.log(`Sending test print to: ${data.kioskId}`);
                io.to(kioskSocketId).emit('test_print_command');
            } else {
                socket.emit('ui_error', 'Cannot print: Kiosk is offline');
            }
        });

        // Route Sync Poll
        socket.on('ui_request_poll', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                io.to(kioskSocketId).emit('poll_request');
            } else {
                socket.emit('ui_error', 'Kiosk is currently offline');
            }
        });

        // Handle Sync Response
        socket.on('poll_response', (data) => {
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
                    printer: data.printer ? 'Ready' : 'Offline',
                    printer_details: data.printer_details // NEW: Raw Linux output
                },
                stats: {
                    today: todayStats,
                    yesterday: yesterdayStats,
                    history: history
                },
                excelFile: data.excel_file
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
