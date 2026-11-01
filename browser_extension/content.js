// VoiceShield Content Script - In-Call Floating HUD for WhatsApp Web & VoIP Calls
(function () {
  if (document.getElementById('voiceshield-overlay-root')) return;

  let rootContainer = null;
  let isExpanded = false;
  let isMonitoring = false;
  let activeSessionId = '';

  // Audio Pipeline State
  let audioContext = null;
  let mediaStream = null;
  let scriptProcessor = null;
  let audioAccumulator = [];
  let sliceIntervalTimer = null;

  // Speech Recognition State
  let speechRecognizer = null;
  let speechAccumulator = '';
  let currentSessionFinal = '';
  let restartTimeout = null;

  // Local scam indicators regex for instant in-tab alerting
  const SCAM_REGEX = /\b(otp|one time password|password|passwords|passcode|passcodes|cvv|pin|mpin|upi pin|atm pin|credentials?|login details|secret code|verification code|bank account|credit card|debit card|arrest|warrant|police|digital arrest|cbi|fbi|irs|kyc|account suspended|blocked|wire transfer|gift card|crypto|urgent|act immediately)\b/i;

  // Initialize once DOM is ready
  if (document.body) {
    initVoiceShieldHUD();
  } else {
    document.addEventListener('DOMContentLoaded', initVoiceShieldHUD);
  }

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

    if (msg.type === 'VOICESHIELD_SCAN_VOICE_NOTE') {
      expandWidget();
      scanLatestVoiceNote();
      sendResponse({ status: 'scanning_voice_note' });
    }

    if (msg.type === 'VOICESHIELD_TELEMETRY_DATA' && msg.data) {
      applyTelemetry(msg.data);
    }
  });

  // Automatically detect and scan WhatsApp voice messages when clicked
  document.addEventListener('play', async (e) => {
    if (e.target && (e.target.tagName === 'AUDIO' || e.target.tagName === 'VIDEO')) {
      const audioEl = e.target;
      if (audioEl.src && !audioEl._vs_scanned) {
        audioEl._vs_scanned = true;
        interceptWhatsAppVoiceNote(audioEl);
      }
    }
  }, true);

  function initVoiceShieldHUD() {
    if (document.getElementById('voiceshield-overlay-root')) return;

    rootContainer = document.createElement('div');
    rootContainer.id = 'voiceshield-overlay-root';

    // 1. Initial State: Floating Pill Trigger
    rootContainer.innerHTML = `
      <div class="vs-pill-trigger" id="vs-trigger-btn" title="Click to open VoiceShield WhatsApp Sentinel HUD">
        <span class="vs-shield-glow">🛡️</span>
        <span class="vs-pulse-indicator" id="vs-pulse-dot"></span>
        <span id="vs-pill-label">VoiceShield | WhatsApp Sentinel</span>
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
            <span class="vs-score-badge" id="vs-risk-score">10%</span>
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
            Ready. Click "Start Call Monitor" for active calls, or play any WhatsApp Voice Note to auto-scan.
          </div>

          <div class="vs-actions-row">
            <button class="vs-act-btn primary" id="vs-toggle-monitor-btn">
              🎙️ Start Call Monitor
            </button>
            <button class="vs-act-btn voice-note" id="vs-vn-scan-btn" title="Scan latest voice message playing in chat">
              🔍 Scan Voice Note
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
    const vnScanBtn = document.getElementById('vs-vn-scan-btn');
    const simBtn = document.getElementById('vs-sim-btn');

    triggerBtn.addEventListener('click', expandWidget);
    minBtn.addEventListener('click', collapseWidget);
    closeBtn.addEventListener('click', () => { rootContainer.style.display = 'none'; });

    toggleMonitorBtn.addEventListener('click', toggleLiveMonitor);
    vnScanBtn.addEventListener('click', scanLatestVoiceNote);
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
  async function toggleLiveMonitor() {
    isMonitoring = !isMonitoring;
    const btn = document.getElementById('vs-toggle-monitor-btn');
    const pulseDot = document.getElementById('vs-pulse-dot');
    const pillLabel = document.getElementById('vs-pill-label');

    if (isMonitoring) {
      activeSessionId = 'wa_sess_' + Date.now();
      btn.style.background = '#dc2626';
      btn.textContent = '⏹️ Stop Monitor';
      if (pulseDot) pulseDot.style.background = '#ef4444';
      if (pillLabel) pillLabel.textContent = '🚨 Monitoring Active';

      const transcriptEl = document.getElementById('vs-transcript-text');
      if (transcriptEl) {
        transcriptEl.textContent = '⚡ Starting acoustic capture & AI speech decoder...';
      }

      // Set initial analyzing status
      const voicePill = document.getElementById('vs-voice-pill');
      if (voicePill) {
        voicePill.textContent = '⚡ ANALYZING...';
        voicePill.className = 'vs-sub-pill analyzing';
      }

      // 1. Start Audio Stream Capture for PyTorch CNN
      const audioSuccess = await startAudioCapture();
      if (!audioSuccess && transcriptEl) {
        transcriptEl.textContent = '⚠️ Mic permission required for live call analysis. Allow mic access in Chrome site settings (lock icon in address bar).';
      }

      // 2. Start Web Speech Recognition for Captions
      startWebSpeechRecognition();

    } else {
      activeSessionId = '';
      btn.style.background = '#4f46e5';
      btn.textContent = '🎙️ Start Call Monitor';
      if (pulseDot) pulseDot.style.background = '#22c55e';
      if (pillLabel) pillLabel.textContent = 'VoiceShield | WhatsApp Sentinel';

      stopAudioCapture();
      stopWebSpeechRecognition();
    }
  }

  // 1. Audio Capture Pipeline (Streams 1.2s slices to PyTorch CNN)
  async function startAudioCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      mediaStream = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);

      // 4096 buffer size = ~256ms per audio process chunk
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      audioAccumulator = [];

      scriptProcessor.onaudioprocess = (e) => {
        if (!isMonitoring) return;
        const inputData = e.inputBuffer.getChannelData(0);
        audioAccumulator.push(new Float32Array(inputData));
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      // Package and dispatch slices every 1200ms
      sliceIntervalTimer = setInterval(() => {
        if (!isMonitoring || audioAccumulator.length === 0) return;

        let totalLen = 0;
        for (let i = 0; i < audioAccumulator.length; i++) {
          totalLen += audioAccumulator[i].length;
        }

        if (totalLen < 4000) return; // avoid empty slices

        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (let i = 0; i < audioAccumulator.length; i++) {
          merged.set(audioAccumulator[i], offset);
          offset += audioAccumulator[i].length;
        }
        audioAccumulator = [];

        // Encode to 16-bit PCM WAV ArrayBuffer
        const wavBuffer = encodeWavPCM(merged, audioContext.sampleRate || 16000);
        const base64Wav = arrayBufferToBase64(wavBuffer);

        const currentSpoken = (speechAccumulator + ' ' + currentSessionFinal).trim();
        chrome.runtime.sendMessage({
          type: 'ANALYZE_VOIP_STREAM',
          session_id: activeSessionId,
          transcript: currentSpoken,
          audioBase64: base64Wav
        }, (res) => {
          if (res && res.status === 'success') {
            applyTelemetry(res);
          }
        });
      }, 1200);

      return true;
    } catch (err) {
      console.warn("Audio capture error:", err);
      return false;
    }
  }

  function stopAudioCapture() {
    if (sliceIntervalTimer) {
      clearInterval(sliceIntervalTimer);
      sliceIntervalTimer = null;
    }
    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch (_) {}
      scriptProcessor = null;
    }
    if (audioContext) {
      try { audioContext.close(); } catch (_) {}
      audioContext = null;
    }
    if (mediaStream) {
      try { mediaStream.getTracks().forEach(t => t.stop()); } catch (_) {}
      mediaStream = null;
    }
    audioAccumulator = [];
  }

  // 2. Speech Recognition Pipeline
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
      rec.lang = 'en-US';

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

        const fullSpoken = (speechAccumulator + ' ' + currentSessionFinal + ' ' + interim).replace(/\s+/g, ' ').trim();
        const transcriptEl = document.getElementById('vs-transcript-text');
        if (fullSpoken && transcriptEl) {
          transcriptEl.textContent = `"${fullSpoken}"`;
          transcriptEl.scrollTop = transcriptEl.scrollHeight;
        }

        // Live broadcast to background & popup HUD
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
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn("Speech recognition notice:", e.error);
        }
      };

      rec.onend = () => {
        if (currentSessionFinal) {
          speechAccumulator = (speechAccumulator + ' ' + currentSessionFinal).replace(/\s+/g, ' ').trim();
          currentSessionFinal = '';
        }

        if (isMonitoring) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(() => {
            if (isMonitoring) {
              try { rec.start(); } catch (_) {}
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
    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch (_) {}
      speechRecognizer = null;
    }
    if (currentSessionFinal) {
      speechAccumulator = (speechAccumulator + ' ' + currentSessionFinal).replace(/\s+/g, ' ').trim();
      currentSessionFinal = '';
    }
  }

  // 3. WhatsApp Voice Note Interceptor
  async function interceptWhatsAppVoiceNote(audioEl) {
    const transcriptEl = document.getElementById('vs-transcript-text');
    if (transcriptEl) {
      transcriptEl.textContent = '⚡ Voice Note Intercepted: Performing deepfake acoustic forensic scan...';
    }
    expandWidget();

    try {
      if (audioEl.src) {
        const response = await fetch(audioEl.src);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result;
          chrome.runtime.sendMessage({
            type: 'ANALYZE_VOIP_STREAM',
            session_id: 'wa_vn_' + Date.now(),
            transcript: speechAccumulator || 'WhatsApp Audio Message',
            audioBase64: base64Data
          }, (res) => {
            if (res && res.status === 'success') {
              applyTelemetry(res);
              if (transcriptEl) {
                transcriptEl.textContent = `[Voice Note Analysis] Verdict: ${res.verdict} (Risk: ${res.risk_score}%)`;
              }
            }
          });
        };
        reader.readAsDataURL(blob);
      }
    } catch (err) {
      console.warn("Voice note intercept notice:", err);
    }
  }

  function scanLatestVoiceNote() {
    const audios = Array.from(document.querySelectorAll('audio'));
    if (audios.length === 0) {
      const transcriptEl = document.getElementById('vs-transcript-text');
      if (transcriptEl) {
        transcriptEl.textContent = "ℹ️ No voice message currently playing in chat. Play any WhatsApp voice note, and VoiceShield will scan it.";
      }
      return;
    }
    const targetAudio = audios.find(a => !a.paused) || audios[audios.length - 1];
    interceptWhatsAppVoiceNote(targetAudio);
  }

  // 4. Update Telemetry Display on WhatsApp Web
  function applyTelemetry(data) {
    const pill = document.getElementById('vs-threat-pill');
    const verdict = document.getElementById('vs-verdict-title');
    const score = document.getElementById('vs-risk-score');
    const voice = document.getElementById('vs-voice-pill');
    const intent = document.getElementById('vs-intent-pill');
    const pillLabel = document.getElementById('vs-pill-label');

    const level = (data.risk_level || 'SAFE').toLowerCase();
    if (pill) pill.className = `vs-threat-pill ${level}`;
    if (score) score.textContent = `${data.risk_score || 0}%`;
    if (verdict) verdict.textContent = `${data.verdict || 'CALL VERIFIED'}`;

    if (pillLabel) {
      if (level === 'critical' || level === 'danger') {
        pillLabel.textContent = '🚨 DEEPFAKE THREAT DETECTED';
        pillLabel.style.color = '#f87171';
      } else if (level === 'high' || level === 'warn') {
        pillLabel.textContent = '⚠️ FRAUD ALERT DETECTED';
        pillLabel.style.color = '#facc15';
      } else {
        pillLabel.textContent = isMonitoring ? '🟢 Monitoring Active' : 'VoiceShield | WhatsApp Sentinel';
        pillLabel.style.color = '#f8fafc';
      }
    }

    if (voice) {
      voice.textContent = data.voice === 'FAKE' ? '🚨 SYNTHETIC AI CLONE' : '✅ HUMAN VOICE';
      voice.className = `vs-sub-pill ${data.voice === 'FAKE' ? 'danger' : 'safe'}`;
    }

    if (intent) {
      intent.textContent = data.intent === 'SCAM' ? '⚠️ FRAUD / SCAM PATTERN' : '✅ NORMAL INTENT';
      intent.className = `vs-sub-pill ${data.intent === 'SCAM' ? 'danger' : 'safe'}`;
    }
  }

  // 5. Instant Simulation Test for Evaluators
  function runSimulatedAttack() {
    const transcriptEl = document.getElementById('vs-transcript-text');
    if (transcriptEl) {
      transcriptEl.textContent = '"Sir, this is Bank Cyber Cell. Your account is frozen due to fraud. Provide your password and 6-digit OTP code immediately to avoid legal arrest."';
    }

    applyTelemetry({
      risk_level: 'CRITICAL',
      risk_score: 95,
      verdict: '🔴 CRITICAL THREAT: DEEPFAKE SCAM ATTACK',
      voice: 'FAKE',
      intent: 'SCAM',
      transcript_snippet: transcriptEl ? transcriptEl.textContent : ''
    });

    chrome.runtime.sendMessage({
      type: 'BROADCAST_TELEMETRY',
      data: {
        risk_level: 'CRITICAL',
        risk_score: 95,
        verdict: '🔴 CRITICAL THREAT: DEEPFAKE SCAM ATTACK',
        voice: 'FAKE',
        intent: 'SCAM',
        transcript_snippet: transcriptEl ? transcriptEl.textContent : ''
      }
    });
  }

  // Pure JavaScript 16-bit PCM WAV Encoder
  function encodeWavPCM(samples, sampleRate) {
    const numChannels = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeStr(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    return buffer;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
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
