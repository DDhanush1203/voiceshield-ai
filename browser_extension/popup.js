const BACKEND_URL = 'http://127.0.0.1:5000/api';

let isHookActive = false;
let callTimerInterval = null;
let callSeconds = 0;

document.addEventListener('DOMContentLoaded', async () => {
  initTabDetection();
  checkBackendHealth();
  restoreState();

  document.getElementById('toggle-hook-btn').addEventListener('click', toggleAudioHook);
  document.getElementById('inject-overlay-btn').addEventListener('click', toggleInCallOverlay);
  document.getElementById('open-studio-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5173/' });
  });
});

// 1. Detect active communication tab
async function initTabDetection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const targetIcon = document.getElementById('target-icon');
    const targetName = document.getElementById('target-name');
    const url = (tab.url || '').toLowerCase();

    if (url.includes('web.whatsapp.com')) {
      targetIcon.textContent = '🟢';
      targetName.textContent = 'WhatsApp Web Voice Call';
    } else if (url.includes('meet.google.com')) {
      targetIcon.textContent = '📹';
      targetName.textContent = 'Google Meet Conference';
    } else if (url.includes('teams.microsoft.com')) {
      targetIcon.textContent = '💼';
      targetName.textContent = 'Microsoft Teams Call';
    } else if (url.includes('discord.com')) {
      targetIcon.textContent = '🎧';
      targetName.textContent = 'Discord Voice Channel';
    } else if (url.includes('zoom.us')) {
      targetIcon.textContent = '👥';
      targetName.textContent = 'Zoom Web Meeting';
    } else if (url.includes('localhost:5173') || url.includes('127.0.0.1:5173')) {
      targetIcon.textContent = '🛡️';
      targetName.textContent = 'VoiceShield AI Studio';
    } else {
      targetIcon.textContent = '🌐';
      targetName.textContent = tab.title ? tab.title.slice(0, 30) + '...' : 'Web VoIP Audio';
    }
  } catch (err) {
    console.warn("Tab detection error:", err);
  }
}

// 2. Health check to local Flask backend via background relay
function checkBackendHealth() {
  const statusPill = document.getElementById('backend-status');
  const statusText = document.getElementById('status-text');

  chrome.runtime.sendMessage({ type: 'CHECK_BACKEND_HEALTH' }, (res) => {
    if (res && res.status === 'healthy') {
      statusPill.className = 'status-pill online';
      statusText.textContent = 'AI Engine Online';
    } else {
      // Fallback direct fetch check
      fetch(`${BACKEND_URL}/health`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'healthy') {
            statusPill.className = 'status-pill online';
            statusText.textContent = 'AI Engine Online';
          }
        })
        .catch(() => {
          statusPill.className = 'status-pill offline';
          statusText.textContent = 'Backend Offline';
        });
    }
  });
}

// 3. Restore state from background worker
function restoreState() {
  chrome.runtime.sendMessage({ type: 'GET_SENTINEL_STATE' }, (response) => {
    if (response && response.isActive) {
      isHookActive = true;
      callSeconds = response.seconds || 0;
      updateUIForActiveHook();
      startTimer();
      if (response.lastVerdict) {
        applyTelemetryData(response.lastVerdict);
      }
    }
  });
}

// 4. Toggle Hook
async function toggleAudioHook() {
  isHookActive = !isHookActive;

  if (isHookActive) {
    updateUIForActiveHook();
    startTimer();

    // Ensure content script is injected in active tab (even if tab was opened before extension install)
    await ensureContentScriptInjected();

    // Start background hook
    chrome.runtime.sendMessage({ 
      type: 'START_TELEPHONY_HOOK',
      platform: document.getElementById('target-name').textContent
    });

    // Notify active tab to display in-call widget and immediately start voice monitoring
    sendMessageToActiveTab({ type: 'VOICESHIELD_SHOW_OVERLAY' });
    sendMessageToActiveTab({ type: 'VOICESHIELD_START_MONITORING' });
  } else {
    stopHook();
  }
}

function updateUIForActiveHook() {
  const btn = document.getElementById('toggle-hook-btn');
  btn.className = 'primary-btn recording';
  btn.innerHTML = '<span>⏹️ Stop Telephony Hook</span>';
  document.getElementById('threat-level').textContent = 'LIVE INTERCEPT ACTIVE';
  document.getElementById('verdict-text').textContent = 'Analyzing Voice & Intent Stream...';
}

function stopHook() {
  isHookActive = false;
  const btn = document.getElementById('toggle-hook-btn');
  btn.className = 'primary-btn';
  btn.innerHTML = '<span>🎙️ Start Call Hook</span>';

  clearInterval(callTimerInterval);
  callTimerInterval = null;
  callSeconds = 0;
  document.getElementById('call-timer').textContent = '00:00';

  chrome.runtime.sendMessage({ type: 'STOP_TELEPHONY_HOOK' });
  sendMessageToActiveTab({ type: 'VOICESHIELD_STOP_MONITORING' });
}

function startTimer() {
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const mins = Math.floor(callSeconds / 60);
    const secs = callSeconds % 60;
    document.getElementById('call-timer').textContent = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

// 5. Update Telemetry HUD in Popup
function applyTelemetryData(data) {
  const riskBanner = document.getElementById('threat-banner');
  const riskScore = document.getElementById('risk-score');
  const threatLevel = document.getElementById('threat-level');
  const verdictText = document.getElementById('verdict-text');
  const voiceVerdict = document.getElementById('voice-verdict');
  const intentVerdict = document.getElementById('intent-verdict');
  const liveTranscript = document.getElementById('live-transcript');

  riskScore.textContent = `${data.risk_score || 0}%`;
  verdictText.textContent = data.verdict || 'SAFE CALL';
  threatLevel.textContent = `${data.risk_level || 'SAFE'} THREAT DETECTED`;

  riskBanner.className = `threat-banner ${(data.risk_level || 'SAFE').toLowerCase()}`;

  if (data.voice === 'FAKE') {
    voiceVerdict.className = 'text-danger';
    voiceVerdict.textContent = '🚨 SYNTHETIC AI CLONE';
  } else {
    voiceVerdict.className = 'text-safe';
    voiceVerdict.textContent = '✅ NATURAL HUMAN VOICE';
  }

  if (data.intent === 'SCAM') {
    intentVerdict.className = 'text-danger';
    intentVerdict.textContent = '⚠️ SCAM PATTERN DETECTED';
  } else {
    intentVerdict.className = 'text-safe';
    intentVerdict.textContent = '✅ NORMAL INTENT';
  }

  if (data.transcript_snippet) {
    liveTranscript.textContent = `"${data.transcript_snippet}"`;
    liveTranscript.scrollTop = liveTranscript.scrollHeight;
  }
}

// Listen for updates from background service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SENTINEL_TELEMETRY_UPDATE' && msg.data) {
    applyTelemetryData(msg.data);
  }
});

// Toggle In-Call Overlay Widget on the page
async function toggleInCallOverlay() {
  await ensureContentScriptInjected();
  sendMessageToActiveTab({ type: 'VOICESHIELD_TOGGLE_OVERLAY' });
}

// Ensure content.js is injected into active tab even if opened prior to extension load
async function ensureContentScriptInjected() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Inject CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    }).catch(() => {});

    // Inject JS
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).catch(() => {});
  } catch (err) {
    console.warn("Script injection note:", err);
  }
}

async function sendMessageToActiveTab(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, msg).catch((e) => {
        console.warn("Tab message retry:", e);
      });
    }
  } catch (err) {
    console.warn("Could not message active tab:", err);
  }
}
