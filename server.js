const express = require('express');
const { makeWASocket } = require('baileys');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const { tiktokdl } = require('tiktok-scraper');
const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/downloads', express.static('downloads'));

// WhatsApp Bot
let sock = null;
let pairingCode = '';

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/connect', async (req, res) => {
    const { phoneNumber } = req.body;
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth');
        
        sock = makeWASocket({
            version: [2, 2413, 1],
            printQRInTerminal: false,
            auth: state
        });

        sock.ev.on('connection.update', (update) => {
            if (update.pairingCode) {
                pairingCode = update.pairingCode;
                console.log(`Pairing Code: ${pairingCode}`);
            }
            if (update.connection === 'open') {
                console.log(`Connected to WhatsApp`);
                setupBotHandlers();
            }
        });

        sock.ev.on('creds.update', saveCreds);

        res.json({ success: true, pairingCode });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to initialize bot' });
    }
});

app.get('/get-pairing-code', (req, res) => {
    res.json({ pairingCode: pairingCode || 'Generating...' });
});

// Bot Command Handlers
function setupBotHandlers() {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        const text = msg.message.conversation || '';
        const sender = msg.key.remoteJid;

        // YouTube Video Download
        if (text.startsWith('!yt ')) {
            const url = text.split(' ')[1];
            await handleYouTubeVideo(url, sender);
        }
        
        // YouTube Audio Download
        else if (text.startsWith('!ytmp3 ')) {
            const url = text.split(' ')[1];
            await handleYouTubeAudio(url, sender);
        }
        
        // TikTok Download
        else if (text.startsWith('!tiktok ')) {
            const url = text.split(' ')[1];
            await handleTikTok(url, sender);
        }
    });
}

// Downloader Functions
async function handleYouTubeVideo(url, sender) {
    try {
        const info = await ytdl.getInfo(url);
        const filename = `yt_${Date.now()}.mp4`;
        const filepath = path.join(__dirname, 'downloads', filename);
        
        ytdl(url, { quality: 'highest' })
            .pipe(fs.createWriteStream(filepath))
            .on('finish', async () => {
                await sock.sendMessage(sender, { 
                    document: { url: `http://yourdomain.com/downloads/${filename}` },
                    mimetype: 'video/mp4',
                    fileName: `${info.videoDetails.title}.mp4`
                });
            });
    } catch (error) {
        console.error('YouTube download error:', error);
        await sock.sendMessage(sender, { text: 'Failed to download YouTube video' });
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
});
