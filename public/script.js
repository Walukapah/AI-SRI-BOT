document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectBtn');
    const phoneInput = document.getElementById('phoneNumber');
    const codeSection = document.getElementById('codeSection');
    const pairingCodeDisplay = document.getElementById('pairingCode');
    const copyBtn = document.getElementById('copyBtn');
    const qrCodeContainer = document.getElementById('qrCode');
    const featuresSection = document.getElementById('features');

    connectBtn.addEventListener('click', async () => {
        const phoneNumber = phoneInput.value.trim();
        
        if (!phoneNumber) {
            alert('WhatsApp අංකය ඇතුළත් කරන්න');
            return;
        }

        connectBtn.disabled = true;
        connectBtn.textContent = 'සම්බන්ධ වෙමින්...';
        
        try {
            const response = await fetch('/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phoneNumber })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // කේතය ලබා ගන්න
            const checkCode = setInterval(async () => {
                const codeResponse = await fetch('/get-code');
                const codeData = await codeResponse.json();
                
                if (codeData.pairingCode && codeData.pairingCode !== 'ජනනය වෙමින්...') {
                    clearInterval(checkCode);
                    
                    pairingCodeDisplay.textContent = codeData.pairingCode;
                    
                    if (codeData.qrCode) {
                        QRCode.toCanvas(qrCodeContainer, codeData.qrCode, {
                            width: 200,
                            margin: 2
                        }, (error) => {
                            if (error) console.error('QR කේත දෝෂය:', error);
                        });
                    }
                    
                    codeSection.classList.remove('hidden');
                    featuresSection.classList.remove('hidden');
                    connectBtn.textContent = 'සම්බන්ධ වන්න';
                    connectBtn.disabled = false;
                }
            }, 1000);
            
        } catch (error) {
            console.error('දෝෂය:', error);
            alert('සම්බන්ධතාවය අසාර්ථක විය: ' + error.message);
            connectBtn.textContent = 'සම්බන්ධ වන්න';
            connectBtn.disabled = false;
        }
    });

    copyBtn.addEventListener('click', () => {
        const code = pairingCodeDisplay.textContent;
        navigator.clipboard.writeText(code).then(() => {
            copyBtn.textContent = 'පිටපත් කළා!';
            setTimeout(() => {
                copyBtn.textContent = 'කේතය පිටපත් කරන්න';
            }, 2000);
        });
    });
});
