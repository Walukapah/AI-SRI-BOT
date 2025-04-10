const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const { TikTokDownloader } = require('tiktok-video-downloader');
const { facebook } = require('fb-video-downloader');
const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// WhatsApp Bot Variables
let whatsappBot = null;
let pairingCode = '';
let connectedNumber = '';

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WhatsApp Connection Endpoint
app.post('/connect', async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'WhatsApp number required' });
    }

    connectedNumber = phoneNumber;
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
        
        whatsappBot = makeWASocket({
            version: [2, 2413, 1],
            auth: state,
            mobile: true,
            printQRInTerminal: false
        });

        whatsappBot.ev.on('connection.update', (update) => {
            if (update.pairingCode) {
                pairingCode = update.pairingCode;
                console.log(`Pairing Code for ${phoneNumber}: ${pairingCode}`);
            }
            
            if (update.connection === 'open') {
                console.log(`Connected to: ${phoneNumber}`);
                setupBotHandlers();
            }
        });

        whatsappBot.ev.on('creds.update', saveCreds);

        res.json({ 
            success: true,
            pairingCode: pairingCode || 'Generating...'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Bot startup failed' });
    }
});

// Get Pairing Code
app.get('/get-pairing-code', (req, res) => {
    res.json({ pairingCode: pairingCode || 'Not generated yet' });
});

// Download Endpoints
app.post('/download/ytvideo', async (req, res) => {
    const { url } = req.body;
    try {
        const videoInfo = await ytdl.getInfo(url);
        const filename = `yt_${Date.now()}.mp4`;
        const filepath = path.join(__dirname, 'downloads', filename);
        
        ytdl(url, { quality: 'highest' })
            .pipe(fs.createWriteStream(filepath))
            .on('finish', () => {
                res.json({ 
                    success: true,
                    downloadUrl: `/downloads/${filename}`,
                    title: videoInfo.videoDetails.title
                });
            });
    } catch (error) {
        res.status(500).json({ error: 'YouTube download failed' });
    }
});

// Similar endpoints for TikTok, Facebook, etc...

// Bot Message Handlers
function setupBotHandlers() {
    whatsappBot.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        const text = msg.message.conversation || '';
        const sender = msg.key.remoteJid;
        
        // YouTube Download
        if (text.startsWith('!yt ')) {
            const url = text.split(' ')[1];
            const filename = `yt_${Date.now()}.mp4`;
            const filepath = path.join(__dirname, 'downloads', filename);
            
            ytdl(url, { quality: 'highest' })
                .pipe(fs.createWriteStream(filepath))
                .on('finish', async () => {
                    await whatsappBot.sendMessage(sender, { 
                        document: { url: `http://yourdomain.com/downloads/${filename}` },
                        mimetype: 'video/mp4',
                        fileName: 'youtube_video.mp4'
                    });
                });
        }
        
        // Other commands (!tiktok, !fb, etc)
    });
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Create downloads directory if not exists
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
});
