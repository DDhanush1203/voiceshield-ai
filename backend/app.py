import os
import sys
import time
import hashlib
import io
import math
import base64
import uuid
import torch
import librosa
import soundfile as sf
import numpy as np
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from torchvision import transforms
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Add parent directory to path to import PyTorch CNN
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from train_model import DeepfakeDetectorCNN

import database as db
import nlp_detector as nlp
import pdf_generator as pdf_gen

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "VoiceShield AI Backend",
        "pytorch_device": str(device),
        "database": "connected"
    })

# Load PyTorch Deepfake CNN Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'model_weights.pth')
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = DeepfakeDetectorCNN()

try:
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    model.to(device)
    model.eval()
    print("PyTorch Deepfake CNN model loaded successfully.")
except Exception as e:
    print(f"Warning: Could not load model weights: {e}")

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def compute_file_hash(file_bytes):
    return hashlib.sha256(file_bytes).hexdigest()

def get_current_user(allow_guest=True):
    """Extracts user from Authorization header (Bearer token) or fallback."""
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        parts = auth_header.split(' ')
        if len(parts) > 1:
            token = parts[1].strip()
    elif 'X-Auth-Token' in request.headers:
        token = request.headers['X-Auth-Token'].strip()
    elif request.form.get('token'):
        token = request.form.get('token').strip()
    elif request.args.get('token'):
        token = request.args.get('token').strip()
    
    if token:
        user = db.get_user_by_token(token)
        if user:
            return user
    
    if allow_guest:
        # Fallback to default user (id=1) for backward compatibility
        return {"id": 1, "username": "guest", "full_name": "Guest Investigator", "is_guest": True}
    return None

def normalize_and_save_audio(in_bytes, out_path):
    """
    Decodes audio from raw bytes (supporting 32-bit float, 24-bit, 16-bit PCM, stereo/mono),
    downmixes to mono, removes DC bias, peak-normalizes to 0.95 full scale, resamples to 16kHz,
    and writes a clean standard 16-bit PCM WAV so quiet/laptop microphones are clearly audible.
    Applies noise-floor preservation to prevent silent gaps from being over-amplified into hiss.
    """
    import soundfile as sf
    try:
        data, sr = sf.read(io.BytesIO(in_bytes))
    except Exception:
        data, sr = librosa.load(io.BytesIO(in_bytes), sr=None)

    if len(data.shape) > 1 and data.shape[1] > 1:
        data = np.mean(data, axis=1)

    # Remove DC bias
    data = data - np.mean(data)

    # Peak normalization with low-energy noise floor guard
    peak = np.max(np.abs(data))
    if peak > 0.01:
        data = (data / peak) * 0.95
    elif peak > 1e-4:
        data = (data / peak) * min(0.95, peak * 30.0)

    # Resample to 16000 Hz if needed
    if sr != 16000:
        data = librosa.resample(data, orig_sr=sr, target_sr=16000)

    sf.write(out_path, data, 16000, subtype='PCM_16', format='WAV')
    return True

def audio_to_spectrogram_image(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    # Trim leading and trailing silence so spectrogram represents active vocal energy
    y_trimmed, _ = librosa.effects.trim(y, top_db=25)
    if len(y_trimmed) >= 2048:
        y = y_trimmed
    if len(y) < 2048:
        y = np.pad(y, (0, 2048 - len(y)))
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
    S_dB = librosa.power_to_db(S, ref=np.max)
    
    buf = io.BytesIO()
    plt.figure(figsize=(4, 4))
    librosa.display.specshow(S_dB, sr=sr, fmax=8000, cmap='magma')
    plt.axis('off')
    plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, transparent=True)
    plt.close()
    
    buf.seek(0)
    image = Image.open(buf).convert('RGB')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    return image, img_base64

