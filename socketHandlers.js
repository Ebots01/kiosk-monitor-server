// socketHandlers.js
let connectedKiosks = {};

module.exports = function (io) {
    io.on('connection', (socket) => {
        console.log('New Dashboard Connection:', socket.id);

        // --- Kiosk Registration ---
        socket.on('register_kiosk', (data) => {
            connectedKiosks[data.kioskId] = socket.id;
            console.log(`Kiosk Online: ${data.kioskId}`);
            io.emit('ui_update_status', { kioskId: data.kioskId, status: 'Online' });
        });

        // --- Route Remote Shutdown ---
        socket.on('ui_request_shutdown', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                io.to(kioskSocketId).emit('shutdown_command');
            } else {
                socket.emit('ui_error', 'Cannot shutdown: Kiosk is offline');
            }
        });

        // --- Route Remote Test Print ---
        socket.on('ui_request_test_print', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                console.log(`Sending test print to: ${data.kioskId}`);
                io.to(kioskSocketId).emit('test_print_command');
            } else {
                socket.emit('ui_error', 'Cannot print: Kiosk is offline');
            }
        });

        // --- Route Sync Poll (accepts optional date parameter) ---
        socket.on('ui_request_poll', (data) => {
            const kioskSocketId = connectedKiosks[data.kioskId];
            if (kioskSocketId) {
                // If no date provided, request full history
                const requestPayload = { date: data.date || 'all' };
                io.to(kioskSocketId).emit('poll_request', requestPayload);
            } else {
                socket.emit('ui_error', 'Kiosk is currently offline');
            }
        });

        // --- Handle Sync Response from Kiosk ---
        socket.on('poll_response', (data) => {

            // SCENARIO A: Kiosk sent back an Excel file for a specific date
            if (data.excel_file) {
                io.emit('ui_excel_ready', {
                    kioskId: data.kioskId,
                    date: data.requested_date_processed,
                    excelFile: data.excel_file,
                });
                return; // Stop here — don't overwrite dashboard stats
            }

            // SCENARIO B: Kiosk sent 'all' logs — calculate dashboard stats
            const toDateString = (dateObj) => {
                return (
                    dateObj.getFullYear() + '-' +
                    String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
                    String(dateObj.getDate()).padStart(2, '0')
                );
            };

            const todayObj = new Date();
            const today = toDateString(todayObj);

            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            const yesterday = toDateString(yesterdayObj);

            let todayStats = { pages: 0, revenue: 0 };
            let yesterdayStats = { pages: 0, revenue: 0 };
            let history = {};

            if (data.logs) {
                data.logs.forEach((log) => {
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

            io.emit('ui_update_dashboard', {
                kioskId: data.kioskId,
                status: 'Online',
                hardware: {
                    wifi: data.wifi ? 'Connected' : 'Disconnected',
                    printer: data.printer ? 'Ready' : 'Offline',
                    printer_details: data.printer_details,
                },
                stats: {
                    today: todayStats,
                    yesterday: yesterdayStats,
                    history: history,
                },
                available_dates: data.available_history_dates,
            });
        });

        // --- Handle Disconnect ---
        socket.on('disconnect', () => {
            for (const [kioskId, socketId] of Object.entries(connectedKiosks)) {
                if (socketId === socket.id) {
                    delete connectedKiosks[kioskId];
                    io.emit('ui_update_status', { kioskId: kioskId, status: 'Offline' });
                    break;
                }
            }
        });
    });
};
