// අවශ්ය මොඩියුල ආයාත කරන්න
globalThis.crypto = require('crypto').webcrypto;
const express = require('express');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('baileys');
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
let qr = '';
let isConnected = false;

// WhatsApp සම්බන්ධතාවය ආරම්භ කරන්න
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
        
        sock = makeWASocket({
            version: [2, 2413, 1],
            printQRInTerminal: true,
            auth: state,
            browser: ['Ubuntu', 'Chrome', '110.0.5481.177'],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            //logger: { level: 'debug' } // වැඩිදුර දෝෂ නිරාකරණය සඳහා
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr: newQr, pairingCode: newPairingCode, lastDisconnect } = update;
            
            if (newQr) {
                qr = newQr;
                qrcode.generate(qr, { small: true });
                console.log('QR Code Regenerated');
            }
            
            if (newPairingCode) {
                pairingCode = newPairingCode;
                console.log('New Pairing Code:', pairingCode);
            }
            
            if (connection === 'open') {
                isConnected = true;
                console.log('WhatsApp සාර්ථකව සම්බන්ධ විය!');
                setupBotHandlers();
            }
            
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    console.log('සම්බන්ධතාවය අහිමි විය. නැවත සම්බන්ධ වෙමින්...');
                    await delay(5000);
                    connectToWhatsApp();
                } else {
                    console.log('ඔබ logout කර ඇත. නව QR කේතය අවශ්යයි.');
                }
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
        if (!msg.message || !isConnected) return;

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

// YouTube ගීත බාගැනීම
async function downloadYouTubeAudio(url, sender) {
    try {
        const info = await ytdl.getInfo(url);
        const filename = `yt_${Date.now()}.mp3`;
        const filepath = path.join(__dirname, 'downloads', filename);
        
        ytdl(url, { quality: 'highestaudio', filter: 'audioonly' })
            .pipe(fs.createWriteStream(filepath))
            .on('finish', async () => {
                await sock.sendMessage(sender, { 
                    audio: { url: `/downloads/${filename}` },
                    mimetype: 'audio/mpeg',
                    fileName: `${info.videoDetails.title}.mp3`
                });
            });
    } catch (error) {
        console.error('YouTube ගීත බාගැනීමේ දෝෂය:', error);
        await sock.sendMessage(sender, { text: 'YouTube ගීතය බාගැනීමට අසමත් විය' });
    }
}

// රූට් සැකසුම්
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/connect', async (req, res) => {
    try {
        const connected = await connectToWhatsApp();
        if (connected) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'සම්බන්ධතාවය අසාර්ථක විය' });
        }
    } catch (error) {
        console.error('දෝෂය:', error);
        res.status(500).json({ error: 'අභ්‍යන්තර සේවාදායක දෝෂය' });
    }
});

app.get('/get-code', (req, res) => {
    res.json({ 
        status: isConnected ? 'connected' : 'disconnected',
        pairingCode: pairingCode || 'ජනනය වෙමින්...',
        qrCode: qr || ''
    });
});

// සේවාදායකය ආරම්භ කරන්න
app.listen(PORT, async () => {
    console.log(`සේවාදායකය ${PORT} වරායේ ධාවනය වෙමින් පවතී`);
    
    // අවශ්ය ඩිරෙක්ටරි සාදන්න
    if (!fs.existsSync('baileys_auth')) fs.mkdirSync('baileys_auth');
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
    
    // WhatsApp සමඟ ස්වයංක්‍රීයව සම්බන්ධ වන්න
    await connectToWhatsApp();
});