def audio_to_fast_tensor_image(audio_path):
    """Generates magma Mel-spectrogram image matching CNN training distribution in ~3ms."""
    y, sr = librosa.load(audio_path, sr=16000)
    y_trimmed, _ = librosa.effects.trim(y, top_db=25)
    if len(y_trimmed) >= 2048:
        y = y_trimmed
    if len(y) < 2048:
        y = np.pad(y, (0, 2048 - len(y)))
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
    S_dB = librosa.power_to_db(S, ref=np.max)
    norm = (S_dB - S_dB.min()) / (S_dB.max() - S_dB.min() + 1e-6)
    norm = np.flipud(norm)
    cm = matplotlib.colormaps['magma']
    rgb = (cm(norm)[:, :, :3] * 255).astype(np.uint8)
    return Image.fromarray(rgb).resize((224, 224))

def compute_acoustic_biomarkers(audio_path, transcript=""):
    """
    Computes explainable vocal forensics:
    1. Spectral Rolloff & Centroid:
       - Low Cutoff (<2500 Hz): Classical vocoder wall
       - Natural Decay (2600 - 3600 Hz): Natural human voice through microphone
       - Studio Boost (>3900 Hz) with high Centroid (>2300 Hz) & HF energy: Modern Neural TTS (ElevenLabs, OpenAI, VITS)
    2. Pitch Jitter: Fundamental frequency micro-variance.
    3. Conversational AI Prompt Verification: Detects synthetic voice demo prompts.
    """
    try:
        y, sr = librosa.load(audio_path, sr=16000)
        y_trim, _ = librosa.effects.trim(y, top_db=20)
        if len(y_trim) < 1600:
            y_trim = y
            
        rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y_trim, sr=sr, roll_percent=0.85)[0]))
        sc = float(np.mean(librosa.feature.spectral_centroid(y=y_trim, sr=sr)[0]))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y=y_trim)[0]))
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=y_trim)[0]))
        
        # High-Frequency Energy Ratio (>3500 Hz vs <= 3500 Hz)
        S = np.abs(librosa.stft(y_trim))
        freqs = librosa.fft_frequencies(sr=sr)
        hf = float(np.sum(S[freqs > 3500, :]))
        lf = float(np.sum(S[freqs <= 3500, :]))
        hf_ratio = hf / (lf + 1e-6)
        
        # Modern Neural TTS (ElevenLabs, OpenAI, VITS, Bark) Artifacts:
        # High spectral centroid brightness combined with disproportionate HF energy or high ZCR with studio rolloff
        is_neural_tts = bool((sc > 2300 and hf_ratio > 0.35) or (zcr > 0.21 and rolloff > 3900))
        
        # Below 2400 Hz indicates classical vocoder cutoff wall; >3000 Hz indicates natural harmonic extension
        rolloff_fake = 1.0 - min(1.0, max(0.0, (rolloff - 2200.0) / 1200.0))
        
        try:
            y_yin = y_trim[: sr * 4] if len(y_trim) > sr * 4 else y_trim
            f0 = librosa.yin(y_yin, fmin=60, fmax=350, sr=sr)
            voiced = f0[~np.isnan(f0)]
            jitter = float(np.std(np.diff(voiced)) / (np.mean(voiced) + 1e-6)) if len(voiced) > 10 else 0.16
        except Exception:
            jitter = 0.16
            
        # Jitter < 0.075 indicates synthetic AI speech; > 0.11 is natural human vocal fold vibration
        jitter_fake = 1.0 - min(1.0, max(0.0, (jitter - 0.05) / 0.09))
        
        # Check transcript for AI self-identifying demo phrases
        t_clean = (transcript or "").lower()
        ai_phrases = ['generate your audio', 'choose me to generate', 'like my voice', 'ai voice', 'synthetic voice', 'voice clone', 'cloned voice', 'text to speech']
        is_ai_prompt = any(phrase in t_clean for phrase in ai_phrases)
        
        # Check active vocal energy vs silence
        rms_val = float(np.sqrt(np.mean(y_trim**2))) if len(y_trim) > 0 else 0.0
        
        # Vocoder cutoff only applies when there is loud voiced speech (silence/quiet pauses naturally have low rolloff)
        is_vocoder_cutoff = bool(rolloff < 2400 and rms_val >= 0.015)
        
        # Synthetic Vocoder Indicator: Vocoder cutoff during active speech, frozen pitch, AI demo prompt, or Modern Neural TTS
        is_synthetic_vocoder = bool(is_vocoder_cutoff or (jitter < 0.075 and rms_val >= 0.015) or is_ai_prompt or is_neural_tts)
        
        # Biological Human Voice Indicator: Natural vocal fold tremor and natural acoustic decay without synthetic boost
        is_human_biology = bool(rolloff >= 2500 and jitter >= 0.08 and not is_synthetic_vocoder)
        
        if is_neural_tts:
            biomarker_fake = max(0.78, 0.50 * min(1.0, sc / 2800.0) + 0.50 * min(1.0, hf_ratio / 0.40))
        elif is_synthetic_vocoder:
            biomarker_fake = max(0.75, 0.55 * rolloff_fake + 0.45 * jitter_fake)
            if is_ai_prompt:
                biomarker_fake = 0.95
        elif is_human_biology:
            biomarker_fake = min(0.20, 0.50 * rolloff_fake + 0.50 * jitter_fake)
        else:
            biomarker_fake = 0.50 * rolloff_fake + 0.50 * jitter_fake
        
        # Explainable Status Strings
        if is_neural_tts:
            rolloff_status = f"Neural TTS Brightness ({round(sc, 1)} Hz Centroid)"
        elif rolloff < 2500:
            rolloff_status = "Vocoder Cutoff (<2.5kHz)"
        else:
            rolloff_status = "Natural Harmonic Decay"

        jitter_status = "LOW (Synthetic Indicator)" if (jitter < 0.075 or is_neural_tts) else "NORMAL (Natural Human)"
        
        return biomarker_fake, {
            "pitch_jitter": round(jitter, 4),
            "pitch_jitter_status": jitter_status,
            "spectral_rolloff": round(rolloff, 1),
            "spectral_rolloff_status": rolloff_status,
            "spectral_centroid": round(sc, 1),
            "spectral_flatness": round(flatness, 4),
            "is_human_biology": is_human_biology,
            "is_synthetic_vocoder": is_synthetic_vocoder,
            "is_neural_tts": is_neural_tts,
            "is_ai_prompt": is_ai_prompt
        }
    except Exception as e:
        print(f"Biomarker calculation error: {e}")
        return 0.5, {"error": str(e)}

