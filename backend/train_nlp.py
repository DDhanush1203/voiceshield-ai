import os
import pandas as pd
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import joblib

def train_nlp_model():
    data_path = os.path.join(os.path.dirname(__file__), '..', 'scam_data', 'dataset.csv')
    df = pd.read_csv(data_path)

    # Everyday conversational and caller identification phrases (label 0: SAFE)
    everyday_safe = [
        "hello who is this", "hello who is this please", "who is speaking please",
        "hello who is calling", "hello is this Dhanush", "hello how are you doing",
        "good morning how are you", "good afternoon can you hear me", "hey hello how are you doing",
        "namaste bhai aur behno", "namaste kaise ho aap", "hello captain blogger",
        "hi there can you hear me", "hello this is me speaking", "yes I can hear you clearly",
        "sorry wrong number", "can you call back later", "what is your name",
        "hello are you there", "thanks for reaching out", "let us talk tomorrow",
        "how was your weekend", "nice to meet you", "can you hear me well",
        "hello testing testing", "one two three testing mic"
    ]
    extra_df = pd.DataFrame([{"text": p, "label": 0} for p in everyday_safe])
    df = pd.concat([df, extra_df], ignore_index=True)

    X = df['text'].fillna('')
    y = df['label'].astype(int)

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english', ngram_range=(1, 2), max_features=5000, sublinear_tf=True)),
        ('clf', LogisticRegression(C=1.0, max_iter=500, random_state=42))
    ])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring='f1_macro')
    print(f"5-Fold Macro F1: {scores.mean():.4f} (+/- {scores.std():.4f})")

    pipeline.fit(X, y)
    model_out = os.path.join(os.path.dirname(__file__), 'scam_nlp_model.joblib')
    joblib.dump(pipeline, model_out)
    print(f"Saved model to {model_out}")

    # Sanity tests
    tests = [
        "Please share your bank account number and OTP immediately to prevent account suspension.",
        "Hey, how was your weekend? Do you want to grab lunch later?",
        "Federal tax investigation department calling regarding an unpaid fine. Transfer payment immediately to avoid arrest.",
        "hello who is this hair captain blogger",
        "hello who is calling please"
    ]
    for t in tests:
        prob = pipeline.predict_proba([t])[0]
        is_scam = prob[1] >= 0.5
        print(f"Sample: '{t[:40]}...' -> {'SCAM' if is_scam else 'SAFE'} ({prob[1]*100:.1f}% scam prob)")

if __name__ == '__main__':
    train_nlp_model()
