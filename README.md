# VoiceShield AI: Voice Deepfake & Scam Call Detection System

> **AI-Based Voice Deepfake & Scam Call Detection System for Real-Time Secure Communication**  
> **Master of Computer Applications (MCA) — Major Project Phase 2**  
> **PES University, Bengaluru, India**  
> **Student:** D Dhanush (`PES1PG25CA045`) | **Project Guide:** Dr. Sujatha V.

---

## 📌 Overview

With the rapid emergence of generative voice cloning (e.g., ElevenLabs, RVC, VITS) and AI-driven conversational fraud, voice calls have become a prime vector for financial scams, impersonation attacks, and digital kidnapping extortion.

**VoiceShield AI** is an end-to-end, real-time cyber defense platform combining **Dual-Layer Acoustic Deepfake Detection** with **Conversational NLP Intent Analysis**. The system intercepts live VoIP calls (WhatsApp Web, Google Meet, Microsoft Teams, Zoom) and local microphone streams, providing real-time threat verdicts in sub-second intervals.

---

## 🏗️ System Architecture

```
                       [ Live Call Audio Stream ]
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
      [ Layer 1: Acoustic Model ]           [ Layer 2: Intent Analysis ]
      - Voice Activity Detection (VAD)      - Web Speech Streaming API
      - 128-Mel Spectrogram (Magma)         - TF-IDF + Logistic Classifier
      - PyTorch 2D-CNN Classifier           - Fraud Keyword Regex Engine
      - Vocal Biomarkers (Jitter, Rolloff)  - Social Engineering Scoring
                 │                                   │
                 └─────────────────┬─────────────────┘
                                   ▼
             [ Multi-Modal Unified Threat Matrix Engine ]
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
[ Detection Studio ]      [ Sentinel Live Monitor ]   [ Chrome VoIP Hook ]
(File & Mic Auditing)     (Sliding Temporal Consensus) (In-Call Floating HUD)
```

---

## ✨ Key Features

1. **Detection Studio (Dual-Layer Forensic Auditing):**
   - High-fidelity Mel-spectrogram generation with leading/trailing silence normalization.
   - Deepfake classification using a trained PyTorch 2D-CNN.
   - Explainable acoustic biomarkers: **Pitch Jitter** (vocal fold micro-perturbation) and **Spectral Rolloff** (vocoder low-pass cutoff).
   - Generates downloadable forensic PDF reports for cybercrime evidence documentation.

2. **Live Call Sentinel (Real-Time Sub-Second Monitor):**
   - Voice Activity Detection (VAD) to eliminate silence misclassifications.
   - 4-Slice Sliding Window Consensus Engine to prevent transient mic pops from triggering false alarms.
   - Native browser Web Speech API integration for zero-latency, word-by-word streaming transcriptions.

3. **Browser Telephony Hook Extension (Manifest V3):**
   - Injects a floating in-call HUD over **WhatsApp Web**, **Google Meet**, **Teams**, and **Discord**.
   - Persistent speech accumulator that preserves spoken words across conversational pauses.
   - Automatic fraud keyword alerts (`OTP`, `CVV`, `arrest warrant`, `bank freeze`, `wire transfer`).

4. **Threat Intelligence & Scoped Database:**
   - Multi-user authentication (JWT session tokens).
   - Scoped SQLite database tracking scan histories, feedback telemetry, and aggregate threat ratios.

---

## 📁 Repository Structure

```
deepfake_project/
├── backend/
│   ├── app.py                     # Flask REST API & Sentinel streaming endpoints
│   ├── nlp_detector.py            # Layer 2: NLP intent model & threat matrix
│   ├── database.py                # Scoped SQLite database management
│   ├── pdf_generator.py           # ReportLab forensic report generator
│   ├── scam_nlp_model.joblib      # Trained NLP scam intent pipeline
│   └── requirements.txt           # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Unified Dashboard, Studio & Sentinel UI
│   │   ├── App.css                # Custom styling & radar animations
│   │   └── main.jsx               # React DOM entry point
│   ├── package.json               # Node.js dependencies
│   └── vite.config.js             # Vite configuration
│
├── browser_extension/
│   ├── manifest.json              # Chrome Manifest V3 configuration
│   ├── content.js                 # In-call floating overlay & speech accumulator
│   ├── background.js              # Background service worker & API relay
│   ├── popup.html / popup.js      # Telephony hook popup HUD
│   └── icons/                     # Extension branding icons
│
├── demo_samples/
│   ├── sample_real_voice.wav      # Sample authentic human voice
│   └── sample_deepfake_voice.wav  # Sample AI-cloned voice
│
├── model_weights.pth              # PyTorch Deepfake CNN model weights
├── train_model.py                 # PyTorch training pipeline
├── preprocess_audio.py            # Spectrogram preprocessing script
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10 to 3.12 recommended
- **Node.js**: v18+ and npm
- **Google Chrome** (for Web Speech API and extension hook)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the Flask API server
python app.py
```
*Backend server runs on `http://127.0.0.1:5000`.*

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install npm packages
npm install

# Start Vite dev server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

### 3. Chrome Extension Installation

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `browser_extension/` directory from this project.
5. Open [WhatsApp Web](https://web.whatsapp.com/) or [`http://localhost:5173/`](http://localhost:5173/) and click the VoiceShield extension icon to activate call monitoring.

---

## 🔬 Forensic Verification Benchmarks

| Test Payload | Acoustic Layer | Intent Layer | Combined Verdict | Risk Code |
| :--- | :---: | :---: | :--- | :---: |
| **Natural Human Voice** | `REAL (Safe)` | `SAFE` | `AUTHENTIC CALL (SAFE)` | `SAFE (15%)` |
| **TTS / Vocoder Clone** | `FAKE (High)` | `SAFE` | `VOICE IMPERSONATION DETECTED` | `HIGH (72%)` |
| **Human Scam Caller** | `REAL (Safe)` | `SCAM` | `HUMAN SOCIAL ENGINEERING SCAM` | `HIGH (50%)` |
| **Deepfake Scam Attack** | `FAKE (High)` | `SCAM` | `CRITICAL THREAT: DEEPFAKE SCAM ATTACK` | `CRITICAL (92%)` |

---

## 📜 Citation & Academic Notice

This project was developed as part of the **MCA Major Project (Phase 2)** at **PES University, Bengaluru**.

- **Author:** D Dhanush (USN: `PES1PG25CA045`)
- **Guide:** Dr. Sujatha V., Department of Computer Applications, PES University
- **Academic Year:** 2026