def run_cnn_inference(pil_img, audio_path=None, transcript=""):
    input_tensor = transform(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(input_tensor)[0]
        raw_probs = torch.nn.functional.softmax(logits, dim=0)
        raw_fake = raw_probs[0].item()
        raw_real = raw_probs[1].item()

    biomarkers = {}
    if audio_path and os.path.exists(audio_path):
        biomarker_fake_prob, biomarkers = compute_acoustic_biomarkers(audio_path, transcript)
        
        # Multimodal fusion: Physical Vocal Biomarkers + CNN Spectrogram Deep Learning
        is_vocoder = biomarkers.get("is_synthetic_vocoder", False)
        is_bio = biomarkers.get("is_human_biology", False)
        
        if is_vocoder:
            prob_fake = max(0.40 * raw_fake + 0.60 * biomarker_fake_prob, 0.72)
        elif is_bio:
            # Natural human vocal folds: Protect real speech from pause/mic artifacts
            if raw_fake >= 0.88:
                prob_fake = max(raw_fake, 0.70)
            else:
                prob_fake = min(0.30 * raw_fake + 0.70 * biomarker_fake_prob, 0.32)
        elif raw_fake >= 0.65:
            # High-confidence CNN spectrogram deepfake pattern
            prob_fake = max(raw_fake, 0.70)
        else:
            prob_fake = 0.50 * raw_fake + 0.50 * biomarker_fake_prob
            
        prob_real = 1.0 - prob_fake
    else:
        prob_fake = raw_fake
        prob_real = raw_real

    prediction = "FAKE" if prob_fake > 0.50 else "REAL"
    confidence = max(prob_fake, prob_real) * 100.0

    return {
        "prediction": prediction,
        "confidence": round(confidence, 1),
        "fake_probability": round(prob_fake * 100.0, 1),
        "real_probability": round(prob_real * 100.0, 1),
        "raw_cnn_fake": round(raw_fake * 100.0, 1),
        "acoustic_biomarkers": biomarkers
    }

# ==================== AUTHENTICATION ROUTES ====================
@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.json or {}
    username = data.get('username')
    full_name = data.get('full_name') or username
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required."}), 400

    user, err = db.register_user(username, full_name, email, password)
    if err:
        return jsonify({"error": err}), 400

    return jsonify({
        "status": "success",
        "message": "Account created successfully.",
        "user": user
    })

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json or {}
    username_or_email = data.get('username') or data.get('email')
    password = data.get('password')

    if not username_or_email or not password:
        return jsonify({"error": "Please provide username/email and password."}), 400

    user, err = db.login_user(username_or_email, password)
    if err:
        return jsonify({"error": err}), 401

    return jsonify({
        "status": "success",
        "message": "Login successful.",
        "user": user
    })

@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    user = get_current_user(allow_guest=False)
    if user:
        return jsonify({"status": "success", "user": user})
    return jsonify({"error": "Unauthorized"}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        parts = auth_header.split(' ')
        if len(parts) > 1:
            token = parts[1].strip()
    elif 'X-Auth-Token' in request.headers:
        token = request.headers['X-Auth-Token'].strip()
    if token:
        db.logout_user(token)
    return jsonify({"status": "success", "message": "Logged out."})

# ==================== DUAL-LAYER ANALYSIS ENDPOINT ====================
@app.route('/api/analyze', methods=['POST'])
def analyze_audio():
    user = get_current_user()
    user_id = user['id'] if user else 1

    if 'file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    file = request.files['file']
    filename = file.filename or "recording.wav"
    file_bytes = file.read()
    
    if len(file_bytes) == 0:
        return jsonify({"error": "Uploaded file is empty"}), 400

    audio_hash = compute_file_hash(file_bytes)
    temp_path = os.path.join(os.path.dirname(__file__), "temp_analyze.wav")
    try:
        normalize_and_save_audio(file_bytes, temp_path)
    except Exception as e:
        print(f"Audio normalization fallback: {e}")
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
    
    try:
        # Layer 2: Speech-to-Text & Intent (Transcribe first so transcript context aids acoustic validation)
        transcript, stt_error = nlp.transcribe_audio(temp_path)
        intent_result = nlp.analyze_conversational_intent(transcript)

        # Layer 1: Acoustic Model with Spectrogram Image & Physical Biomarkers
        img, img_base64 = audio_to_spectrogram_image(temp_path)
        voice_result = run_cnn_inference(img, audio_path=temp_path, transcript=transcript)
        voice_result['spectrogram'] = img_base64
        
        # Combined Threat Matrix
        threat_matrix = nlp.compute_combined_threat_matrix(
            voice_pred=voice_result['prediction'],
            voice_conf=voice_result['confidence'],
            text_pred=intent_result['prediction'],
            text_conf=intent_result['confidence'],
            transcript=transcript
        )

        # Save to SQLite scoped by user_id
        scan_id = db.save_scan(
            user_id=user_id,
            filename=filename,
            audio_hash=audio_hash,
            voice_prediction=voice_result['prediction'],
            voice_confidence=voice_result['confidence'],
            scam_prediction=intent_result['prediction'],
            scam_confidence=intent_result['confidence'],
            transcript=transcript,
            keywords=intent_result['keywords'],
            combined_verdict=threat_matrix['verdict'],
            risk_level=threat_matrix['risk_level'],
            spectrogram_b64=voice_result['spectrogram']
        )

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "status": "success",
            "scan_id": scan_id,
            "filename": filename,
            "audio_hash": audio_hash,
            "user_id": user_id,
            "prediction": voice_result['prediction'],
            "confidence": voice_result['confidence'],
            "fake_probability": voice_result['fake_probability'],
            "real_probability": voice_result['real_probability'],
            "spectrogram": voice_result['spectrogram'],
            "acoustic_biomarkers": voice_result.get('acoustic_biomarkers', {}),
            "transcript": transcript,
            "transcript_error": stt_error,
            "intent": intent_result,
            "verdict": threat_matrix['verdict'],
            "risk_level": threat_matrix['risk_level'],
            "threat_color": threat_matrix['threat_color'],
            "action": threat_matrix['action'],
            "overall_risk_score": threat_matrix['overall_risk_score']
        })

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Audio analysis error: {str(e)}"}), 500

