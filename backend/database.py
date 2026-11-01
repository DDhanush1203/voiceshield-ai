import sqlite3
import os
import json
import secrets
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'scam_shield.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            token TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Scans Table (with user_id foreign key)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            audio_hash TEXT,
            voice_prediction TEXT,
            voice_confidence REAL,
            scam_prediction TEXT,
            scam_confidence REAL,
            transcript TEXT,
            keywords TEXT,
            combined_verdict TEXT,
            risk_level TEXT,
            spectrogram_b64 TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Add user_id to scans if it was created in older schema
    try:
        cursor.execute('ALTER TABLE scans ADD COLUMN user_id INTEGER DEFAULT 1')
    except sqlite3.OperationalError:
        pass # Column already exists

    # 3. User Feedback Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER,
            user_flag TEXT,
            notes TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(scan_id) REFERENCES scans(id)
        )
    ''')

    # Create a default demo user if no users exist
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        demo_pwd_hash = generate_password_hash("password123")
        cursor.execute('''
            INSERT INTO users (username, full_name, email, password_hash, token)
            VALUES (?, ?, ?, ?, ?)
        ''', ('demo', 'Demo Investigator', 'demo@voiceshield.ai', demo_pwd_hash, secrets.token_hex(32)))

    conn.commit()
    conn.close()

# ==================== AUTHENTICATION METHODS ====================
def register_user(username, full_name, email, password):
    username = username.strip().lower()
    email = email.strip().lower()
    full_name = full_name.strip()
    
    if not username or not email or not password:
        return None, "All fields are required."
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check duplicate
    cursor.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email))
    if cursor.fetchone():
        conn.close()
        return None, "Username or Email already registered."

    pwd_hash = generate_password_hash(password)
    token = secrets.token_hex(32)

    try:
        cursor.execute('''
            INSERT INTO users (username, full_name, email, password_hash, token)
            VALUES (?, ?, ?, ?, ?)
        ''', (username, full_name, email, pwd_hash, token))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return {
            "id": user_id,
            "username": username,
            "full_name": full_name,
            "email": email,
            "token": token
        }, None
    except Exception as e:
        conn.close()
        return None, str(e)

def login_user(username_or_email, password):
    identifier = username_or_email.strip().lower()
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, username, full_name, email, password_hash, token
        FROM users 
        WHERE username = ? OR email = ?
    ''', (identifier, identifier))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None, "Account not found."
    
    user = dict(row)
    if not check_password_hash(user['password_hash'], password):
        conn.close()
        return None, "Invalid password."
    
    # Rotate token on login for fresh session
    new_token = secrets.token_hex(32)
    cursor.execute('UPDATE users SET token = ? WHERE id = ?', (new_token, user['id']))
    conn.commit()
    conn.close()
    
    user['token'] = new_token
    del user['password_hash']
    return user, None

def get_user_by_token(token):
    if not token:
        return None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, full_name, email
        FROM users
        WHERE token = ?
    ''', (token,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def logout_user(token):
    if not token:
        return True
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET token = NULL WHERE token = ?', (token,))
    conn.commit()
    conn.close()
    return True

# ==================== SCOPED SCAN & STATS METHODS ====================
def save_scan(user_id, filename, audio_hash, voice_prediction, voice_confidence,
              scam_prediction, scam_confidence, transcript, keywords,
              combined_verdict, risk_level, spectrogram_b64=None):
    conn = get_connection()
    cursor = conn.cursor()
    keywords_str = json.dumps(keywords) if isinstance(keywords, list) else str(keywords)
    
    cursor.execute('''
        INSERT INTO scans (
            user_id, filename, audio_hash, voice_prediction, voice_confidence,
            scam_prediction, scam_confidence, transcript, keywords,
            combined_verdict, risk_level, spectrogram_b64
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user_id, filename, audio_hash, voice_prediction, voice_confidence,
        scam_prediction, scam_confidence, transcript, keywords_str,
        combined_verdict, risk_level, spectrogram_b64
    ))
    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id

def get_scan_by_id(scan_id, user_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute('SELECT * FROM scans WHERE id = ? AND user_id = ?', (scan_id, user_id))
    else:
        cursor.execute('SELECT * FROM scans WHERE id = ?', (scan_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        data = dict(row)
        try:
            data['keywords'] = json.loads(data['keywords'])
        except Exception:
            data['keywords'] = []
        return data
    return None

def get_history(user_id=None, limit=25):
    conn = get_connection()
    cursor = conn.cursor()
    
    if user_id:
        cursor.execute('''
            SELECT id, user_id, filename, timestamp, voice_prediction, voice_confidence,
                   scam_prediction, scam_confidence, transcript, keywords,
                   combined_verdict, risk_level, audio_hash
            FROM scans
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        ''', (user_id, limit))
    else:
        cursor.execute('''
            SELECT id, user_id, filename, timestamp, voice_prediction, voice_confidence,
                   scam_prediction, scam_confidence, transcript, keywords,
                   combined_verdict, risk_level, audio_hash
            FROM scans
            ORDER BY id DESC
            LIMIT ?
        ''', (limit,))

    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        item = dict(r)
        try:
            item['keywords'] = json.loads(item['keywords'])
        except Exception:
            item['keywords'] = []
        results.append(item)
    return results

def get_stats(user_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    where_clause = "WHERE user_id = ?" if user_id else ""
    params = (user_id,) if user_id else ()

    cursor.execute(f'SELECT COUNT(*) FROM scans {where_clause}', params)
    total_scans = cursor.fetchone()[0]
    
    fake_query = f"SELECT COUNT(*) FROM scans WHERE voice_prediction = 'FAKE'" + (f" AND user_id = ?" if user_id else "")
    cursor.execute(fake_query, params)
    deepfakes_detected = cursor.fetchone()[0]
    
    scam_query = f"SELECT COUNT(*) FROM scans WHERE scam_prediction = 'SCAM'" + (f" AND user_id = ?" if user_id else "")
    cursor.execute(scam_query, params)
    scam_convos_detected = cursor.fetchone()[0]
    
    threat_query = f"SELECT COUNT(*) FROM scans WHERE risk_level IN ('CRITICAL', 'HIGH')" + (f" AND user_id = ?" if user_id else "")
    cursor.execute(threat_query, params)
    critical_threats = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total_scans": total_scans,
        "deepfakes_detected": deepfakes_detected,
        "scam_conversations": scam_convos_detected,
        "critical_threats": critical_threats,
        "deepfake_rate": round((deepfakes_detected / total_scans * 100), 1) if total_scans > 0 else 0,
        "scam_rate": round((scam_convos_detected / total_scans * 100), 1) if total_scans > 0 else 0
    }

def clear_history(user_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute('DELETE FROM scans WHERE user_id = ?', (user_id,))
    else:
        cursor.execute('DELETE FROM scans')
    conn.commit()
    conn.close()
    return True

def save_feedback(scan_id, user_flag, notes=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO feedback (scan_id, user_flag, notes)
        VALUES (?, ?, ?)
    ''', (scan_id, user_flag, notes))
    conn.commit()
    conn.close()
    return True

# Initialize on import
init_db()
