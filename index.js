const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Tell Express to serve the 'public' folder directly 
app.use(express.static(path.join(__dirname, 'public')));

// Create the UI Dashboard on the home page
app.get('/', (req, res) => {
    const versionPath = path.join(__dirname, 'public', 'version.txt');
    let currentVersion = 'Unknown / File Missing';
    
    // Read the version.txt file to display on the dashboard
    try {
        if (fs.existsSync(versionPath)) {
            currentVersion = fs.readFileSync(versionPath, 'utf8').trim();
        }
    } catch (e) {
        console.error("Error reading version:", e);
    }

    // A simple, clean HTML UI
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kiosk OTA Dashboard</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f4f9; display: flex; justify-content: center; padding-top: 50px; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 100%; }
            h1 { color: #333; margin-top: 0; }
            .version-box { background: #eef2f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .version-text { font-size: 28px; font-weight: bold; color: #0070f3; margin: 0; }
            .btn { display: block; padding: 12px 20px; background: #0070f3; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px; transition: background 0.2s; }
            .btn:hover { background: #005bb5; }
            .btn-secondary { background: #6c757d; }
            .btn-secondary:hover { background: #5a6268; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>OTA Update Server</h1>
            <p>Smart Printer Kiosk Status</p>
            
            <div class="version-box">
                <p style="margin: 0 0 5px 0; color: #666;">Current Version Hosted:</p>
                <p class="version-text">${currentVersion}</p>
            </div>

            <a href="/bundle.zip" class="btn">Download Kiosk App (ZIP)</a>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// IMPORTANT FOR VERCEL: You must export the app instead of just listening!
module.exports = app;

// Keep this for local testing on your machine
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running locally on http://localhost:${PORT}`);
    });
}