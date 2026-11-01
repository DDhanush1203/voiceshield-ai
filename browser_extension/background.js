// VoiceShield Background Service Worker (Manifest V3)
// Relays API requests to Flask backend to bypass web page CSP restrictions (e.g. WhatsApp Web)

const BACKEND_BASE = 'http://127.0.0.1:5000/api';

let sentinelState = {
  isActive: false,
  seconds: 0,
  activePlatform: 'WhatsApp Web',
  lastVerdict: {
    risk_score: 15,
    risk_level: 'SAFE',
    verdict: 'AUTHENTIC CALL (SAFE)',
    voice: 'REAL',
    intent: 'SAFE',
    transcript_snippet: 'VoiceShield telephony stream listening on active call...'
  }
};

let pollTimer = null;

// Listen for messages from Content Scripts and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Health check to Flask
  if (message.type === 'CHECK_BACKEND_HEALTH') {
    fetch(`${BACKEND_BASE}/health`)
      .then(r => r.json())
      .then(data => sendResponse({ status: 'healthy', data }))
      .catch(err => sendResponse({ status: 'offline', error: err.message }));
    return true; // Keep message channel open for async response
  }

  // 2. Query Sentinel State
  if (message.type === 'GET_SENTINEL_STATE') {
    sendResponse(sentinelState);
    return true;
  }

  // 3. Start Telephony Hook
  if (message.type === 'START_TELEPHONY_HOOK') {
    sentinelState.isActive = true;
    sentinelState.seconds = 0;
    if (message.platform) sentinelState.activePlatform = message.platform;
    sendResponse({ status: 'started', state: sentinelState });
    return true;
  }

  // 4. Stop Telephony Hook
  if (message.type === 'STOP_TELEPHONY_HOOK') {
    sentinelState.isActive = false;
    sendResponse({ status: 'stopped', state: sentinelState });
    return true;
  }

  // 5. Analyze VoIP Transcript or Audio Slice (Called from WhatsApp Web content.js)
  if (message.type === 'ANALYZE_VOIP_STREAM') {
    analyzeVoipStream(message.transcript, message.audioBase64, message.session_id)
      .then(result => {
        if (result && result.status === 'success') {
          result.transcript_snippet = message.transcript || result.transcript_snippet;
          sentinelState.lastVerdict = result;
          // Broadcast verdict & transcript to open popup HUD
          chrome.runtime.sendMessage({
            type: 'SENTINEL_TELEMETRY_UPDATE',
            data: result
          }).catch(() => {});
        }
        sendResponse(result);
      })
      .catch(err => {
        sendResponse({ status: 'error', error: err.message });
      });
    return true;
  }

  // 6. Live Transcript Broadcast from in-call content script to popup HUD
  if (message.type === 'VOICESHIELD_LIVE_TRANSCRIPT') {
    if (sentinelState.lastVerdict) {
      sentinelState.lastVerdict.transcript_snippet = message.transcript;
    }
    chrome.runtime.sendMessage({
      type: 'SENTINEL_TELEMETRY_UPDATE',
      data: {
        ...(sentinelState.lastVerdict || {}),
        transcript_snippet: message.transcript
      }
    }).catch(() => {});
    sendResponse({ status: 'ok' });
    return true;
  }

  // 7. Forward Telemetry to all active tabs
  if (message.type === 'BROADCAST_TELEMETRY') {
    sentinelState.lastVerdict = message.data;
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'VOICESHIELD_TELEMETRY_DATA',
            data: message.data
          }).catch(() => {});
        }
      });
    });
    sendResponse({ status: 'broadcasted' });
    return true;
  }
});

// Sends data to Flask Sentinel endpoint (Bypasses page CSP!)
async function analyzeVoipStream(transcript, audioBase64, sessionId) {
  try {
    const fd = new FormData();
    fd.append('transcript', transcript || '');
    fd.append('session_id', sessionId || 'wa_ext_session');

    if (audioBase64) {
      // Convert base64 data to Blob if present
      const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      fd.append('chunk', blob, 'voip_slice.wav');
    }

    const res = await fetch(`${BACKEND_BASE}/sentinel`, {
      method: 'POST',
      body: fd
    });

    if (!res.ok) {
      throw new Error(`Backend returned HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Background analysis error:", err);
    return {
      status: 'error',
      error: err.message,
      risk_score: 0,
      risk_level: 'SAFE',
      verdict: 'OFFLINE STANDBY',
      voice: 'REAL',
      intent: 'NORMAL',
      transcript_snippet: transcript || ''
    };
  }
}
