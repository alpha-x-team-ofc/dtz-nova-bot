const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const QRCode = require('qrcode');
const router = express.Router();
const moment = require('moment-timezone');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay
} = require('@whiskeysockets/baileys');

const sessions = new Map();
const qrCodes = new Map();

function loadAdmins() {
    try {
        return JSON.parse(fs.readFileSync('./admin.json', 'utf8'));
    } catch {
        return ["94752978237"];
    }
}

async function startWhatsAppSession(number, res = null) {
    const sessionId = number.replace(/\D/g, '');
    const sessionDir = path.join(__dirname, 'session', sessionId);
    
    console.log(`🚀 Starting WhatsApp for: ${sessionId}`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ['Chrome', 'Windows', '10.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: true
        });
        
        // Handle QR Code
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(`📱 QR Generated for ${sessionId}`);
                
                // Generate QR image
                const qrPath = path.join(__dirname, 'qr_codes', `${sessionId}.png`);
                await QRCode.toFile(qrPath, qr);
                qrCodes.set(sessionId, qr);
                
                if (res && !res.headersSent) {
                    res.json({
                        success: true,
                        qr: qr,
                        qrImage: `/qr_codes/${sessionId}.png`,
                        number: sessionId,
                        message: 'Scan QR code with WhatsApp'
                    });
                }
            }
            
            if (connection === 'open') {
                console.log(`✅ WhatsApp Connected: ${sessionId}`);
                qrCodes.delete(sessionId);
                
                // Clear QR image
                const qrPath = path.join(__dirname, 'qr_codes', `${sessionId}.png`);
                if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
                
                // Save number
                let numbers = [];
                if (fs.existsSync('./numbers.json')) {
                    numbers = JSON.parse(fs.readFileSync('./numbers.json', 'utf8'));
                }
                if (!numbers.includes(sessionId)) {
                    numbers.push(sessionId);
                    fs.writeFileSync('./numbers.json', JSON.stringify(numbers, null, 2));
                }
                
                // Send welcome message
                const welcomeMsg = `
🤖 *DTZ NOVA X MD BOT CONNECTED*

✅ Successfully connected!
📱 Your number: ${sessionId}
🕐 Time: ${moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss')}

📌 *Available Commands:*
• .menu - Show all commands
• .movie [name] - Search movies
• .drama [name] - Search dramas
• .song [name] - Search songs
• .alive - Check bot status
• .owner - Contact owner

🔧 _Powered by DTZ NOVA X MD_
                `;
                
                try {
                    await sock.sendMessage(`${sessionId}@s.whatsapp.net`, { text: welcomeMsg });
                } catch (e) {
                    console.log('Welcome message error:', e.message);
                }
                
                // Notify admin
                const admins = loadAdmins();
                admins.forEach(async (admin) => {
                    try {
                        await sock.sendMessage(`${admin}@s.whatsapp.net`, {
                            text: `📱 New connection: ${sessionId}\n⏰ ${moment().tz('Asia/Colombo').format('HH:mm:ss')}`
                        });
                    } catch (e) {
                        console.log('Admin notify error:', e.message);
                    }
                });
            }
            
            if (connection === 'close') {
                console.log(`❌ Disconnected: ${sessionId}`);
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log(`🔄 Reconnecting ${sessionId}...`);
                    setTimeout(() => startWhatsAppSession(sessionId), 5000);
                } else {
                    console.log(`🗑️ Session ended: ${sessionId}`);
                    sessions.delete(sessionId);
                    if (fs.existsSync(sessionDir)) {
                        fs.removeSync(sessionDir);
                    }
                }
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message) return;
            
            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const sender = msg.key.participant || from;
            
            console.log(`📨 ${sender}: ${text}`);
            
            // Handle commands
            if (text.startsWith('.')) {
                const command = text.toLowerCase().trim();
                
                // Movie search command
                if (command.startsWith('.movie ')) {
                    const movieName = command.replace('.movie ', '').trim();
                    if (movieName) {
                        await sock.sendMessage(from, {
                            text: `🎬 Searching movies: *${movieName}*\n\nPlease wait...`
                        });
                        
                        // Simulate movie search (replace with actual API)
                        const movies = [
                            `1. ${movieName} (2024) - HD`,
                            `2. ${movieName} 2 (2023) - 720p`,
                            `3. ${movieName}: Returns (2022) - 1080p`
                        ];
                        
                        const result = `🎬 *MOVIE RESULTS*\n\n${movies.join('\n')}\n\n📥 Download links will be sent shortly...`;
                        await sock.sendMessage(from, { text: result });
                    }
                }
                
                // Drama search command
                else if (command.startsWith('.drama ')) {
                    const dramaName = command.replace('.drama ', '').trim();
                    await sock.sendMessage(from, {
                        text: `📺 Searching dramas: *${dramaName}*\n\nResults will be sent soon...`
                    });
                }
                
                // Song download command
                else if (command.startsWith('.song ')) {
                    const songName = command.replace('.song ', '').trim();
                    await sock.sendMessage(from, {
                        text: `🎵 Searching song: *${songName}*\n\nDownload link will be sent...`
                    });
                }
                
                // Menu command
                else if (command === '.menu') {
                    const menu = `
🎮 *DTZ NOVA X MD - MENU*

🎬 *MOVIE COMMANDS:*
• .movie [name] - Search movies
• .drama [name] - Search dramas/series
• .song [name] - Download songs

🔧 *BOT COMMANDS:*
• .alive - Check bot status
• .owner - Contact owner
• .delete - Delete session
• .speed - Check speed

📱 *OTHER FEATURES:*
• Auto-reply
• Media downloader
• Group manager

👑 Owner: +94752978237
🤖 _Powered by DTZ NOVA X MD_
                    `;
                    await sock.sendMessage(from, { text: menu });
                }
                
                // Alive command
                else if (command === '.alive' || command === '.ping') {
                    await sock.sendMessage(from, {
                        text: `🏓 *ALIVE!*\n\n🤖 DTZ NOVA X MD BOT\n⏰ ${moment().tz('Asia/Colombo').format('HH:mm:ss')}\n✅ Connected: ${sessionId}`
                    });
                }
                
                // Owner command
                else if (command === '.owner') {
                    await sock.sendMessage(from, {
                        text: `👑 *OWNER CONTACT*\n\n📞 Number: +94752978237\n📢 Channel: https://whatsapp.com/channel/...\n💬 Message for support`
                    });
                }
                
                // Delete command
                else if (command === '.delete') {
                    await sock.sendMessage(from, {
                        text: '🗑️ Deleting your session...'
                    });
                    sessions.delete(sessionId);
                    if (fs.existsSync(sessionDir)) {
                        fs.removeSync(sessionDir);
                    }
                    await sock.logout();
                    await sock.sendMessage(from, {
                        text: '✅ Session deleted! Add again using /pair'
                    });
                }
                
                // Speed test
                else if (command === '.speed') {
                    const start = Date.now();
                    await sock.sendMessage(from, { text: '⚡ Testing speed...' });
                    const end = Date.now();
                    await sock.sendMessage(from, {
                        text: `⚡ *SPEED TEST*\n\n⏱️ Response: ${end - start}ms\n✅ Bot is running fast!`
                    });
                }
            }
        });
        
        sessions.set(sessionId, sock);
        return { success: true, sessionId };
        
    } catch (error) {
        console.error(`❌ Error for ${sessionId}:`, error.message);
        if (res && !res.headersSent) {
            res.json({
                success: false,
                error: error.message
            });
        }
        return { success: false, error: error.message };
    }
}

