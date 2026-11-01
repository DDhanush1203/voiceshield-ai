// VoiceShield Content Script - In-Call Floating HUD for WhatsApp Web & VoIP Calls
(function () {
  if (document.getElementById('voiceshield-overlay-root')) return;

  let rootContainer = null;
  let isExpanded = false;
  let isMonitoring = false;
  let speechRecognizer = null;
  let speechAccumulator = '';
  let currentSessionFinal = '';
  let restartTimeout = null;
  let analysisDebounceTimer = null;

  // Local scam indicators regex for instant in-tab alerting
  const SCAM_REGEX = /\b(otp|one time password|password|passwords|passcode|passcodes|cvv|pin|mpin|upi pin|credentials?|login details|secret code|verification code|bank account|credit card|debit card|arrest|warrant|police|digital arrest|cbi|fbi|irs|kyc|account suspended|blocked|wire transfer|gift card|crypto|urgent|immediately)\b/i;

  // Initialize immediately on page load
  initVoiceShieldHUD();

  // Listen for messages from popup and background service worker
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'VOICESHIELD_SHOW_OVERLAY' || msg.type === 'VOICESHIELD_TOGGLE_OVERLAY') {
      expandWidget();
      sendResponse({ status: 'ok' });
    }

    if (msg.type === 'VOICESHIELD_START_MONITORING') {
      expandWidget();
      if (!isMonitoring) {
        toggleLiveMonitor();
      }
      sendResponse({ status: 'monitoring_started' });
    }

    if (msg.type === 'VOICESHIELD_STOP_MONITORING') {
      if (isMonitoring) {
        toggleLiveMonitor();
      }
      sendResponse({ status: 'monitoring_stopped' });
    }

    if (msg.type === 'VOICESHIELD_TELEMETRY_DATA' && msg.data) {
      applyTelemetry(msg.data);
    }
  });

  function initVoiceShieldHUD() {
    rootContainer = document.createElement('div');
    rootContainer.id = 'voiceshield-overlay-root';

    // 1. Initial State: Floating Pill Trigger
    rootContainer.innerHTML = `
      <div class="vs-pill-trigger" id="vs-trigger-btn" title="Click to open VoiceShield Telephony Sentinel HUD">
        <span class="vs-shield-glow">🛡️</span>
        <span class="vs-pulse-indicator"></span>
        <span id="vs-pill-label">VoiceShield | Call Sentinel</span>
      </div>

      <div class="vs-widget-container" id="vs-full-card" style="display: none;">
        <div class="vs-header" id="vs-drag-handle">
          <div class="vs-brand">
            <span class="vs-pulse-indicator"></span>
            <span>VoiceShield Sentinel HUD</span>
          </div>
          <div class="vs-controls">
            <button class="vs-btn" id="vs-min-btn" title="Minimize to pill">_</button>
            <button class="vs-btn" id="vs-close-btn" title="Hide">×</button>
          </div>
        </div>

        <div class="vs-body">
          <div class="vs-platform-tag">
            <span>📞</span> <span id="vs-platform-text">WhatsApp Web Protected</span>
          </div>

          <div class="vs-threat-pill safe" id="vs-threat-pill">
            <span id="vs-verdict-title">🟢 CALL VERIFIED: SAFE</span>
            <span class="vs-score-badge" id="vs-risk-score">12%</span>
          </div>

          <div class="vs-meters-row">
            <div class="vs-meter-box">
              <span>Voice Layer (CNN)</span>
              <strong class="vs-sub-pill safe" id="vs-voice-pill">HUMAN VOICE</strong>
            </div>
            <div class="vs-meter-box">
              <span>Intent Layer (NLP)</span>
              <strong class="vs-sub-pill safe" id="vs-intent-pill">NORMAL INTENT</strong>
            </div>
          </div>

          <div class="vs-transcript-box" id="vs-transcript-text">
            Listening for VoIP call audio stream...
          </div>

          <div class="vs-actions-row">
            <button class="vs-act-btn primary" id="vs-toggle-monitor-btn">
              🎙️ Start Call Monitor
            </button>
            <button class="vs-act-btn sim" id="vs-sim-btn" title="Simulate a scam attack on this call">
              ⚡ Test Attack
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(rootContainer);

    // Event Listeners
    const triggerBtn = document.getElementById('vs-trigger-btn');
    const minBtn = document.getElementById('vs-min-btn');
    const closeBtn = document.getElementById('vs-close-btn');
    const toggleMonitorBtn = document.getElementById('vs-toggle-monitor-btn');
    const simBtn = document.getElementById('vs-sim-btn');

    triggerBtn.addEventListener('click', expandWidget);
    minBtn.addEventListener('click', collapseWidget);
    closeBtn.addEventListener('click', () => { rootContainer.style.display = 'none'; });

    toggleMonitorBtn.addEventListener('click', toggleLiveMonitor);
    simBtn.addEventListener('click', runSimulatedAttack);

    makeDraggable(rootContainer, document.getElementById('vs-drag-handle'));
  }

  function expandWidget() {
    isExpanded = true;
    rootContainer.style.display = 'block';
    document.getElementById('vs-trigger-btn').style.display = 'none';
    document.getElementById('vs-full-card').style.display = 'flex';
  }

  function collapseWidget() {
    isExpanded = false;
    document.getElementById('vs-trigger-btn').style.display = 'flex';
    document.getElementById('vs-full-card').style.display = 'none';
  }

  // Live Speech Monitoring on WhatsApp Web
  function toggleLiveMonitor() {
    isMonitoring = !isMonitoring;
    const btn = document.getElementById('vs-toggle-monitor-btn');

    if (isMonitoring) {
      btn.style.background = '#dc2626';
      btn.textContent = '⏹️ Stop Monitor';
      startWebSpeechRecognition();
    } else {
      btn.style.background = '#4f46e5';
      btn.textContent = '🎙️ Start Call Monitor';
      stopWebSpeechRecognition();
    }
  }

  function startWebSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser tab.");
      return;
    }

    if (speechRecognizer) {
      try { speechRecognizer.abort(); } catch (_) {}
      speechRecognizer = null;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = navigator.language || 'en-IN';

      rec.onresult = (e) => {
        let interim = '';
        currentSessionFinal = '';
        for (let i = 0; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            currentSessionFinal += e.results[i][0].transcript + ' ';
          } else {
            interim += e.results[i][0].transcript;
          }
        }

        // Complete full transcript across all consecutive speech sessions
        const fullSpoken = (speechAccumulator + ' ' + currentSessionFinal + ' ' + interim).replace(/\s+/g, ' ').trim();
        const transcriptEl = document.getElementById('vs-transcript-text');
        if (fullSpoken && transcriptEl) {
          transcriptEl.textContent = `"${fullSpoken}"`;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        }

        // Immediate broadcast to background & popup HUD
        chrome.runtime.sendMessage({
          type: 'VOICESHIELD_LIVE_TRANSCRIPT',
          transcript: fullSpoken
        }).catch(() => {});

        // Instant keyword alert
        if (SCAM_REGEX.test(fullSpoken)) {
          const intentEl = document.getElementById('vs-intent-pill');
          if (intentEl) {
            intentEl.textContent = '⚠️ FRAUD KEYWORDS';
            intentEl.className = 'vs-sub-pill danger';
          }
        }

        // Debounced backend AI analysis (1.2s to prevent request flooding and out-of-order responses)
        if (analysisDebounceTimer) clearTimeout(analysisDebounceTimer);
        analysisDebounceTimer = setTimeout(() => {
          if (fullSpoken.length > 3) {
            chrome.runtime.sendMessage({
              type: 'ANALYZE_VOIP_STREAM',
              transcript: fullSpoken
            }, (res) => {
              if (res && res.status === 'success') {
                applyTelemetry(res);
              }
            });
          }
        }, 1200);
      };

      rec.onerror = (e) => {
        console.warn("Speech recognition notice:", e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          isMonitoring = false;
          const btn = document.getElementById('vs-toggle-monitor-btn');
          if (btn) {
            btn.style.background = '#4f46e5';
            btn.textContent = '🎙️ Start Call Monitor';
          }
        }
      };

      rec.onend = () => {
        // Commit current session's final transcript into accumulator so words are never lost across speech pauses
        if (currentSessionFinal) {
          speechAccumulator = (speechAccumulator + ' ' + currentSessionFinal).replace(/\s+/g, ' ').trim();
          currentSessionFinal = '';
        }

        if (isMonitoring) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(() => {
            if (isMonitoring) {
              startWebSpeechRecognition();
            }
          }, 300);
        }
      };

      rec.start();
      speechRecognizer = rec;
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }

  function stopWebSpeechRecognition() {
    if (restartTimeout) clearTimeout(restartTimeout);
    if (analysisDebounceTimer) clearTimeout(analysisDebounceTimer);
    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (_) {}
      speechRecognizer = null;
    }
    // Commit any lingering words
    if (currentSessionFinal) {
      speechAccumulator = (speechAccumulator + ' ' + currentSessionFinal).replace(/\s+/g, ' ').trim();
      currentSessionFinal = '';
    }
  }

  // Update Telemetry Display on WhatsApp Web
  function applyTelemetry(data) {
    const pill = document.getElementById('vs-threat-pill');
    const verdict = document.getElementById('vs-verdict-title');
    const score = document.getElementById('vs-risk-score');
    const voice = document.getElementById('vs-voice-pill');
    const intent = document.getElementById('vs-intent-pill');
    const pillLabel = document.getElementById('vs-pill-label');

    const level = (data.risk_level || 'SAFE').toLowerCase();
    pill.className = `vs-threat-pill ${level}`;
    score.textContent = `${data.risk_score || 0}%`;
    verdict.textContent = `${data.verdict || 'CALL VERIFIED'}`;

    if (level === 'critical' || level === 'danger') {
      pillLabel.textContent = '🚨 DEEPFAKE THREAT DETECTED';
      pillLabel.style.color = '#f87171';
    } else if (level === 'high' || level === 'warn') {
      pillLabel.textContent = '⚠️ FRAUD ALERT DETECTED';
      pillLabel.style.color = '#facc15';
    } else {
      pillLabel.textContent = 'VoiceShield | WhatsApp Protected';
      pillLabel.style.color = '#f8fafc';
    }

    voice.textContent = data.voice === 'FAKE' ? '🚨 SYNTHETIC AI CLONE' : '✅ HUMAN VOICE';
    voice.className = `vs-sub-pill ${data.voice === 'FAKE' ? 'danger' : 'safe'}`;

    intent.textContent = data.intent === 'SCAM' ? '⚠️ FRAUD / OTP PATTERN' : '✅ NORMAL INTENT';
    intent.className = `vs-sub-pill ${data.intent === 'SCAM' ? 'danger' : 'safe'}`;
  }

  // Instant Simulation Test for Evaluators
  function runSimulatedAttack() {
    const transcriptEl = document.getElementById('vs-transcript-text');
    transcriptEl.textContent = '"Sir, this is Bank Security. Your account is frozen due to fraud. Provide your 6-digit OTP code immediately to avoid legal arrest."';

    applyTelemetry({
      risk_level: 'CRITICAL',
      risk_score: 95,
      verdict: '🔴 CRITICAL THREAT: DEEPFAKE SCAM ATTACK',
      voice: 'FAKE',
      intent: 'SCAM',
      transcript_snippet: transcriptEl.textContent
    });

    // Also forward to background so popup reflects it
    chrome.runtime.sendMessage({
      type: 'BROADCAST_TELEMETRY',
      data: {
        risk_level: 'CRITICAL',
        risk_score: 95,
        verdict: '🔴 CRITICAL THREAT: DEEPFAKE SCAM ATTACK',
        voice: 'FAKE',
        intent: 'SCAM',
        transcript_snippet: transcriptEl.textContent
      }
    });
  }

  // Draggable HUD functionality
  function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + "px";
      el.style.left = (el.offsetLeft - pos1) + "px";
      el.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
})();
