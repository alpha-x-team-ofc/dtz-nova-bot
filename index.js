const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const PORT = process.env.PORT || 8000;
global.__path = process.cwd();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__path));

const dirs = ['./session', './temp', './qr_codes'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync('./admin.json')) {
    fs.writeFileSync('./admin.json', JSON.stringify(["94752978237"]));
}

const whatsappRoute = require('./whatsapp');
app.use('/api/whatsapp', whatsappRoute);

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__path, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__path, 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'online', time: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server: http://0.0.0.0:${PORT}`);
});
