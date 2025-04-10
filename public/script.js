document.getElementById('connectBtn').addEventListener('click', async function() {
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    
    if (!phoneNumber) {
        alert('Please enter your WhatsApp number');
        return;
    }

    this.disabled = true;
    this.textContent = 'Generating...';
    
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
        
        // Show pairing code
        document.getElementById('pairingCode').textContent = data.pairingCode;
        document.getElementById('pairingContainer').classList.remove('hidden');
        
        // Check connection status periodically
        const checkInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch('/connection-status');
                const status = await statusResponse.json();
                
                if (status.connected) {
                    clearInterval(checkInterval);
                    document.getElementById('featuresContainer').classList.remove('hidden');
                }
            } catch (error) {
                console.error('Status check error:', error);
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate pairing code: ' + error.message);
    } finally {
        this.disabled = false;
        this.textContent = 'Generate Pairing Code';
    }
});
