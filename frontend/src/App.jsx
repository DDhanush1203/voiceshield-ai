import { useState, useRef, useEffect } from 'react'
import { 
  UploadCloud, ShieldCheck, AlertTriangle, Activity, PlayCircle, 
  Mic, Square, Clock, FileText, Radio, BarChart3, Database,
  CheckCircle2, ThumbsUp, ThumbsDown, Trash2, Download, AlertOctagon,
  Zap, Volume2, User, LogIn, LogOut, UserPlus, KeyRound, Mail, Sparkles, X,
  GraduationCap, BookOpen, HelpCircle, PhoneCall, PhoneOff, ExternalLink,
  Award, ShieldAlert, CheckCircle, Info
} from 'lucide-react'
import RecordRTC from 'recordrtc'
import './App.css'

const API_BASE = '/api'

// Client-side instant scam vocabulary for zero-latency alerts
const SCAM_KEYWORDS_REGEX = [
  /\botp\b/i, /\bone time password\b/i, /\bcvv\b/i, /\bpin\b/i,
  /\bbank account\b/i, /\bcredit card\b/i, /\bdebit card\b/i,
  /\barrest\b/i, /\bwarrant\b/i, /\bpolice\b/i, /\birs\b/i,
  /\baccount suspended\b/i, /\baccount blocked\b/i, /\bwire transfer\b/i,
  /\bgift card\b/i, /\bcrypto\b/i, /\blottery\b/i, /\bcash prize\b/i,
  /\brefund\b/i, /\btech support\b/i, /\banydesk\b/i, /\bteamviewer\b/i,
  /\bremote access\b/i, /\burgent\b/i, /\bact immediately\b/i
]

// Educational Scam Tactics Dossiers
const SCAM_TACTICS = [
  {
    id: 'digital-arrest',
    icon: '⚖️',
    title: 'Digital Arrest & Law Enforcement Spoofing',
    category: 'High-Risk Extortion',
    hook: '"A FedEx parcel in your name containing fake passports and drugs was seized in Mumbai. An arrest warrant is active under Supreme Court orders. Stay on Skype for 24-hour Digital Arrest."',
    triggers: ['Fear of Criminal Charges', 'Authority Coercion', 'Social Isolation'],
    redFlags: [
      'Concept of "Digital Arrest" is 100% fake; Indian law has NO legal concept of Skype or video call arrest.',
      'Law enforcement (CBI, Police, ED) never conducts interrogations or sends warrants via WhatsApp/Skype.',
      'Coercion to stay isolated in a locked room and not inform family or legal counsel.'
    ],
    defense: 'Disconnect the call immediately. Real police serve physical written summons, never digital arrests over video calls. Report immediately to 1930.'
  },
  {
    id: 'voice-clone',
    icon: '👨‍👩‍👧',
    title: 'AI Voice Clone & Family Distress Scam',
    category: 'Generative AI Impersonation',
    hook: '"Dad! Dad please help me! I was in a terrible road accident! The police locked me up and need 2 lakh cash bail right now via UPI to release me, please hurry dad!"',
    triggers: ['Severe Panic', 'Parental Affection', 'Manufactured Time Pressure'],
    redFlags: [
      'Cloned audio synthesized using 3-second audio harvested from social media (Instagram, TikTok, YouTube).',
      'Extreme crying/sobbing used deliberately to mask vocoder acoustic artifacts.',
      'Immediate demand for peer-to-peer wire transfer, UPI, or cryptocurrency.'
    ],
    defense: 'Take a deep breath and do NOT transfer money. Challenge the caller with your pre-established Family Safe-Word. Hang up and dial your family member on their primary number.'
  },
  {
    id: 'bank-kyc',
    icon: '🏦',
    title: 'Bank KYC & Urgent OTP Invalidation',
    category: 'Credentials Theft',
    hook: '"This is Senior Manager Rajesh from HDFC Bank. Your debit card and NetBanking will be permanently terminated tonight. I am sending a 6-digit verification code. Read it to me now to preserve your account."',
    triggers: ['Loss Aversion', 'Artificial Urgency', 'Fake Official Persona'],
    redFlags: [
      'Banks NEVER ask for OTP, PIN, CVV, or passwords over the phone under any circumstances.',
      'Artificial deadline ("30 minutes before account freeze") designed to trigger panic.',
      'Spoofed Caller ID making it appear as if the call originates from the bank\'s official number.'
    ],
    defense: 'Never read out or share an OTP. OTP is only used to AUTHORIZE debits from your account. Verify your KYC status exclusively on the official NetBanking portal.'
  },
  {
    id: 'customs-courier',
    icon: '📦',
    title: 'Customs & Contraband Courier Seizure',
    category: 'Logistics Fraud',
    hook: '"FedEx Customer Service: Your parcel to Taiwan has been intercepted by Customs holding illegal SIM cards and narcotics. Pay the customs penalty verification fee now to avoid arrest."',
    triggers: ['Shock Factor', 'Confusion', 'Legal Intimidation'],
    redFlags: [
      'Couriers (FedEx, BlueDart, DHL) do not act as police and cannot demand bail or fine payments over phone.',
      'Demand for UPI transfers to personal savings accounts instead of official customs gateways.'
    ],
    defense: 'Track any package on the official courier website using your legitimate tracking number. Do not entertain unsolicited phone calls.'
  },
  {
    id: 'tech-support',
    icon: '💻',
    title: 'Remote Desktop Tech Support Takeover',
    category: 'Device Compromise',
    hook: '"Microsoft Windows Security: Your computer has transmitted 32 trojan viruses onto our server. Install AnyDesk / TeamViewer immediately so our engineer can clean your hard drive."',
    triggers: ['Technical Intimidation', 'Fear of Data Loss', 'Authority'],
    redFlags: [
      'Microsoft or Apple never makes unsolicited calls regarding operating system errors.',
      'Installing AnyDesk, TeamViewer, or QuickSupport gives the scammer complete remote control over your banking tabs.'
    ],
    defense: 'Hang up immediately. Never install remote access software on instructions from an unsolicited caller.'
  },
  {
    id: 'part-time-job',
    icon: '📈',
    title: 'Telegram Part-Time Task & Crypto Scam',
    category: 'Financial Greed & Ponzi',
    hook: '"Earn Rs 5,000 to Rs 20,000 daily from home just by liking YouTube videos and Google reviews! Deposit Rs 1,000 prepaid recharge to unlock your Rs 5,000 payout."',
    triggers: ['Easy Money', 'Greed', 'Initial Small Payouts to Gain Trust'],
    redFlags: [
      'No legitimate enterprise pays Rs 500 per YouTube like or Google review.',
      'Demanding prepaid deposits to "unlock" or "withdraw" earned profits.'
    ],
    defense: 'Never pay money to receive money. Block and report the Telegram or WhatsApp group.'
  }
]

