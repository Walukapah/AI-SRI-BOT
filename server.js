// අවශ්ය මොඩියුල ආයාත කරන්න
globalThis.crypto = require('crypto').webcrypto;
const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// WhatsApp සම්බන්ධතා විචල්ය
let sock = null;
let pairingCode = '';
let qrCode = '';

// WhatsApp සම්බන්ධතාවය ආරම්භ කරන්න
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        
        sock = makeWASocket({
            version: [2, 2413, 1],
            printQRInTerminal: true,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '110.0.5481.177']
        });

        sock.ev.on('connection.update', (update) => {
            if (update.pairingCode) {
                pairingCode = update.pairingCode;
                console.log('Pairing Code:', pairingCode);
            }
            
            if (update.qr) {
                qrCode = update.qr;
                qrcode.generate(qrCode, { small: true });
            }
            
            if (update.connection === 'open') {
                console.log('WhatsApp සාර්ථකව සම්බන්ධ විය!');
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
        return true;
    } catch (error) {
        console.error('සම්බන්ධතා දෝෂය:', error);
        return false;
    }
}

// බොට් විධාන හසුකරන්න
function setupBotHandlers() {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const text = msg.message.conversation || '';
        const sender = msg.key.remoteJid;

        // YouTube වීඩියෝ බාගන්න
        if (text.startsWith('!yt ')) {
            const url = text.split(' ')[1];
            await downloadYouTubeVideo(url, sender);
        }
        
        // YouTube ගීත බාගන්න
        else if (text.startsWith('!ytmp3 ')) {
            const url = text.split(' ')[1];
            await downloadYouTubeAudio(url, sender);
        }
    });
}

// YouTube වීඩියෝ බාගැනීම
async function downloadYouTubeVideo(url, sender) {
    try {
        const info = await ytdl.getInfo(url);
        const filename = `yt_${Date.now()}.mp4`;
        const filepath = path.join(__dirname, 'downloads', filename);
        
        ytdl(url, { quality: 'highest' })
            .pipe(fs.createWriteStream(filepath))
            .on('finish', async () => {
                await sock.sendMessage(sender, { 
                    document: { url: `/downloads/${filename}` },
                    mimetype: 'video/mp4',
                    fileName: `${info.videoDetails.title}.mp4`
                });
            });
    } catch (error) {
        console.error('YouTube බාගැනීමේ දෝෂය:', error);
        await sock.sendMessage(sender, { text: 'YouTube වීඩියෝ බාගැනීමට අසමත් විය' });
    }
}

// රූට් සැකසුම්
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/connect', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'WhatsApp අංකය ඇතුළත් කරන්න' });
    }

    const connected = await connectToWhatsApp();
    if (connected) {
        res.json({ success: true, message: 'WhatsApp සම්බන්ධ වෙමින්...' });
    } else {
        res.status(500).json({ error: 'සම්බන්ධතාවය අසාර්ථක විය' });
    }
});

app.get('/get-code', (req, res) => {
    res.json({ 
        pairingCode: pairingCode || 'ජනනය වෙමින්...',
        qrCode: qrCode || ''
    });
});

// සේවාදායකය ආරම්භ කරන්න
app.listen(PORT, () => {
    console.log(`සේවාදායකය ${PORT} වරායේ ධාවනය වෙමින් පවතී`);
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
    if (!fs.existsSync('auth')) fs.mkdirSync('auth');
});
