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
        document.getElementById('pairingCodeDisplay').textContent = data.pairingCode;
        document.getElementById('pairingContainer').classList.remove('hidden');
        document.getElementById('featuresContainer').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to generate pairing code: ' + error.message);
    } finally {
        this.disabled = false;
        this.textContent = 'Generate Pairing Code';
    }
});

// Copy pairing code functionality
document.getElementById('copyBtn').addEventListener('click', function() {
    const code = document.getElementById('pairingCodeDisplay').textContent;
    navigator.clipboard.writeText(code).then(() => {
        this.textContent = 'Copied!';
        setTimeout(() => {
            this.textContent = 'Copy Code';
        }, 2000);
    });
});