// Educational Scenarios for Interactive Quiz
const SCAM_SCENARIOS = [
  {
    id: 's1',
    title: 'Urgent Bank Manager KYC Call',
    caller: 'Caller ID: +91-22-61606161 (Bank Cyber Cell)',
    dialogue: '"Sir, your bank account and debit card are scheduled for permanent freeze in 30 minutes due to pending KYC update. I am sending an official authorization OTP right now. Read out the 6-digit OTP immediately to avoid account penalty of Rs 5,000."',
    isScam: true,
    category: 'Financial OTP Fraud',
    explanation: 'Scam! Legitimate banks NEVER ask for OTP over the phone. OTP is solely used to debit money from your account. The 30-minute freeze threat is artificial urgency designed to stop you from thinking critically.',
    safeAction: 'Hang up immediately. Check your account status directly via official mobile banking app.'
  },
  {
    id: 's2',
    title: 'Daughter in Distress Video/Voice Call',
    caller: 'Caller ID: Unknown Number (Voice sounds identical to Daughter)',
    dialogue: '"Dad! Dad please help me! I was in an Uber and we hit someone, the police arrested me at the station! The inspector says if we pay 2 lakh bail right now in cash via UPI they won\'t lock me in jail, please hurry dad!"',
    isScam: true,
    category: 'AI Voice Cloning Distress',
    explanation: 'Scam! This is a Virtual Kidnapping voice clone synthesized using 3 seconds of audio from social media. The intense crying is deliberately used to mask vocoder acoustic artifacts.',
    safeAction: 'Ask for the Family Safe-Word. Disconnect and call your daughter\'s personal phone number directly.'
  },
  {
    id: 's3',
    title: 'CBI Narcotics & Digital Arrest',
    caller: 'Caller ID: 011-24361551 (Delhi Police Headquarters)',
    dialogue: '"A FedEx parcel sent in your name to Bangkok was intercepted containing 5 expired passports and 140 grams of MDMA narcotics. A non-bailable warrant has been issued by the Supreme Court. Join Skype video call immediately for 24-hour Digital Arrest."',
    isScam: true,
    category: 'Digital Arrest Extortion',
    explanation: 'Scam! "Digital Arrest" is a complete fraud; Indian criminal law has zero provisions for online Skype arrest. Police never conduct video investigations or demand asset verification transfers.',
    safeAction: 'Hang up and report immediately to 1930 (National Cyber Crime Portal).'
  },
  {
    id: 's4',
    title: 'Hospital Appointment Confirmation',
    caller: 'Caller ID: Apollo Clinic Reception (+91-80-22221111)',
    dialogue: '"Good afternoon, this is Priya calling from Apollo Clinic. We are confirming your scheduled dental consultation with Dr. Sharma tomorrow at 4:30 PM. Please carry your previous prescription. No advance payment is needed."',
    isScam: false,
    category: 'Legitimate Confirmation',
    explanation: 'Authentic Call! Zero artificial panic, no request for passwords or OTPs, and no demand for financial transactions. Simply confirming a scheduled service.',
    safeAction: 'Confirm your availability. Legitimate service calls do not request confidential authentication credentials.'
  }
]

// Forensics Comparison Table Data
const FORENSICS_TABLE = [
  {
    feature: 'Pitch Micro-Fluctuations (Jitter)',
    human: 'Natural vocal chord jitter (0.5% – 1.2%) with organic pitch contour',
    synthetic: 'Mathematically flat or unnaturally smoothed pitch curves from TTS vocoder',
    technique: 'Mel-Spectrogram Harmonic Texture Analysis'
  },
  {
    feature: 'Amplitude Variance (Shimmer)',
    human: 'Dynamic micro-amplitude shifts caused by lung pressure and breath turbulence',
    synthetic: 'Overly consistent amplitude envelope with robotic energy distribution',
    technique: 'Short-Time Fourier Transform (STFT) Frame Analysis'
  },
  {
    feature: 'Phase Coherence & Spectral Cutoff',
    human: 'Continuous natural spectral decay across all frequency bands up to 16 kHz',
    synthetic: 'Sharp spectral rolloff at 8 kHz or phase discontinuities between phonemes',
    technique: 'PyTorch 128-Mel Frequency Filter Bank CNN'
  },
  {
    feature: 'Diaphragmatic Breath Pauses',
    human: 'Natural acoustic pauses containing subtle inhalation and lip-smack sounds',
    synthetic: 'Mathematical digital silence or unnatural abrupt energy transitions',
    technique: 'Silence Interval & Energy Envelope Variance'
  },
  {
    feature: 'Linguistic Intent & Urgency',
    human: 'Normal conversational pacing with spontaneous vocabulary',
    synthetic: 'High density of social engineering keywords (OTP, arrest, urgent, KYC)',
    technique: 'TF-IDF Vectorizer + Logistic Regression Classifier'
  }
]

