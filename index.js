const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const PORT = process.env.PORT || 8000;
global.__path = process.cwd();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__path));

// Create directories
const dirs = ['./session', './temp', './qr_codes'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Create required files
if (!fs.existsSync('./admin.json')) {
    fs.writeFileSync('./admin.json', JSON.stringify(["94752978237"]));
}
if (!fs.existsSync('./numbers.json')) {
    fs.writeFileSync('./numbers.json', JSON.stringify([]));
}

// Import routes
const whatsappRoute = require('./whatsapp');
app.use('/api/whatsapp', whatsappRoute);

// Serve pages
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__path, 'pair.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__path, 'dashboard.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__path, 'index.html'));
});

// API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        message: 'DTZ NOVA X MD Bot',
        version: '1.0.0',
        time: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║     🚀 DTZ NOVA X MD WHATSAPP BOT           ║
║                                              ║
╠══════════════════════════════════════════════╣
║                                              ║
║   ✅ Server: http://0.0.0.0:${PORT}           ║
║   📱 Pair:   /pair                           ║
║   🎮 Dashboard: /dashboard                   ║
║                                              ║
║   🔗 API: /api/whatsapp/connect             ║
║   🔗 API: /api/whatsapp/qr/[number]         ║
║                                              ║
╚══════════════════════════════════════════════╝
    `);
});

module.exports = app;
