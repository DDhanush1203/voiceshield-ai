# VoiceShield Live Sentinel - Browser Telephony Hook (Manifest V3)

A Chrome & Edge browser extension that intercepts live VoIP call audio from **WhatsApp Web, Google Meet, Microsoft Teams, Discord, and Zoom Web** and evaluates it against the **VoiceShield Dual-Layer AI Engine** in real-time.

---

### Key Capabilities for WhatsApp Web & VoIP Calls
1. **Auto-Mounted Floating In-Call Widget**:
   - As soon as you navigate to `https://web.whatsapp.com/`, VoiceShield mounts a floating, draggable security pill in the top-right corner: `[🛡️ VoiceShield | Call Sentinel]`.
   - Click it anytime to expand the full In-Call HUD.
2. **CSP-Safe Architecture**:
   - All API queries to the local Python AI engine (`http://127.0.0.1:5000/api/sentinel`) are routed through the background service worker, completely bypassing WhatsApp Web's strict Content Security Policy (CSP).
3. **Live Speech & Deepfake Analysis**:
   - Transcribes spoken audio, highlights fraud indicators (OTP, KYC, arrest, wire transfer), and evaluates synthetic voice indicators.
4. **Instant Test Simulator**:
   - Click the **"⚡ Test Attack"** button inside the WhatsApp Web widget to immediately simulate an incoming voice deepfake attack with red alert banners.

---

### How to Reload and Activate on WhatsApp Web

1. Open your browser and go to:
   - Chrome / Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. Find **VoiceShield Live Sentinel - Telephony & Call Hook**.
3. Click the **🔄 Reload (circular arrow)** button on the extension card.
4. Open or switch to your **WhatsApp Web** tab (`https://web.whatsapp.com/`).
5. **Refresh the WhatsApp Web tab (Press `F5` or `Ctrl + R`)**.
6. You will see the floating **VoiceShield pill `[🛡️ VoiceShield | Call Sentinel]`** in the top-right corner of WhatsApp Web!
7. Click the pill to expand the In-Call HUD or use the extension toolbar popup to start monitoring!