function App() {
  const [activeTab, setActiveTab] = useState('studio') // 'studio', 'sentinel', 'analytics', 'history', 'defense'
  const [defenseSection, setDefenseSection] = useState('tactics') // 'tactics', 'forensics', 'quiz', 'extension', 'helplines'

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState({})
  const [quizScore, setQuizScore] = useState(0)

  // Telephony Hook Simulation State
  const [simActive, setSimActive] = useState(null)
  const [simCountdown, setSimCountdown] = useState(0)
  const [simData, setSimData] = useState(null)

  // User Authentication State
  const [user, setUser] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: ''
  })
  const [authError, setAuthError] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Studio State
  const [file, setFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  
  // Real-time microphone audio visualizer state
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordDuration, setRecordDuration] = useState(0)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const recordTimerRef = useRef(null)

  // Live Sentinel State
  const [isSentinelActive, setIsSentinelActive] = useState(false)
  const [sentinelTimer, setSentinelTimer] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [liveKeywords, setLiveKeywords] = useState([])
  const [sentinelData, setSentinelData] = useState({
    riskScore: 0,
    riskLevel: 'SAFE',
    verdict: 'STANDBY',
    voice: 'NORMAL',
    intent: 'NORMAL'
  })

  const sentinelTimerRef = useRef(null)
  const sentinelStreamRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptAccumulatorRef = useRef('')
  const latestInterimRef = useRef('')
  const isSentinelRunningRef = useRef(false)
  const recentSlicesRef = useRef([])

  // Database / History / Stats State
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const mediaRecorderRef = useRef(null)

  const getAuthHeaders = () => {
    const token = localStorage.getItem('vs_token')
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  // Resilient API client with automatic direct port 5000 fallback
  const fetchApi = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`
    try {
      return await fetch(url, options)
    } catch (err) {
      const fallbackUrl = `http://127.0.0.1:5000/api${endpoint.startsWith('/') ? '' : '/'}${endpoint.replace(/^\/?api\/?/, '')}`
      return await fetch(fallbackUrl, options)
    }
  }

  // Restore authenticated session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vs_token')
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.status === 'success' && data.user) {
          setUser(data.user)
        } else {
          localStorage.removeItem('vs_token')
          setUser(null)
        }
      } catch (e) {
        console.warn("Auth session check error:", e)
      }
    }
    checkAuth()
  }, [])

  const fetchHistoryAndStats = async () => {
    try {
      const headers = getAuthHeaders()
      const histRes = await fetchApi('/history', { headers })
      const histData = await histRes.json()
      if (histData.status === 'success') {
        setHistory(histData.history)
      }

      const statsRes = await fetchApi('/stats', { headers })
      const statsData = await statsRes.json()
      if (statsData.status === 'success') {
        setStats(statsData.stats)
      }
    } catch (err) {
      console.error("Failed to fetch DB:", err)
    }
  }

  useEffect(() => {
    fetchHistoryAndStats()
  }, [activeTab, user])

  // Studio File Upload Handler
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setAudioUrl(URL.createObjectURL(selectedFile))
    setResult(null)
    setError(null)
    setFeedbackSent(false)
  }

  // Single Studio Recording using RecordRTC with Real-Time Audio Level Meter
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })

      // Real-time Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        const audioCtx = new AudioCtx()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.4
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)
        audioContextRef.current = audioCtx
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const checkLevel = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const avg = sum / dataArray.length
          const normalized = Math.min(100, Math.round((avg / 90) * 100))
          setAudioLevel(normalized)
          animFrameRef.current = requestAnimationFrame(checkLevel)
        }
        checkLevel()
      } catch (audioErr) {
        console.warn("AudioContext visualizer initialization:", audioErr)
      }

      mediaRecorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
        bufferSize: 4096
      })
      mediaRecorderRef.current.startRecording()
      mediaRecorderRef.current.stream = stream
      
      setIsRecording(true)
      setRecordDuration(0)
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1)
      }, 1000)

      setResult(null)
      setError(null)
      setFile(null)
      setAudioUrl(null)
      setFeedbackSent(false)
    } catch (err) {
      setError("Microphone access denied or unavailable: " + (err.message || ""))
    }
  }

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (_) {}
      audioContextRef.current = null
      analyserRef.current = null
    }
    setAudioLevel(0)

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stopRecording(() => {
        const audioBlob = mediaRecorderRef.current.getBlob()
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        const recordFile = new File([audioBlob], "live_recording.wav", { type: "audio/wav" })
        setFile(recordFile)
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
      })
    }
  }

  // Studio Dual-Layer Analysis
  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setFeedbackSent(false)

    const formData = new FormData()
    formData.append('file', file)
    const token = localStorage.getItem('vs_token')
    if (token) {
      formData.append('token', token)
    }

    try {
      const response = await fetchApi('/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      })
      
      if (!response.ok) {
        let msg = `Server returned status ${response.status}`
        try {
          const errData = await response.json()
          msg = errData.error || msg
        } catch (_) {}
        throw new Error(msg)
      }

      const data = await response.json()
      setResult(data)
      setLoading(false)
      fetchHistoryAndStats()
    } catch (err) {
      const errorMsg = (err.message === 'Failed to fetch' || err.name === 'TypeError')
        ? 'Cannot connect to Deepfake AI backend server. Please verify the Flask server is running on port 5000.'
        : err.message
      setError(errorMsg)
      setLoading(false)
    }
  }

  const handleFeedback = async (flag) => {
    if (!result?.scan_id) return
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ scan_id: result.scan_id, user_flag: flag })
      })
      setFeedbackSent(true)
    } catch (err) {
      console.error("Feedback error:", err)
    }
  }

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear your scan records from the database?")) {
      await fetch(`${API_BASE}/history`, { method: 'DELETE', headers: getAuthHeaders() })
      fetchHistoryAndStats()
    }
  }

  // Auth Modal Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      if (authMode === 'login') {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authForm.username,
            password: authForm.password
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Login failed.')

        localStorage.setItem('vs_token', data.user.token)
        setUser(data.user)
        setAuthModalOpen(false)
        setAuthForm({ username: '', fullName: '', email: '', password: '' })
      } else {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authForm.username,
            full_name: authForm.fullName || authForm.username,
            email: authForm.email,
            password: authForm.password
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Registration failed.')

        localStorage.setItem('vs_token', data.user.token)
        setUser(data.user)
        setAuthModalOpen(false)
        setAuthForm({ username: '', fullName: '', email: '', password: '' })
      }
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleQuickDemoLogin = async () => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'demo',
          password: 'password123'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Demo login failed.')

      localStorage.setItem('vs_token', data.user.token)
      setUser(data.user)
      setAuthModalOpen(false)
      setAuthForm({ username: '', fullName: '', email: '', password: '' })
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('vs_token')
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      }
    } catch (e) {
      console.warn("Logout error:", e)
    } finally {
      localStorage.removeItem('vs_token')
      setUser(null)
    }
  }

  // Quiz Answer Handler
  const handleQuizAnswer = (scenarioId, selectedIsScam) => {
    const updated = { ...quizAnswers, [scenarioId]: selectedIsScam }
    setQuizAnswers(updated)

    // Calculate score
    let correct = 0
    SCAM_SCENARIOS.forEach(sc => {
      if (updated[sc.id] !== undefined && updated[sc.id] === sc.isScam) {
        correct += 1
      }
    })
    setQuizScore(Math.round((correct / SCAM_SCENARIOS.length) * 100))
  }

  // Telephony Hook Simulation Handler
  const runTelephonySimulation = (type) => {
    setSimActive(type)
    setSimCountdown(3)
    setSimData(null)

    const timer = setInterval(() => {
      setSimCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (type === 'whatsapp') {
            setSimData({
              platform: 'WhatsApp Web Voice Call',
              caller: '+91-98450-XXXXX',
              voice: 'REAL',
              voiceConf: 94.2,
              intent: 'SCAM',
              intentConf: 91.5,
              verdict: 'HUMAN SOCIAL ENGINEERING SCAM',
              riskLevel: 'HIGH',
              riskScore: 78,
              transcript: 'Sir your HDFC card is blocked give me the 6 digit OTP immediately to reactivate.'
            })
          } else {
            setSimData({
              platform: 'Google Meet Conference',
              caller: 'Audio Stream Channel #1',
              voice: 'FAKE',
              voiceConf: 89.6,
              intent: 'SCAM',
              intentConf: 88.0,
              verdict: 'CRITICAL THREAT: DEEPFAKE SCAM ATTACK',
              riskLevel: 'CRITICAL',
              riskScore: 92,
              transcript: 'Dad please wire 2 lakh bail right now I am at the police station!'
            })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ==================== ULTRA-FAST LIVE CALL SENTINEL ====================
  const startSentinel = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      })
      sentinelStreamRef.current = stream
      setIsSentinelActive(true)
      isSentinelRunningRef.current = true
      setSentinelTimer(0)
      setLiveTranscript('')
      setLiveKeywords([])
      transcriptAccumulatorRef.current = ''
      recentSlicesRef.current = []

      // 1. Call Clock Timer
      sentinelTimerRef.current = setInterval(() => {
        setSentinelTimer(prev => prev + 1)
      }, 1000)

      // 2. Real-Time Zero-Latency Native Browser Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition()
          rec.continuous = true
          rec.interimResults = true
          rec.lang = navigator.language || 'en-IN'

          rec.onresult = (event) => {
            let interim = ''
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                transcriptAccumulatorRef.current += ' ' + event.results[i][0].transcript
              } else {
                interim += event.results[i][0].transcript
              }
            }
            latestInterimRef.current = interim

            const currentSpoken = (transcriptAccumulatorRef.current + ' ' + interim).trim()
            setLiveTranscript(currentSpoken)

            if (currentSpoken) {
              const matchedKw = []
              SCAM_KEYWORDS_REGEX.forEach(reg => {
                const match = currentSpoken.match(reg)
                if (match) matchedKw.push(match[0].toLowerCase())
              })
              setLiveKeywords([...new Set(matchedKw)])
            }
          }

          rec.onerror = (e) => {
            console.warn("Native Web Speech API:", e.error)
          }

          rec.onend = () => {
            if (isSentinelRunningRef.current) {
              setTimeout(() => {
                if (isSentinelRunningRef.current) {
                  try { rec.start() } catch (e) {}
                }
              }, 300)
            }
          }

          rec.start()
          recognitionRef.current = rec
        } catch (e) {
          console.warn("Could not start Web Speech Recognition:", e)
        }
      }

      // 3. Fast Rolling 2.5-Second Acoustic & Intent Slices (Zero-Gap)
      const processSentinelSlice = () => {
        if (!isSentinelRunningRef.current || !sentinelStreamRef.current) return

        const recorder = new RecordRTC(sentinelStreamRef.current, {
          type: 'audio',
          mimeType: 'audio/wav',
          recorderType: RecordRTC.StereoAudioRecorder,
          desiredSampRate: 16000,
          bufferSize: 4096
        })

        recorder.startRecording()

        setTimeout(() => {
          if (!isSentinelRunningRef.current) return
          // Immediately chain next slice so no conversational gaps occur
          processSentinelSlice()

          recorder.stopRecording(async () => {
            const blob = recorder.getBlob()
            try { recorder.destroy() } catch (_) {}
            const chunkFile = new File([blob], "slice.wav", { type: "audio/wav" })
            const fd = new FormData()
            fd.append('chunk', chunkFile)
            const fullSpoken = (transcriptAccumulatorRef.current + ' ' + (latestInterimRef.current || '')).trim()
            fd.append('transcript', fullSpoken)

            try {
              const res = await fetchApi('/sentinel', { 
                method: 'POST', 
                headers: getAuthHeaders(),
                body: fd 
              })
              const data = await res.json()
              if (data.status === 'success') {
                // Temporal Rolling Window & Consensus Engine
                // Keep the last 4 consecutive slices for robust temporal smoothing
                recentSlicesRef.current.push(data)
                if (recentSlicesRef.current.length > 4) {
                  recentSlicesRef.current.shift()
                }

                const slices = recentSlicesRef.current
                
                // Voice Consensus: requires at least 2 slices to flag FAKE
                // This prevents 1 isolated pause, cough, or mic artifact from flipping voice to FAKE
                const fakeCount = slices.filter(s => s.voice === 'FAKE').length
                const consolidatedVoice = fakeCount >= 2 ? 'FAKE' : 'REAL'

                // Intent Consensus: If current slice or recent history flagged scam keywords
                const scamCount = slices.filter(s => s.intent === 'SCAM').length
                const consolidatedIntent = (scamCount >= 1 || data.intent === 'SCAM') ? 'SCAM' : 'SAFE'

                // Weighted Exponential Moving Average (EMA) for smooth risk score
                let smoothedScore = data.risk_score
                if (slices.length >= 2) {
                  const weights = slices.length === 2 ? [0.4, 0.6] :
                                  slices.length === 3 ? [0.2, 0.3, 0.5] : [0.1, 0.2, 0.3, 0.4]
                  let weightedSum = 0
                  for (let i = 0; i < slices.length; i++) {
                    weightedSum += (slices[i].risk_score || 0) * weights[i]
                  }
                  smoothedScore = Math.round(weightedSum)
                }

                // Compute unified verdict from consensus
                let consolidatedVerdict = data.verdict
                let consolidatedRiskLevel = data.risk_level

                if (consolidatedVoice === 'FAKE' && consolidatedIntent === 'SCAM') {
                  consolidatedVerdict = 'CRITICAL THREAT: DEEPFAKE SCAM ATTACK'
                  consolidatedRiskLevel = 'CRITICAL'
                  smoothedScore = Math.max(smoothedScore, 85)
                } else if (consolidatedVoice === 'FAKE') {
                  consolidatedVerdict = 'VOICE IMPERSONATION DETECTED'
                  consolidatedRiskLevel = 'HIGH'
                  smoothedScore = Math.max(smoothedScore, 65)
                } else if (consolidatedIntent === 'SCAM') {
                  consolidatedVerdict = 'HUMAN SOCIAL ENGINEERING SCAM'
                  consolidatedRiskLevel = 'HIGH'
                  smoothedScore = Math.max(smoothedScore, 50)
                } else {
                  // Both voice and intent are verified SAFE
                  if (!fullSpoken && (data.verdict.includes('LISTENING') || !data.has_active_speech)) {
                    consolidatedVerdict = 'LISTENING (CALL SECURED)'
                    consolidatedRiskLevel = 'SAFE'
                    smoothedScore = Math.min(smoothedScore, 10)
                  } else {
                    consolidatedVerdict = 'AUTHENTIC CALL (SAFE)'
                    consolidatedRiskLevel = 'SAFE'
                    smoothedScore = Math.min(smoothedScore, 25)
                  }
                }

                setSentinelData({
                  riskScore: smoothedScore,
                  riskLevel: consolidatedRiskLevel,
                  verdict: consolidatedVerdict,
                  voice: consolidatedVoice,
                  intent: consolidatedIntent
                })
              }
            } catch (err) {
              console.error("Sentinel slice error:", err)
            }
          })
        }, 2500)
      }

      processSentinelSlice()

    } catch (err) {
      alert("Microphone permission denied for Sentinel: " + err.message)
    }
  }

  const stopSentinel = () => {
    setIsSentinelActive(false)
    isSentinelRunningRef.current = false
    recentSlicesRef.current = []
    if (sentinelTimerRef.current) clearInterval(sentinelTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
    }
    if (sentinelStreamRef.current) {
      sentinelStreamRef.current.getTracks().forEach(t => t.stop())
      sentinelStreamRef.current = null
    }
  }

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="page-wrapper">
      <div className="main-content">
        
        {/* ================= TOP APP HEADER & AUTH BAR ================= */}
        <div className="app-header-bar">
          <div className="brand-zone">
            <div className="brand-icon-wrapper">
              <ShieldCheck size={30} className="brand-shield" />
            </div>
            <div>
              <div className="brand-title">VoiceShield AI</div>
              <div className="brand-subtitle">PES University &bull; MCA Capstone Project</div>
            </div>
          </div>

          <div className="auth-zone">
            {user ? (
              <div className="user-profile-badge">
                <div className="avatar-circle">
                  <User size={16} />
                </div>
                <div className="user-meta">
                  <span className="user-name">{user.full_name}</span>
                  <span className="user-tag">@{user.username}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn" title="Sign Out">
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="auth-btn-group">
                <button 
                  onClick={() => { setAuthMode('login'); setAuthModalOpen(true); setAuthError(null); }} 
                  className="auth-btn login"
                >
                  <LogIn size={15} /> Sign In
                </button>
                <button 
                  onClick={() => { setAuthMode('register'); setAuthModalOpen(true); setAuthError(null); }} 
                  className="auth-btn register"
                >
                  <UserPlus size={15} /> Register
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================= NAVIGATION TABS HEADER ================= */}
        <div className="nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => setActiveTab('studio')}
          >
            <Activity size={18} /> Detection Studio
          </button>
          <button 
            className={`tab-btn ${activeTab === 'sentinel' ? 'active' : ''}`}
            onClick={() => setActiveTab('sentinel')}
          >
            <Radio size={18} /> Live Sentinel
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={18} /> Analytics & Intel
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Database size={18} /> Audit Vault ({history.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'defense' ? 'active' : ''}`}
            onClick={() => setActiveTab('defense')}
          >
            <GraduationCap size={18} /> Defense & Extension
          </button>
        </div>

        {/* ==================== TAB 1: DETECTION STUDIO ==================== */}
        {activeTab === 'studio' && (
          <div className="container">
            <header>
              <div className="logo-badge">
                <ShieldCheck size={36} strokeWidth={2.5} />
                <span>PHASE 2 &bull; DUAL-LAYER AI ENGINE</span>
              </div>
              <h1>VoiceShield Studio</h1>
              <p>Dual-Layer Acoustic Spectrogram Analysis + NLP Intent Scrutiny</p>
            </header>

            <div className="input-options">
              <div className="upload-box">
                <UploadCloud size={40} className="icon-gray" />
                <h4>Upload Audio</h4>
                <input type="file" accept="audio/*" onChange={handleFileChange} id="file-upload" />
                <label htmlFor="file-upload" className="action-btn outline">Browse Files</label>
              </div>

              <div className="separator"><span>OR</span></div>

              <div className={`record-box ${isRecording ? 'recording' : ''}`}>
                {isRecording ? <Activity size={40} className="pulse-red" /> : <Mic size={40} className="icon-gray" />}
                <h4>Live Mic Capture</h4>
                
                {isRecording && (
                  <div className="audio-visualizer-wrap">
                    <div className="audio-visualizer">
                      {[0.5, 0.9, 1.3, 1.0, 0.6, 1.2, 0.8].map((factor, idx) => (
                        <div 
                          key={idx} 
                          className="audio-bar" 
                          style={{ height: `${Math.max(4, Math.min(26, Math.round(audioLevel * factor * 0.26)))}px` }}
                        />
                      ))}
                    </div>
                    <span className={`mic-status-pill ${audioLevel > 5 ? 'active' : 'listening'}`}>
                      {audioLevel > 5 ? `🟢 Voice Detected (${audioLevel}%)` : `🟡 Listening (Speak into mic)`}
                    </span>
                    <span className="record-clock">
                      ⏱️ {String(Math.floor(recordDuration / 60)).padStart(2, '0')}:{String(recordDuration % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}

                {isRecording ? (
                  <button onClick={stopRecording} className="action-btn stop"><Square size={16}/> Stop Recording</button>
                ) : (
                  <button onClick={startRecording} className="action-btn primary outline"><Mic size={16}/> Start Recording</button>
                )}
              </div>
            </div>

            {file && !isRecording && (
              <div className="active-file">
                <p>Ready to analyze: <strong>{file.name}</strong></p>
                {audioUrl && <audio src={audioUrl} controls className="custom-audio" />}
              </div>
            )}

            <button 
              onClick={handleAnalyze} 
              disabled={!file || loading || isRecording} 
              className={`analyze-btn ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <><Activity className="spin-icon" /> Running Dual-Layer AI Pipeline...</>
              ) : (
                <><PlayCircle /> Scan Audio</>
              )}
            </button>

            {error && <div className="error-box"><AlertTriangle size={24} /> <div>{error}</div></div>}

            {/* DUAL-LAYER SCAN RESULTS */}
            {result && (
              <div className={`dual-result-card border-${result.risk_level.toLowerCase()}`}>
                
                {/* Unified Threat Header */}
                <div className={`threat-banner bg-${result.risk_level.toLowerCase()}`}>
                  <div className="banner-icon">
                    {result.risk_level === 'CRITICAL' ? <AlertOctagon size={32} /> : 
                     result.risk_level === 'HIGH' ? <AlertTriangle size={32} /> : <ShieldCheck size={32} />}
                  </div>
                  <div>
                    <span className="threat-label">VERDICT &bull; {result.risk_level} THREAT</span>
                    <h2 className="verdict-title">{result.verdict}</h2>
                  </div>
                  <div className="threat-score">
                    <span className="score-num">{result.overall_risk_score}</span>
                    <span className="score-lbl">Risk Index</span>
                  </div>
                </div>

                <div className="action-callout">
                  <strong>Recommended Action:</strong> {result.action}
                </div>

                {/* Dual Engine Side-by-Side Grid */}
                <div className="engine-grid">
                  
                  {/* LAYER 1: ACOUSTIC SPECTROGRAM CNN */}
                  <div className="engine-panel">
                    <div className="panel-header">
                      <Volume2 size={20} className="text-indigo" />
                      <div>
                        <h3>Layer 1: Acoustic Forensic Model</h3>
                        <span className="sub">PyTorch Mel-Spectrogram CNN</span>
                      </div>
                    </div>

                    <div className="metric-row">
                      <span>Acoustic Classification:</span>
                      <span className={`pill-badge ${result.prediction === 'FAKE' ? 'danger' : 'safe'}`}>
                        {result.prediction === 'FAKE' ? 'SYNTHETIC AI VOICE' : 'NATURAL HUMAN VOICE'}
                      </span>
                    </div>

                    <div className="metric-row">
                      <span>Synthetic Probability:</span>
                      <strong>{result.fake_probability}%</strong>
                    </div>

                    <div className="progress-bar-bg">
                      <div 
                        className={`progress-bar-fill ${result.prediction === 'FAKE' ? 'bg-danger' : 'bg-safe'}`} 
                        style={{ width: `${result.fake_probability}%` }}
                      />
                    </div>

                    <div className="spectrogram-container">
                      <span className="spec-label">Extracted Mel-Spectrogram Image:</span>
                      {result.spectrogram && (
                        <img 
                          src={`data:image/png;base64,${result.spectrogram}`} 
                          alt="Mel Spectrogram" 
                          className="spectrogram-img" 
                        />
                      )}
                    </div>

                    {result.acoustic_biomarkers && result.acoustic_biomarkers.pitch_jitter !== undefined && (
                      <div className="biomarker-explain-box">
                        <span className="spec-label">Acoustic Biomarkers (Explainable XAI):</span>
                        <div className="biomarker-mini-grid">
                          <div className="bio-mini-card">
                            <span className="bio-lbl">Pitch Jitter (F0)</span>
                            <strong>{result.acoustic_biomarkers.pitch_jitter}</strong>
                            <small className={result.acoustic_biomarkers.pitch_jitter < 0.10 || result.acoustic_biomarkers.is_neural_tts ? 'text-red' : 'text-green'}>
                              {result.acoustic_biomarkers.pitch_jitter_status}
                            </small>
                          </div>
                          <div className="bio-mini-card">
                            <span className="bio-lbl">Spectral Rolloff</span>
                            <strong>{result.acoustic_biomarkers.spectral_rolloff} Hz</strong>
                            <small className={result.acoustic_biomarkers.spectral_rolloff < 2700 || result.acoustic_biomarkers.is_neural_tts ? 'text-red' : 'text-green'}>
                              {result.acoustic_biomarkers.spectral_rolloff_status}
                            </small>
                          </div>
                        </div>
                        {result.acoustic_biomarkers.is_human_biology && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                            ✓ Natural human vocal cord micro-fluctuations verified
                          </div>
                        )}
                        {result.acoustic_biomarkers.is_neural_tts && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                            ⚠ Neural TTS high-frequency synthesis & studio vocoder artifacts detected
                          </div>
                        )}
                        {result.acoustic_biomarkers.is_synthetic_vocoder && !result.acoustic_biomarkers.is_neural_tts && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                            ⚠ Artificial vocoder pitch flatness & cutoff wall detected
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LAYER 2: NLP CONVERSATIONAL INTENT */}
                  <div className="engine-panel">
                    <div className="panel-header">
                      <Zap size={20} className="text-yellow" />
                      <div>
                        <h3>Layer 2: Intent Analysis Model</h3>
                        <span className="sub">TF-IDF &bull; Logistic Regression</span>
                      </div>
                    </div>

                    <div className="metric-row">
                      <span>Conversational Intent:</span>
                      <span className={`pill-badge ${result.intent?.prediction === 'SCAM' ? 'danger' : 'safe'}`}>
                        {result.intent?.prediction === 'SCAM' ? 'FRAUDULENT / SCAM' : 'LEGITIMATE CALL'}
                      </span>
                    </div>

                    <div className="metric-row">
                      <span>Scam Confidence:</span>
                      <strong>{result.intent?.scam_probability}%</strong>
                    </div>

                    <div className="progress-bar-bg">
                      <div 
                        className={`progress-bar-fill ${result.intent?.prediction === 'SCAM' ? 'bg-danger' : 'bg-safe'}`} 
                        style={{ width: `${result.intent?.scam_probability}%` }}
                      />
                    </div>

                    <div className="transcript-box">
                      <span className="transcript-label">Transcribed Speech:</span>
                      <p className="transcript-text">
                        {result.transcript ? `"${result.transcript}"` : <span className="text-dim">No audible words detected.</span>}
                      </p>
                    </div>

                    {result.intent?.keywords && result.intent.keywords.length > 0 && (
                      <div className="keywords-container">
                        <span className="kw-label">Flagged High-Risk Keywords:</span>
                        <div className="keyword-tags">
                          {result.intent.keywords.map((kw, i) => (
                            <span key={i} className="kw-tag">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Forensic Export & Feedback Row */}
                <div className="result-footer-bar">
                  <div className="report-dl">
                    <a 
                      href={`${API_BASE}/report/${result.scan_id}`}
                      download
                      target="_blank" 
                      rel="noreferrer"
                      className="pdf-dl-btn"
                    >
                      <Download size={18} /> Download Forensic PDF Report
                    </a>
                  </div>

                  <div className="feedback-section">
                    <span>Was this classification accurate?</span>
                    <button 
                      onClick={() => handleFeedback('CORRECT')} 
                      disabled={feedbackSent}
                      className="fb-btn correct"
                    >
                      <ThumbsUp size={16} /> Accurate
                    </button>
                    <button 
                      onClick={() => handleFeedback('FALSE_POSITIVE')} 
                      disabled={feedbackSent}
                      className="fb-btn incorrect"
                    >
                      <ThumbsDown size={16} /> Inaccurate
                    </button>
                    {feedbackSent && <span className="fb-thanks"><CheckCircle2 size={16} /> Feedback Logged</span>}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: LIVE CALL SENTINEL ==================== */}
        {activeTab === 'sentinel' && (
          <div className="container">
            <header>
              <div className="logo-badge pulse">
                <Radio size={36} />
                <span>REAL-TIME STREAM HUD</span>
              </div>
              <h2>Sentinel Live Call Monitor</h2>
              <p>Continuous Sub-Second Acoustic & Intent Analysis with Browser Speech API</p>
            </header>

            <div className="sentinel-monitor-box">
              {isSentinelActive ? (
                <div className="sentinel-live-card">
                  <div className="sentinel-top-bar">
                    <div className="sentinel-status-live">
                      <span className="blinking-dot" /> LIVE MONITORING ACTIVE
                    </div>
                    <div className="sentinel-clock">
                      <Clock size={16} /> {formatSeconds(sentinelTimer)}
                    </div>
                  </div>

                  <div className={`sentinel-verdict-box bg-${sentinelData.riskLevel.toLowerCase()}`}>
                    <div className="sentinel-score-circle">
                      <span>{sentinelData.riskScore}%</span>
                      <small>Risk</small>
                    </div>
                    <div>
                      <span className="sentinel-level-tag">
                        {sentinelData.riskLevel === 'SAFE' ? '🟢 CALL VERIFIED: SAFE' : `🚨 ${sentinelData.riskLevel} THREAT DETECTED`}
                      </span>
                      <h3 className="sentinel-verdict-title">{sentinelData.verdict}</h3>
                    </div>
                  </div>

                  <div className="sentinel-transcript-area">
                    <span className="transcript-label">Live Spoken Conversation Transcript:</span>
                    <div className="realtime-text">
                      {liveTranscript ? liveTranscript : <span className="text-dim">Speak into microphone to observe live stream decoding...</span>}
                    </div>

                    {liveKeywords.length > 0 && (
                      <div className="keywords-container live-alert">
                        <span className="kw-alert-label">⚠️ Live Scam Indicators Caught in Real Time:</span>
                        <div className="keyword-tags">
                          {liveKeywords.map((k, i) => (
                            <span key={i} className="kw-tag pulse-tag">{k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sentinel-mini-stats">
                    <div className="mini-stat">
                      <span>Voice Layer</span>
                      <strong className={sentinelData.voice === 'FAKE' ? 'text-red' : 'text-green'}>
                        {sentinelData.voice === 'FAKE' ? '🚨 Cloned Voice' : '✅ Human Voice'}
                      </strong>
                    </div>
                    <div className="mini-stat">
                      <span>Intent Layer</span>
                      <strong className={sentinelData.intent === 'SCAM' ? 'text-red' : 'text-green'}>
                        {sentinelData.intent === 'SCAM' ? '⚠️ Fraud Detected' : '✅ Normal'}
                      </strong>
                    </div>
                  </div>

                  <button onClick={stopSentinel} className="action-btn stop sentinel-btn">
                    <Square size={18} /> Stop Sentinel Monitoring
                  </button>
                </div>
              ) : (
                <div className="sentinel-idle-card">
                  <div className="radar-animation">
                    <div className="circle-1" />
                    <div className="circle-2" />
                    <Radio size={48} className="radar-icon" />
                  </div>
                  <h3>Sentinel Real-Time HUD</h3>
                  <p>Uses native browser speech recognition for instant word-by-word streaming transcriptions and rapid 2.5-second acoustic analysis.</p>
                  <button onClick={startSentinel} className="action-btn primary analyze-btn">
                    <Radio size={18} /> Start Real-Time Sentinel Monitor
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ANALYTICS & INTEL ==================== */}
        {activeTab === 'analytics' && (
          <div className="container">
            <header>
              <div className="logo-badge">
                <BarChart3 size={32} />
                <span>SQLITE THREAT INTELLIGENCE</span>
              </div>
              <h2>Analytics & Threat Dashboard {user ? `• ${user.full_name}` : ''}</h2>
              <p>Persistent telemetry stored and scoped in SQLite database.</p>
            </header>

            {stats ? (
              <div className="analytics-grid">
                <div className="stat-card">
                  <div className="stat-num">{stats.total_scans}</div>
                  <div className="stat-lbl">Total Scans Audited</div>
                </div>
                <div className="stat-card alert">
                  <div className="stat-num">{stats.deepfakes_detected}</div>
                  <div className="stat-lbl">AI Voice Deepfakes ({stats.deepfake_rate}%)</div>
                </div>
                <div className="stat-card warn">
                  <div className="stat-num">{stats.scam_conversations}</div>
                  <div className="stat-lbl">Scam Dialogues Flagged ({stats.scam_rate}%)</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-num">{stats.critical_threats}</div>
                  <div className="stat-lbl">Critical Threats Blocked</div>
                </div>
              </div>
            ) : (
              <p>Loading analytics telemetry...</p>
            )}

            <div className="threat-matrix-guide">
              <h4>VoiceShield AI Dual-Layer Threat Matrix</h4>
              <div className="matrix-table">
                <div className="matrix-row header">
                  <span>Voice Layer</span>
                  <span>Content Layer</span>
                  <span>Final Threat Verdict</span>
                </div>
                <div className="matrix-row safe">
                  <span>Human Voice</span>
                  <span>Normal Content</span>
                  <strong>🟢 Safe Call (Authentic)</strong>
                </div>
                <div className="matrix-row warn">
                  <span>Human Voice</span>
                  <span>Demanding OTP/Bank</span>
                  <strong>🟡 Human Social Engineering Scammer</strong>
                </div>
                <div className="matrix-row warn">
                  <span>AI-Cloned Voice</span>
                  <span>Casual Content</span>
                  <strong>🟠 Impersonation / Voice Clone</strong>
                </div>
                <div className="matrix-row danger">
                  <span>AI-Cloned Voice</span>
                  <span>Demanding OTP/Bank</span>
                  <strong>🔴 Critical Threat: Deepfake Scam Attack</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: AUDIT VAULT ==================== */}
        {activeTab === 'history' && (
          <div className="container">
            <div className="history-header-bar">
              <div>
                <h2>Forensic Audit Vault {user ? `• ${user.full_name}'s Vault` : '• Investigator Log'}</h2>
                <p>Permanent historical records maintained in SQLite scoped to your account.</p>
              </div>
              {history.length > 0 && (
                <button onClick={handleClearHistory} className="clear-btn">
                  <Trash2 size={16} /> Clear Vault History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="empty-history">
                <Database size={48} className="icon-gray" />
                <p>No scans recorded in your vault yet. Run a scan in Detection Studio or Sentinel mode!</p>
              </div>
            ) : (
              <div className="history-table-wrapper">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Timestamp</th>
                      <th>Evidence File</th>
                      <th>Voice</th>
                      <th>Intent</th>
                      <th>Verdict</th>
                      <th>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className={`tr-${item.risk_level?.toLowerCase() || 'safe'}`}>
                        <td>#{item.id}</td>
                        <td>{item.timestamp}</td>
                        <td className="fname-col">{item.filename}</td>
                        <td>
                          <span className={`mini-pill ${item.voice_prediction === 'FAKE' ? 'danger' : 'safe'}`}>
                            {item.voice_prediction} ({item.voice_confidence}%)
                          </span>
                        </td>
                        <td>
                          <span className={`mini-pill ${item.scam_prediction === 'SCAM' ? 'danger' : 'safe'}`}>
                            {item.scam_prediction}
                          </span>
                        </td>
                        <td><strong>{item.combined_verdict}</strong></td>
                        <td>
                          <a 
                            href={`${API_BASE}/report/${item.id}`}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="mini-pdf-btn"
                            title="Download PDF"
                          >
                            <FileText size={16} /> PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 5: SCAM TACTICS & EDUCATIONAL DEFENSE CENTER ==================== */}
        {activeTab === 'defense' && (
          <div className="container">
            <header>
              <div className="logo-badge">
                <GraduationCap size={36} />
                <span>EDUCATION & DEFENSE CENTER</span>
              </div>
              <h2>Scam Tactics & Cyber Defense Hub</h2>
              <p>Learn how to identify, dissect, and neutralize voice deepfakes and social engineering tactics.</p>
            </header>

            {/* Sub-Navigation Bar */}
            <div className="defense-subnav">
              <button 
                className={`defense-subnav-btn ${defenseSection === 'tactics' ? 'active' : ''}`}
                onClick={() => setDefenseSection('tactics')}
              >
                <BookOpen size={15} /> Scam Tactics Dossiers
              </button>
              <button 
                className={`defense-subnav-btn ${defenseSection === 'forensics' ? 'active' : ''}`}
                onClick={() => setDefenseSection('forensics')}
              >
                <Volume2 size={15} /> Acoustic Forensics Guide
              </button>
              <button 
                className={`defense-subnav-btn ${defenseSection === 'quiz' ? 'active' : ''}`}
                onClick={() => setDefenseSection('quiz')}
              >
                <HelpCircle size={15} /> Interactive Defense Simulator ({quizScore} pts)
              </button>
              <button 
                className={`defense-subnav-btn ${defenseSection === 'extension' ? 'active' : ''}`}
                onClick={() => setDefenseSection('extension')}
              >
                <PhoneCall size={15} /> Telephony Hook & Extension
              </button>
              <button 
                className={`defense-subnav-btn ${defenseSection === 'helplines' ? 'active' : ''}`}
                onClick={() => setDefenseSection('helplines')}
              >
                <ShieldAlert size={15} /> Emergency Helplines
              </button>
            </div>

            {/* SUB-SECTION 1: TACTICS DOSSIERS */}
            {defenseSection === 'tactics' && (
              <div className="tactics-grid">
                {SCAM_TACTICS.map((tactic) => (
                  <div key={tactic.id} className="tactic-card">
                    <div className="tactic-header">
                      <div className="tactic-icon-badge">{tactic.icon}</div>
                      <span className="tactic-category">{tactic.category}</span>
                    </div>

                    <h3 className="tactic-title">{tactic.title}</h3>

                    <div className="tactic-hook-box">
                      <strong>The Hook:</strong> {tactic.hook}
                    </div>

                    <div>
                      <span className="tactic-section-title">Psychological Triggers Exploited:</span>
                      <div className="tactic-triggers">
                        {tactic.triggers.map((trig, i) => (
                          <span key={i} className="trigger-tag">{trig}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="tactic-section-title">Forensic Red Flags:</span>
                      <ul className="red-flags-list">
                        {tactic.redFlags.map((flag, i) => (
                          <li key={i}>{flag}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="defense-action-box">
                      <strong>🛡️ Defense Action:</strong> {tactic.defense}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUB-SECTION 2: ACOUSTIC FORENSICS GUIDE */}
            {defenseSection === 'forensics' && (
              <div className="forensics-container">
                <h3>Voice Deepfake vs. Natural Speech Acoustic Forensics</h3>
                <p>How VoiceShield AI differentiates between synthetic AI-cloned voices and biological human speech.</p>

                <table className="forensics-table">
                  <thead>
                    <tr>
                      <th>Forensic Metric</th>
                      <th>Natural Human Voice</th>
                      <th>Synthetic Deepfake Clone</th>
                      <th>AI Detection Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FORENSICS_TABLE.map((row, i) => (
                      <tr key={i}>
                        <td className="feature-param">{row.feature}</td>
                        <td className="human-val">{row.human}</td>
                        <td className="synthetic-val">{row.synthetic}</td>
                        <td><strong>{row.technique}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUB-SECTION 3: INTERACTIVE AWARENESS QUIZ */}
            {defenseSection === 'quiz' && (
              <div className="quiz-wrapper">
                <div className="quiz-score-header">
                  <div>
                    <h3>Interactive Voice Threat Simulator</h3>
                    <p>Listen or read the scenario transcript and determine whether it's a legitimate call or a scam attempt.</p>
                  </div>
                  <div className="score-badge-circle">
                    <span>{quizScore}</span><small>/100 Pts</small>
                  </div>
                </div>

                <div className="scenarios-list">
                  {SCAM_SCENARIOS.map((sc, index) => {
                    const answered = quizAnswers[sc.id] !== undefined
                    const isCorrect = answered && quizAnswers[sc.id] === sc.isScam

                    return (
                      <div key={sc.id} className="scenario-card">
                        <div className="scenario-top">
                          <span className="tactic-category">Scenario #{index + 1} &bull; {sc.category}</span>
                          <span className="scenario-caller">{sc.caller}</span>
                        </div>

                        <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>{sc.title}</h4>

                        <div className="dialogue-bubble">
                          {sc.dialogue}
                        </div>

                        <div className="quiz-btn-group">
                          <button 
                            onClick={() => handleQuizAnswer(sc.id, true)}
                            className={`quiz-choice-btn ${quizAnswers[sc.id] === true ? 'selected-scam' : ''}`}
                          >
                            🚨 Flag as Threat / Scam Call
                          </button>
                          <button 
                            onClick={() => handleQuizAnswer(sc.id, false)}
                            className={`quiz-choice-btn ${quizAnswers[sc.id] === false ? 'selected-safe' : ''}`}
                          >
                            ✅ Verify as Authentic Call
                          </button>
                        </div>

                        {answered && (
                          <div className={`quiz-feedback-box ${isCorrect ? 'correct' : 'incorrect'}`}>
                            <strong>{isCorrect ? '🎯 Correct Assessment!' : '❌ Incorrect Flag!'}</strong>
                            <p style={{ margin: '6px 0 0 0' }}>{sc.explanation}</p>
                            <p style={{ margin: '6px 0 0 0', fontWeight: 'bold' }}>Action: {sc.safeAction}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* SUB-SECTION 4: TELEPHONY HOOK & EXTENSION */}
            {defenseSection === 'extension' && (
              <div className="extension-bridge-card">
                <div className="tactic-header">
                  <div className="tactic-icon-badge">🔌</div>
                  <span className="tactic-category">EXTRA CREDIT &bull; VOIP CALL HOOK</span>
                </div>

                <h3>VoiceShield Telephony Hook & Chromium Extension</h3>
                <p>Runs in the background of your browser and intercepts incoming VoIP voice calls from <strong>WhatsApp Web, Google Meet, Zoom, Discord, and Microsoft Teams</strong>.</p>

                <div className="ext-steps-grid">
                  <div className="step-card">
                    <div className="step-num">1</div>
                    <h4>Open Extensions</h4>
                    <p>Go to <code>chrome://extensions/</code> in your browser and enable Developer Mode.</p>
                  </div>
                  <div className="step-card">
                    <div className="step-num">2</div>
                    <h4>Load Unpacked</h4>
                    <p>Click "Load unpacked" and select the <code>browser_extension</code> folder in this project.</p>
                  </div>
                  <div className="step-card">
                    <div className="step-num">3</div>
                    <h4>Join Any Web Call</h4>
                    <p>Open WhatsApp Web or Google Meet; click the extension icon to start live stream evaluation.</p>
                  </div>
                </div>

                {/* Telephony Simulator in Browser */}
                <div className="telephony-sim-box">
                  <h4>Interactive VoIP Intercept Simulator (Test Drive)</h4>
                  <p>Experience how the Telephony Hook intercepts and processes live call audio in real time:</p>

                  <div className="sim-controls">
                    <button 
                      onClick={() => runTelephonySimulation('whatsapp')} 
                      disabled={simCountdown > 0}
                      className="sim-btn whatsapp"
                    >
                      <PhoneCall size={16} /> Simulate WhatsApp Call Intercept
                    </button>
                    <button 
                      onClick={() => runTelephonySimulation('meet')} 
                      disabled={simCountdown > 0}
                      className="sim-btn meet"
                    >
                      <Video size={16} /> Simulate Google Meet Deepfake Call
                    </button>
                  </div>

                  {simCountdown > 0 && (
                    <div style={{ marginTop: '1rem', color: '#818cf8', fontWeight: 'bold' }}>
                      <Activity className="spin-icon" size={16} /> Intercepting and buffering VoIP audio slice... ({simCountdown}s)
                    </div>
                  )}

                  {simData && (
                    <div className={`dual-result-card border-${simData.riskLevel.toLowerCase()}`} style={{ marginTop: '1.25rem' }}>
                      <div className={`threat-banner bg-${simData.riskLevel.toLowerCase()}`}>
                        <div>
                          <span className="threat-label">{simData.platform} &bull; {simData.riskLevel} THREAT</span>
                          <h3 className="verdict-title">{simData.verdict}</h3>
                        </div>
                        <div className="threat-score">
                          <span className="score-num">{simData.riskScore}%</span>
                          <span className="score-lbl">Risk</span>
                        </div>
                      </div>

                      <div className="dialogue-bubble" style={{ margin: '1rem 0' }}>
                        "{simData.transcript}"
                      </div>

                      <div className="dual-meters" style={{ margin: 0 }}>
                        <div className="meter-col">
                          <span className="meter-title">Voice Classification</span>
                          <strong className={simData.voice === 'FAKE' ? 'text-danger' : 'text-safe'}>
                            {simData.voice === 'FAKE' ? '🚨 AI Synthetic Voice' : '✅ Human Voice'} ({simData.voiceConf}%)
                          </strong>
                        </div>
                        <div className="meter-col">
                          <span className="meter-title">Conversational Intent</span>
                          <strong className={simData.intent === 'SCAM' ? 'text-danger' : 'text-safe'}>
                            {simData.intent === 'SCAM' ? '⚠️ Fraud / OTP Pattern' : '✅ Safe'} ({simData.intentConf}%)
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* SUB-SECTION 5: EMERGENCY HELPLINES */}
            {defenseSection === 'helplines' && (
              <div className="helpline-grid">
                <div className="helpline-card">
                  <div className="tactic-icon-badge">🇮🇳</div>
                  <h3>National Cyber Crime Portal</h3>
                  <div className="helpline-badge">Dial 1930</div>
                  <p className="helpline-desc">
                    Toll-free 24/7 national emergency helpline operated by the Ministry of Home Affairs (MHA) for reporting cyber fraud, digital arrests, and financial theft.
                  </p>
                  <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="action-btn outline" style={{ marginTop: 'auto' }}>
                    <ExternalLink size={15} /> cybercrime.gov.in
                  </a>
                </div>

                <div className="helpline-card">
                  <div className="tactic-icon-badge">🏦</div>
                  <h3>RBI 72-Hour Zero-Liability Rule</h3>
                  <div className="helpline-badge">100% Refund</div>
                  <p className="helpline-desc">
                    Under Reserve Bank of India guidelines, if you notify your bank of unauthorized electronic fraud within 3 days (72 hours), your liability is ZERO and the bank must refund your lost funds.
                  </p>
                  <a href="https://cms.rbi.org.in" target="_blank" rel="noreferrer" className="action-btn outline" style={{ marginTop: 'auto' }}>
                    <ExternalLink size={15} /> RBI Ombudsman Portal
                  </a>
                </div>

                <div className="helpline-card">
                  <div className="tactic-icon-badge">📱</div>
                  <h3>TRAI Sanchar Saathi</h3>
                  <div className="helpline-badge">Dial 1909</div>
                  <p className="helpline-desc">
                    Department of Telecommunications initiative to report spoofed international calls displaying Indian numbers (+91) and report stolen/fraudulent SIM cards.
                  </p>
                  <a href="https://sancharsaathi.gov.in" target="_blank" rel="noreferrer" className="action-btn outline" style={{ marginTop: 'auto' }}>
                    <ExternalLink size={15} /> sancharsaathi.gov.in
                  </a>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== AUTHENTICATION MODAL ==================== */}
        {authModalOpen && (
          <div className="auth-modal-backdrop" onClick={() => setAuthModalOpen(false)}>
            <div className="auth-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setAuthModalOpen(false)}>
                <X size={18} />
              </button>

              <div className="auth-modal-header">
                <div className="modal-icon-badge">
                  <ShieldCheck size={26} />
                </div>
                <h3>{authMode === 'login' ? 'Sign In to VoiceShield' : 'Create Investigator Account'}</h3>
                <p>Access your personalized scan vault and threat analytics.</p>
              </div>

              {/* Mode Switch Tabs */}
              <div className="auth-mode-switch">
                <button 
                  className={`mode-btn ${authMode === 'login' ? 'active' : ''}`}
                  onClick={() => { setAuthMode('login'); setAuthError(null); }}
                >
                  <LogIn size={15} /> Sign In
                </button>
                <button 
                  className={`mode-btn ${authMode === 'register' ? 'active' : ''}`}
                  onClick={() => { setAuthMode('register'); setAuthError(null); }}
                >
                  <UserPlus size={15} /> Register
                </button>
              </div>

              {authError && (
                <div className="auth-error-banner">
                  <AlertTriangle size={18} />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="auth-form">
                {authMode === 'register' && (
                  <div className="form-group">
                    <label>Full Name</label>
                    <div className="input-wrap">
                      <User size={16} className="input-icon" />
                      <input 
                        type="text" 
                        placeholder="e.g. D Dhanush"
                        value={authForm.fullName}
                        onChange={e => setAuthForm({ ...authForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>{authMode === 'login' ? 'Username or Email' : 'Username'}</label>
                  <div className="input-wrap">
                    <User size={16} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="e.g. dhanush"
                      value={authForm.username}
                      onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {authMode === 'register' && (
                  <div className="form-group">
                    <label>Email Address</label>
                    <div className="input-wrap">
                      <Mail size={16} className="input-icon" />
                      <input 
                        type="email" 
                        placeholder="dhanush@pes.edu"
                        value={authForm.email}
                        onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Password</label>
                  <div className="input-wrap">
                    <KeyRound size={16} className="input-icon" />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={authForm.password}
                      onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={authLoading}
                  className="auth-submit-btn"
                >
                  {authLoading ? (
                    <><Activity className="spin-icon" size={16} /> Authenticating...</>
                  ) : authMode === 'login' ? (
                    <><LogIn size={16} /> Sign In</>
                  ) : (
                    <><UserPlus size={16} /> Create Account</>
                  )}
                </button>
              </form>

              {/* Quick Demo Access for Evaluators */}
              <div className="auth-quick-demo-box">
                <div className="demo-divider"><span>OR EVALUATOR QUICK ACCESS</span></div>
                <button 
                  onClick={handleQuickDemoLogin}
                  disabled={authLoading}
                  className="quick-demo-btn"
                >
                  <Sparkles size={16} /> Quick Sign-in as Demo Investigator
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
