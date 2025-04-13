document.addEventListener('DOMContentLoaded', () => {
    const connectBtn = document.getElementById('connectBtn');
    const phoneInput = document.getElementById('phoneNumber');
    const codeSection = document.getElementById('codeSection');
    const pairingCodeDisplay = document.getElementById('pairingCode');
    const copyBtn = document.getElementById('copyBtn');
    const qrCodeContainer = document.getElementById('qrCode');
    const featuresSection = document.getElementById('features');
    const statusContainer = document.getElementById('statusContainer');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    let checkInterval = null;

    // අතුරුමුහුණත යාවත්කාලීන කරන්න
    function updateUI(status) {
        statusContainer.classList.remove('hidden');
        statusIndicator.className = '';
        
        switch(status) {
            case 'connected':
                statusIndicator.classList.add('status-connected');
                statusText.textContent = 'සම්බන්ධ වී ඇත';
                connectBtn.disabled = false;
                connectBtn.textContent = 'නැවත සම්බන්ධ වන්න';
                featuresSection.classList.remove('hidden');
                break;
                
            case 'connecting':
                statusIndicator.classList.add('status-connecting');
                statusText.textContent = 'සම්බන්ධ වෙමින්...';
                connectBtn.disabled = true;
                connectBtn.textContent = 'සම්බන්ධ වෙමින්...';
                featuresSection.classList.add('hidden');
                break;
                
            case 'disconnected':
                statusIndicator.classList.add('status-disconnected');
                statusText.textContent = 'සම්බන්ධ වී නැත';
                connectBtn.disabled = false;
                connectBtn.textContent = 'සම්බන්ධ වන්න';
                featuresSection.classList.add('hidden');
                break;
        }
    }

    // සම්බන්ධතා තත්වය පරීක්ෂා කරන්න
    async function checkConnectionStatus() {
        try {
            const response = await fetch('/get-code');
            const data = await response.json();
            
            if (data.status === 'connected') {
                updateUI('connected');
                clearInterval(checkInterval);
            } else if (data.pairingCode || data.qrCode) {
                updateUI('connecting');
                
                if (data.pairingCode && data.pairingCode !== 'ජනනය වෙමින්...') {
                    pairingCodeDisplay.textContent = data.pairingCode;
                    codeSection.classList.remove('hidden');
                }
                
                if (data.qrCode) {
                    QRCode.toCanvas(qrCodeContainer, data.qrCode, {
                        width: 200,
                        margin: 2
                    }, (error) => {
                        if (error) console.error('QR කේත දෝෂය:', error);
                    });
                }
            } else {
                updateUI('disconnected');
            }
        } catch (error) {
            console.error('තත්වය පරීක්ෂා කිරීමේ දෝෂය:', error);
            updateUI('disconnected');
        }
    }

    // සම්බන්ධතා බොත්තම
    connectBtn.addEventListener('click', async () => {
        const phoneNumber = phoneInput.value.trim();
        
        if (!phoneNumber) {
            alert('WhatsApp අංකය ඇතුළත් කරන්න');
            return;
        }

        updateUI('connecting');
        
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
            
            // තත්වය නිරන්තරයෙන් පරීක්ෂා කරන්න
            if (checkInterval) clearInterval(checkInterval);
            checkInterval = setInterval(checkConnectionStatus, 1000);
            
        } catch (error) {
            console.error('දෝෂය:', error);
            alert('සම්බන්ධතාවය අසාර්ථක විය: ' + error.message);
            updateUI('disconnected');
        }
    });

    // කේතය පිටපත් කිරීම
    copyBtn.addEventListener('click', () => {
        const code = pairingCodeDisplay.textContent;
        navigator.clipboard.writeText(code).then(() => {
            copyBtn.textContent = 'පිටපත් කළා!';
            setTimeout(() => {
                copyBtn.textContent = 'කේතය පිටපත් කරන්න';
            }, 2000);
        });
    });

    // ආරම්භක තත්වය පරීක්ෂා කරන්න
    updateUI('disconnected');
    checkConnectionStatus();
    checkInterval = setInterval(checkConnectionStatus, 5000);
});
