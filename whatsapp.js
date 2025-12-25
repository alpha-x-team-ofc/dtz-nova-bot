const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const router = express.Router();

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

const sessions = new Map();
const qrCodes = new Map();

async function startWhatsAppSession(number, res = null) {
    const sessionId = number.replace(/\D/g, '');
    const sessionDir = path.join(__dirname, 'session', `session_${sessionId}`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                console.log(`QR for ${sessionId}`);
                const qrPath = path.join(__dirname, 'qr_codes', `${sessionId}.png`);
                await QRCode.toFile(qrPath, qr);
                qrCodes.set(sessionId, qr);
                
                if (res && !res.headersSent) {
                    res.json({
                        success: true,
                        qr: qr,
                        qrImage: `/qr_codes/${sessionId}.png`,
                        number: sessionId
                    });
                }
            }
            
            if (connection === 'open') {
                console.log(`Connected: ${sessionId}`);
                qrCodes.delete(sessionId);
                sessions.set(sessionId, sock);
                
                let numbers = [];
                if (fs.existsSync('./numbers.json')) {
                    numbers = JSON.parse(fs.readFileSync('./numbers.json', 'utf8'));
                }
                if (!numbers.includes(sessionId)) {
                    numbers.push(sessionId);
                    fs.writeFileSync('./numbers.json', JSON.stringify(numbers, null, 2));
                }
                
                await sock.sendMessage(`${sessionId}@s.whatsapp.net`, {
                    text: `✅ DTZ NOVA X MD Connected!\n\nCommands:\n• .menu - Show commands\n• .movie [name] - Search movies\n• .owner - Contact`
                });
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;
            
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;
            
            if (text.startsWith('.')) {
                if (text.startsWith('.movie ')) {
                    const movie = text.replace('.movie ', '').trim();
                    await sock.sendMessage(from, {
                        text: `🎬 Searching: *${movie}*\n\nDownload links coming soon...`
                    });
                }
                else if (text === '.menu') {
                    await sock.sendMessage(from, {
                        text: `🎮 *MENU*\n\n🎬 .movie [name] - Search movies\n📺 .drama [name] - Search dramas\n🎵 .song [name] - Download songs\n👑 .owner - Contact\n🏓 .ping - Check status`
                    });
                }
                else if (text === '.ping') {
                    await sock.sendMessage(from, { text: '🏓 Pong! Bot is alive!' });
                }
                else if (text === '.owner') {
                    await sock.sendMessage(from, { text: '👑 Owner: +94752978237' });
                }
            }
        });
        
        if (!state.creds.registered) {
            const code = await sock.requestPairingCode(sessionId);
            if (res && !res.headersSent) {
                res.json({ code: code, number: sessionId });
            }
        }
        
        return sock;
    } catch (error) {
        console.error(`Error: ${sessionId}`, error);
        if (res && !res.headersSent) {
            res.json({ success: false, error: error.message });
        }
    }
}

router.post('/connect', async (req, res) => {
    const { number } = req.body;
    if (!number) return res.json({ success: false, message: 'Number required' });
    
    const sessionId = number.replace(/\D/g, '');
    if (sessions.has(sessionId)) {
        return res.json({ success: true, message: 'Already connected', number: sessionId });
    }
    
    await startWhatsAppSession(sessionId, res);
});

router.get('/qr/:number', (req, res) => {
    const { number } = req.params;
    const sessionId = number.replace(/\D/g, '');
    const qrPath = path.join(__dirname, 'qr_codes', `${sessionId}.png`);
    
    if (fs.existsSync(qrPath)) {
        res.sendFile(qrPath);
    } else {
        res.json({ error: 'QR not found' });
    }
});

router.get('/active', (req, res) => {
    res.json({
        count: sessions.size,
        sessions: Array.from(sessions.keys())
    });
});

module.exports = router;
