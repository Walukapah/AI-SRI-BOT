document.getElementById('connectBtn').addEventListener('click', async () => {
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    
    if (!phoneNumber) {
        alert('Please enter your WhatsApp number');
        return;
    }

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
            alert(data.error);
            return;
        }

        // Show pairing code section
        document.getElementById('pairingSection').classList.remove('hidden');
        document.getElementById('pairingCode').textContent = data.pairingCode;
        
        // Check for connection status every 2 seconds
        const checkConnection = setInterval(async () => {
            const codeResponse = await fetch('/get-pairing-code');
            const codeData = await codeResponse.json();
            
            // Update pairing code if changed
            if (codeData.pairingCode !== data.pairingCode) {
                document.getElementById('pairingCode').textContent = codeData.pairingCode;
            }
            
            // If connected, show features
            if (codeData.connectionStatus === 'connected') {
                clearInterval(checkConnection);
                document.getElementById('featuresSection').classList.remove('hidden');
            }
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        alert('Connection failed');
    }
});