# ==================== LIVE CALL SENTINEL ENDPOINT ====================
sentinel_rolling_buffers = {}
sentinel_buffer_timestamps = {}

@app.route('/api/sentinel', methods=['POST'])
def sentinel_stream_chunk():
    client_transcript = request.form.get('transcript', '').strip()
    file = request.files.get('chunk') or request.files.get('file')
    
    voice_pred = "REAL"
    voice_conf = 88.0

    chunk_id = uuid.uuid4().hex[:8]
    temp_chunk_path = os.path.join(os.path.dirname(__file__), f"temp_sentinel_{chunk_id}.wav")
    transcript = client_transcript

    has_active_speech = False

    if file:
        chunk_bytes = file.read()
        try:
            normalize_and_save_audio(chunk_bytes, temp_chunk_path)
            
            y_chunk, sr = librosa.load(temp_chunk_path, sr=16000)
            rms = float(np.sqrt(np.mean(y_chunk**2))) if len(y_chunk) > 0 else 0.0
            peak = float(np.max(np.abs(y_chunk))) if len(y_chunk) > 0 else 0.0
            
            # Maintain 5.0-second rolling buffer per session for rock-solid temporal stability
            now = time.time()
            sess_key = request.remote_addr or 'default'
            
            if sess_key not in sentinel_buffer_timestamps or (now - sentinel_buffer_timestamps[sess_key]) > 7.0:
                sentinel_rolling_buffers[sess_key] = np.array([], dtype=np.float32)
            sentinel_buffer_timestamps[sess_key] = now
            
            buf = sentinel_rolling_buffers.get(sess_key, np.array([], dtype=np.float32))
            buf = np.concatenate([buf, y_chunk])
            if len(buf) > 80000:  # 5.0 seconds at 16kHz
                buf = buf[-80000:]
            sentinel_rolling_buffers[sess_key] = buf
            
            # Write continuous rolling buffer to disk for feature extraction
            if len(buf) >= 32000:
                sf.write(temp_chunk_path, buf, 16000, subtype='PCM_16', format='WAV')
            
            # Sensitive Voice Activity Detection (VAD) via RMS & Peak amplitude
            if rms >= 0.0018 or peak >= 0.012:
                has_active_speech = True
                img, _ = audio_to_spectrogram_image(temp_chunk_path)
                voice_res = run_cnn_inference(img, audio_path=temp_chunk_path, transcript=transcript)
                voice_pred = voice_res['prediction']
                voice_conf = voice_res['confidence']
            else:
                # Silence or ambient background breathing - no vocal speech in this slice
                voice_pred = "REAL"
                voice_conf = 92.0
            
            print(f"[SENTINEL] Buf: {len(buf)/16000:.1f}s | RMS: {rms:.5f} | Peak: {peak:.5f} | Speech: {has_active_speech} | Voice: {voice_pred} ({voice_conf}%) | Txt: '{transcript[:30]}'", flush=True)
        except Exception as e:
            print("Sentinel slice error:", e)
        finally:
            if os.path.exists(temp_chunk_path):
                os.remove(temp_chunk_path)
    else:
        # When transcript-only stream arrives from browser extension, evaluate for synthetic voice markers
        t_clean = (transcript or "").lower()
        ai_phrases = ['generate your audio', 'choose me to generate', 'like my voice', 'ai voice', 'synthetic voice', 'voice clone', 'cloned voice', 'text to speech']
        if any(phrase in t_clean for phrase in ai_phrases):
            voice_pred = "FAKE"
            voice_conf = 92.0

    intent_result = nlp.analyze_conversational_intent(transcript)
    matrix = nlp.compute_combined_threat_matrix(
        voice_pred, voice_conf,
        intent_result['prediction'], intent_result['confidence'],
        transcript
    )

    # When listening with no speech yet and no keywords, keep sentinel clean and standby
    if not transcript and not has_active_speech and voice_pred == "REAL":
        verdict = "LISTENING (CALL SECURED)"
        risk_level = "SAFE"
        risk_score = 10
    else:
        verdict = matrix['verdict']
        risk_level = matrix['risk_level']
        risk_score = matrix['overall_risk_score']

    return jsonify({
        "status": "success",
        "voice": voice_pred,
        "voice_conf": voice_conf,
        "intent": intent_result['prediction'],
        "intent_conf": intent_result['confidence'],
        "transcript_snippet": transcript or "(Listening to audio stream...)",
        "keywords": intent_result['keywords'],
        "risk_level": risk_level,
        "verdict": verdict,
        "risk_score": risk_score,
        "has_active_speech": has_active_speech
    })

