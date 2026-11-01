import os
import re
import socket
import joblib
import speech_recognition as sr

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'scam_nlp_model.joblib')

nlp_pipeline = None
try:
    if os.path.exists(MODEL_PATH):
        nlp_pipeline = joblib.load(MODEL_PATH)
        print("NLP Scam Detection pipeline loaded successfully.")
    else:
        print(f"Warning: {MODEL_PATH} not found. Run train_nlp.py first.")
except Exception as e:
    print(f"Error loading NLP model: {e}")

# High-risk social engineering scam indicators
SCAM_INDICATOR_KEYWORDS = [
    r'\botp\b', r'\bone time password\b', r'\bpassword\b', r'\bpasswords\b', r'\bpasscode\b', r'\bpasscodes\b',
    r'\bcvv\b', r'\bpin\b', r'\bmpin\b', r'\bupi pin\b', r'\batm pin\b', r'\bsecurity code\b',
    r'\bcredentials?\b', r'\blogin details\b', r'\bsecret code\b', r'\bverification code\b',
    r'\bbank account\b', r'\bcredit card\b', r'\bdebit card\b',
    r'\barrest\b', r'\bwarrant\b', r'\bpolice\b', r'\bfbi\b', r'\bcbi\b', r'\bdigital arrest\b',
    r'\btax department\b', r'\bunpaid tax\b', r'\birs\b',
    r'\baccount suspended\b', r'\baccount blocked\b', r'\bverify account\b',
    r'\bwire transfer\b', r'\bwestern union\b', r'\bgift card\b', r'\bcrypto\b',
    r'\blottery\b', r'\bcash prize\b', r'\blucky draw\b', r'\bclaim prize\b',
    r'\brefund\b', r'\boverpayment\b', r'\btech support\b',
    r'\banydesk\b', r'\bteamviewer\b', r'\bremote access\b',
    r'\bimmediately\b', r'\burgent\b', r'\bact now\b', r'\bkyc\b'
]

def transcribe_audio(audio_path):
    """
    Transcribes audio to text using SpeechRecognition (Google STT).
    Returns (transcript_text, error_message).
    Enforces a strict 6-second socket timeout to prevent blocking.
    """
    recognizer = sr.Recognizer()
    orig_timeout = socket.getdefaulttimeout()
    try:
        socket.setdefaulttimeout(6.0)
        with sr.AudioFile(audio_path) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.2)
            audio_data = recognizer.record(source)
            transcript = recognizer.recognize_google(audio_data)
            return transcript, None
    except sr.UnknownValueError:
        return "", "Speech was unclear, silent, or could not be recognized."
    except sr.RequestError as e:
        return "", f"Speech recognition service unavailable: {e}"
    except (socket.timeout, TimeoutError):
        return "", "Speech recognition timed out (network latency)."
    except Exception as e:
        return "", f"Transcription error: {str(e)}"
    finally:
        socket.setdefaulttimeout(orig_timeout)

def detect_scam_keywords(text):
    """Finds all flagged scam words/phrases in the transcript."""
    matched = []
    lower_text = text.lower()
    for pattern in SCAM_INDICATOR_KEYWORDS:
        found = re.findall(pattern, lower_text)
        if found:
            matched.extend(found)
    return sorted(list(set(matched)))

