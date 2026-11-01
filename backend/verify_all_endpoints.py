import requests, os, json, io, soundfile as sf, numpy as np

BASE_URL = 'http://127.0.0.1:5000/api'

print("=" * 60)
print("1. TESTING HEALTH ENDPOINT")
print("=" * 60)
h_res = requests.get(f"{BASE_URL}/health")
print("Status:", h_res.status_code)
print("Response:", h_res.json())

print("\n" + "=" * 60)
print("2. TESTING DETECTION STUDIO (/api/analyze)")
print("=" * 60)

test_cases_studio = [
    ("REAL Human Voice", r"D:\Major Project\deepfake_project\demo_samples\sample_real_voice.wav", "REAL"),
    ("DEEPFAKE Voice", r"D:\Major Project\deepfake_project\demo_samples\sample_deepfake_voice.wav", "FAKE"),
    ("SYNTHESIZED AI Voice", r"D:\Major Project\deepfake_project\backend\test_synth_sapi.wav", "FAKE"),
]

for label, p, expected_voice in test_cases_studio:
    with open(p, 'rb') as f:
        res = requests.post(f"{BASE_URL}/analyze", files={'file': f})
        data = res.json()
        pred = data.get('prediction')
        conf = data.get('confidence')
        verdict = data.get('verdict')
        risk = data.get('risk_level')
        passed = (pred == expected_voice)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {label:22s} -> Got: {pred:4s} ({conf:4.1f}%) | Expected: {expected_voice:4s} | Verdict: {verdict} ({risk})")
        print(f"       Biomarkers: {data.get('acoustic_biomarkers')}")

print("\n" + "=" * 60)
print("3. TESTING LIVE SENTINEL (/api/sentinel)")
print("=" * 60)

test_cases_sentinel = [
    ("REAL Voice Chunk", r"D:\Major Project\deepfake_project\demo_samples\sample_real_voice.wav", "most successful", "REAL"),
    ("DEEPFAKE Chunk", r"D:\Major Project\deepfake_project\demo_samples\sample_deepfake_voice.wav", "my favourite", "FAKE"),
    ("SYNTH AI Chunk", r"D:\Major Project\deepfake_project\backend\test_synth_sapi.wav", "hi there how do you like my voice choose me to generate your audio", "FAKE"),
    ("SCAM Attack Chunk", r"D:\Major Project\deepfake_project\demo_samples\sample_deepfake_voice.wav", "urgent your hdfc bank account is blocked give me your 6 digit otp immediately", "FAKE"),
]

for label, p, txt, exp_voice in test_cases_sentinel:
    with open(p, 'rb') as f:
        res = requests.post(f"{BASE_URL}/sentinel", files={'chunk': f}, data={'transcript': txt})
        data = res.json()
        voice = data.get('voice')
        intent = data.get('intent')
        verdict = data.get('verdict')
        risk = data.get('risk_level')
        score = data.get('risk_score')
        passed = (voice == exp_voice)
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {label:20s} -> Voice: {voice:4s} | Intent: {intent:4s} | Risk: {risk:8s} ({score:4.1f}) | Verdict: {verdict}")

print("\n" + "=" * 60)
print("4. TESTING AMBIENT SILENCE / LOW NOISE IN SENTINEL")
print("=" * 60)
silence_buf = io.BytesIO()
silence = np.random.normal(0, 0.002, 32000)
sf.write(silence_buf, silence, 16000, format='WAV', subtype='PCM_16')
silence_buf.seek(0)
res = requests.post(f"{BASE_URL}/sentinel", files={'chunk': silence_buf}, data={'transcript': ''})
s_data = res.json()
print("Ambient noise response:", s_data.get('voice'), s_data.get('intent'), s_data.get('verdict'), s_data.get('risk_level'))

print("\nVerification Complete.")