// API: Connect WhatsApp
router.post('/connect', async (req, res) => {
    try {
        const { number } = req.body;
        
        if (!number) {
            return res.json({
                success: false,
                message: 'Number is required'
            });
        }
        
        const sessionId = number.replace(/\D/g, '');
        
        if (sessionId.length < 10) {
            return res.json({
                success: false,
                message: 'Invalid number (use: 94712345678)'
            });
        }
        
        // Check if already connected
        if (sessions.has(sessionId)) {
            return res.json({
                success: true,
                message: 'Already connected',
                number: sessionId,
                connected: true
            });
        }
        
        // Start new session
        return startWhatsAppSession(sessionId, res);
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// API: Get QR Code
router.get('/qr/:number', async (req, res) => {
    const { number } = req.params;
    const sessionId = number.replace(/\D/g, '');
    
    if (qrCodes.has(sessionId)) {
        const qrPath = path.join(__dirname, 'qr_codes', `${sessionId}.png`);
        if (fs.existsSync(qrPath)) {
            res.sendFile(qrPath);
        } else {
            res.json({ error: 'QR not found' });
        }
    } else {
        res.json({ error: 'No QR code generated' });
    }
});

// API: Check status
router.get('/status/:number', (req, res) => {
    const { number } = req.params;
    const sessionId = number.replace(/\D/g, '');
    
    const isConnected = sessions.has(sessionId);
    const hasQR = qrCodes.has(sessionId);
    
    res.json({
        number: sessionId,
        connected: isConnected,
        qrPending: hasQR,
        timestamp: new Date().toISOString()
    });
});

// API: Get active sessions
router.get('/active', (req, res) => {
    res.json({
        count: sessions.size,
        sessions: Array.from(sessions.keys()),
        qrPending: Array.from(qrCodes.keys())
    });
});

// API: Send message
router.post('/send', async (req, res) => {
    const { number, message } = req.body;
    
    if (!number || !message) {
        return res.json({ success: false, error: 'Number and message required' });
    }
    
    const sessionId = number.replace(/\D/g, '');
    const sock = sessions.get(sessionId);
    
    if (!sock) {
        return res.json({ success: false, error: 'Session not found' });
    }
    
    try {
        await sock.sendMessage(`${sessionId}@s.whatsapp.net`, { text: message });
        res.json({ success: true, message: 'Message sent' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