def analyze_conversational_intent(text):
    """
    Analyzes transcript text using the trained NLP model and keyword heuristics.
    Returns dict with intent classification, confidence, keywords, etc.
    """
    if not text or len(text.strip()) == 0:
        return {
            "prediction": "UNKNOWN",
            "confidence": 0.0,
            "scam_probability": 0.0,
            "legit_probability": 100.0,
            "keywords": [],
            "note": "No intelligible speech detected to analyze conversational intent."
        }
    
    keywords = detect_scam_keywords(text)
    
    if nlp_pipeline is not None:
        probs = nlp_pipeline.predict_proba([text])[0]
        prob_scam = float(probs[1])
        prob_legit = float(probs[0])
    else:
        # Fallback to keyword density
        prob_scam = min(len(keywords) * 0.35, 0.95)
        prob_legit = 1.0 - prob_scam

    # Guardrail: If NO fraud/extortion keywords exist in the transcript,
    # cap the statistical NLP scam probability so everyday conversational speech
    # cannot falsely trigger a fraud alert.
    if len(keywords) == 0:
        prob_scam = min(prob_scam, 0.35)
        prob_legit = 1.0 - prob_scam
    elif any(k in ['otp', 'password', 'passwords', 'passcode', 'passcodes', 'cvv', 'arrest', 'warrant', 'digital arrest', 'pin', 'mpin', 'credentials', 'bank account', 'credit card', 'debit card', 'wire transfer', 'anydesk', 'teamviewer', 'gift card'] for k in keywords):
        prob_scam = max(prob_scam, 0.88)
        prob_legit = 1.0 - prob_scam

    # A call is flagged as SCAM if it has scam keywords and elevated probability (>= 0.50), or overwhelming NLP probability (>= 0.80)
    is_scam = (prob_scam >= 0.50 and len(keywords) > 0) or (prob_scam >= 0.80)
    confidence = max(prob_scam, prob_legit) * 100.0

    return {
        "prediction": "SCAM" if is_scam else "SAFE",
        "confidence": round(confidence, 1),
        "scam_probability": round(prob_scam * 100.0, 1),
        "legit_probability": round(prob_legit * 100.0, 1),
        "keywords": keywords,
        "note": f"Flagged {len(keywords)} suspicious conversational indicator(s)." if keywords else "No scam keywords detected."
    }

def compute_combined_threat_matrix(voice_pred, voice_conf, text_pred, text_conf, transcript):
    """
    Combines Layer 1 (Acoustic Deepfake) and Layer 2 (Conversational Intent).
    Returns unified verdict, risk level, threat code, and description.
    """
    is_voice_fake = (voice_pred.upper() == 'FAKE')
    is_text_scam = (text_pred.upper() == 'SCAM')
    has_transcript = bool(transcript and len(transcript.strip()) > 0)

    if is_voice_fake and is_text_scam:
        verdict = "CRITICAL THREAT: DEEPFAKE SCAM ATTACK"
        risk_level = "CRITICAL"
        threat_color = "#ef4444"
        action = "DO NOT PROCEED. Hang up immediately. AI-generated voice is actively attempting financial/credential theft."
    elif is_voice_fake and not is_text_scam:
        verdict = "VOICE IMPERSONATION DETECTED"
        risk_level = "HIGH"
        threat_color = "#f97316"
        action = "CAUTION: Synthetic AI voice detected. Verify speaker identity via an alternative trusted channel."
    elif not is_voice_fake and is_text_scam:
        verdict = "HUMAN SOCIAL ENGINEERING SCAM"
        risk_level = "HIGH"
        threat_color = "#eab308"
        action = "WARNING: Human speaker detected, but conversation contains clear fraud / OTP theft indicators."
    else:
        if not has_transcript and is_voice_fake:
            verdict = "SYNTHETIC AUDIO DETECTED"
            risk_level = "HIGH"
            threat_color = "#f97316"
            action = "Synthetic voice artifacts identified. Verify caller identity."
        else:
            verdict = "AUTHENTIC CALL (SAFE)"
            risk_level = "SAFE"
            threat_color = "#22c55e"
            action = "Natural human voice and normal conversational patterns detected. Safe to continue."

    # Compute overall composite risk score (0 to 100)
    voice_risk_weight = 0.55
    text_risk_weight = 0.45
    
    voice_threat_score = voice_conf if is_voice_fake else (100.0 - voice_conf)
    text_threat_score = text_conf if is_text_scam else (100.0 - text_conf if has_transcript else 0.0)
    
    if not has_transcript:
        overall_risk_score = voice_threat_score
    else:
        overall_risk_score = (voice_threat_score * voice_risk_weight) + (text_threat_score * text_risk_weight)

    return {
        "verdict": verdict,
        "risk_level": risk_level,
        "threat_color": threat_color,
        "action": action,
        "overall_risk_score": round(overall_risk_score, 1)
    }
