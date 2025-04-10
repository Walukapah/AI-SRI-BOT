require('dotenv').config();
const express = require('express');
const { Boom } = require('@hapi/boom');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store active pairing sessions
const activeSessions = new Map();

// API endpoint for pairing
app.post('/api/pair', async (req, res) => {
    const { number, code } = req.body;
    
    if (!number || !code) {
        return res.status(400).json({ error: 'Number and code are required' });
    }
    
    // Store the pairing information
    activeSessions.set(code, {
        number: number.replace(/\D/g, ''),
        timestamp: Date.now(),
        status: 'pending'
    });
    
    // Initialize WhatsApp client for this pairing code
    initializeWhatsAppClient(code);
    
    res.json({ success: true, code: code });
});

// Initialize WhatsApp client with Baileys
async function initializeWhatsAppClient(pairingCode) {
    const { state, saveCreds } = await useMultiFileAuthState(`./sessions/session_${pairingCode}`);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: console,
        version: [2, 2413, 1]
    });
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(`QR for ${pairingCode}:`, qr);
        }
        
        if (connection === 'close') {
            const shouldReconnect = (new Boom(lastDisconnect?.error)).output.statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed for ${pairingCode}, reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(() => initializeWhatsAppClient(pairingCode), 5000);
            } else {
                // Clean up session
                activeSessions.delete(pairingCode);
                try {
                    fs.rmSync(path.join(__dirname, `sessions/session_${pairingCode}`), { recursive: true });
                } catch (err) {
                    console.error('Error cleaning up session:', err);
                }
            }
        } else if (connection === 'open') {
            console.log(`WhatsApp connected for ${pairingCode}`);
            activeSessions.get(pairingCode).status = 'connected';
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message.message) return;
        
        const messageText = message.message.conversation || 
                          (message.message.extendedTextMessage?.text || '');
        const sender = message.key.remoteJid;
        
        // Check if this is a pairing code message
        if (activeSessions.has(messageText) {
            const session = activeSessions.get(messageText);
            if (sender.includes(session.number)) {
                // Pairing successful
                await sock.sendMessage(sender, { 
                    text: `✅ Pairing successful! You can now use the bot.\n\nCommands:\n!yt [url] - Download YouTube video\n!song [url] - Download audio\n!tiktok [url] - Download TikTok video`
                });
                session.status = 'paired';
                return;
            }
        }
        
        // Process commands if paired
        if (activeSessions.has(pairingCode) {
            const session = activeSessions.get(pairingCode);
            if (session.status === 'paired' && sender.includes(session.number)) {
                await handleCommands(sock, sender, messageText);
            }
        }
    });
    
    return sock;
}

// Command handler
async function handleCommands(sock, sender, messageText) {
    try {
        if (messageText.startsWith('!yt ')) {
            const url = messageText.split(' ')[1];
            await handleYouTubeVideo(sock, sender, url);
        } 
        else if (messageText.startsWith('!song ')) {
            const url = messageText.split(' ')[1];
            await handleYouTubeAudio(sock, sender, url);
        }
        else if (messageText.startsWith('!tiktok ')) {
            const url = messageText.split(' ')[1];
            await handleTikTokVideo(sock, sender, url);
        }
        else if (messageText === '!help') {
            await sock.sendMessage(sender, {
                text: `📌 *Bot Commands*\n\n` +
                      `!yt [url] - Download YouTube video\n` +
                      `!song [url] - Download audio from YouTube\n` +
                      `!tiktok [url] - Download TikTok video\n\n` +
                      `Example: !yt https://youtu.be/example`
            });
        }
    } catch (error) {
        console.error('Command error:', error);
        await sock.sendMessage(sender, {
            text: '❌ Error processing your request. Please try again.'
        });
    }
}

// YouTube Video Downloader
async function handleYouTubeVideo(sock, sender, url) {
    if (!ytdl.validateURL(url)) {
        await sock.sendMessage(sender, { text: '❌ Invalid YouTube URL' });
        return;
    }
    
    await sock.sendMessage(sender, { text: '⏳ Downloading YouTube video...' });
    
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        const videoPath = `./temp/${Date.now()}_${title}.mp4`;
        
        const videoStream = ytdl(url, { quality: 'highest', filter: 'audioandvideo' })
            .pipe(fs.createWriteStream(videoPath));
        
        await new Promise((resolve, reject) => {
            videoStream.on('finish', resolve);
            videoStream.on('error', reject);
        });
        
        await sock.sendMessage(sender, {
            video: { url: videoPath },
            caption: `📹 ${title}`,
            mimetype: 'video/mp4'
        });
        
        fs.unlinkSync(videoPath);
    } catch (error) {
        console.error('YouTube download error:', error);
        await sock.sendMessage(sender, { text: '❌ Failed to download YouTube video' });
    }
}

// YouTube Audio Downloader
async function handleYouTubeAudio(sock, sender, url) {
    if (!ytdl.validateURL(url)) {
        await sock.sendMessage(sender, { text: '❌ Invalid YouTube URL' });
        return;
    }
    
    await sock.sendMessage(sender, { text: '⏳ Downloading audio...' });
    
    try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        const audioPath = `./temp/${Date.now()}_${title}.mp3`;
        
        const audioStream = ytdl(url, { quality: 'highestaudio', filter: 'audioonly' })
            .pipe(fs.createWriteStream(audioPath));
        
        await new Promise((resolve, reject) => {
            audioStream.on('finish', resolve);
            audioStream.on('error', reject);
        });
        
        await sock.sendMessage(sender, {
            audio: { url: audioPath },
            mimetype: 'audio/mp3',
            ptt: false
        });
        
        fs.unlinkSync(audioPath);
    } catch (error) {
        console.error('Audio download error:', error);
        await sock.sendMessage(sender, { text: '❌ Failed to download audio' });
    }
}

// TikTok Video Downloader
async function handleTikTokVideo(sock, sender, url) {
    if (!url.includes('tiktok.com')) {
        await sock.sendMessage(sender, { text: '❌ Invalid TikTok URL' });
        return;
    }
    
    await sock.sendMessage(sender, { text: '⏳ Downloading TikTok video...' });
    
    try {
        // Using a TikTok API endpoint (note: may stop working if TikTok changes their API)
        const apiUrl = `https://api.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${url.split('video/')[1]?.split('?')[0]}`;
        const response = await axios.get(apiUrl);
        
        const videoUrl = response.data.aweme_detail.video.play_addr.url_list[0];
        const videoResponse = await axios.get(videoUrl, { responseType: 'stream' });
        
        const videoPath = `./temp/tiktok_${Date.now()}.mp4`;
        const writer = fs.createWriteStream(videoPath);
        videoResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        await sock.sendMessage(sender, {
            video: { url: videoPath },
            caption: 'Downloaded from TikTok',
            mimetype: 'video/mp4'
        });
        
        fs.unlinkSync(videoPath);
    } catch (error) {
        console.error('TikTok download error:', error);
        await sock.sendMessage(sender, { text: '❌ Failed to download TikTok video' });
    }
}

// Create necessary directories
if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions');
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