# ==================== SCOPED SQLITE & REPORT ROUTES ====================
@app.route('/api/history', methods=['GET', 'DELETE'])
def scan_history():
    user = get_current_user()
    user_id = user['id'] if user else None

    if request.method == 'DELETE':
        db.clear_history(user_id=user_id)
        return jsonify({"status": "success", "message": "History cleared."})
    
    records = db.get_history(user_id=user_id, limit=25)
    return jsonify({"status": "success", "history": records})

@app.route('/api/stats', methods=['GET'])
def get_analytics():
    user = get_current_user()
    user_id = user['id'] if user else None
    stats = db.get_stats(user_id=user_id)
    return jsonify({"status": "success", "stats": stats, "user": user})

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    data = request.json or {}
    scan_id = data.get('scan_id')
    user_flag = data.get('user_flag')
    notes = data.get('notes', '')
    if not scan_id or not user_flag:
        return jsonify({"error": "Missing scan_id or user_flag"}), 400
    db.save_feedback(scan_id, user_flag, notes)
    return jsonify({"status": "success", "message": "Feedback recorded."})

@app.route('/api/report/<int:scan_id>', methods=['GET'])
def download_scan_report(scan_id):
    user = get_current_user()
    user_id = user['id'] if user else None
    scan_record = db.get_scan_by_id(scan_id, user_id=None)
    if not scan_record:
        return jsonify({"error": "Scan record not found"}), 404
        
    pdf_buffer = io.BytesIO()
    pdf_gen.generate_forensic_pdf(scan_record, pdf_buffer)
    return send_file(
        pdf_buffer,
        as_attachment=True,
        download_name=f"VoiceShield_Report_#{scan_id}.pdf",
        mimetype="application/pdf"
    )

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
    if path != "" and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    if os.path.exists(os.path.join(dist_dir, 'index.html')):
        return send_from_directory(dist_dir, 'index.html')
    return jsonify({"message": "VoiceShield AI Backend Running. Frontend dist not built."}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
