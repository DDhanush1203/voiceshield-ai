import os
import librosa
import librosa.display
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

def setup_directories(output_base_dir, classes):
    """Creates the output directories for train/test splits and classes."""
    for cls in classes:
        os.makedirs(os.path.join(output_base_dir, cls), exist_ok=True)

def generate_mel_spectrogram(audio_path, save_path):
    """
    Loads an audio file, generates a Mel-spectrogram, 
    and saves it as an image for CNN training.
    """
    try:
        # Load audio file (sr=None preserves original sample rate)
        y, sr = librosa.load(audio_path, sr=None)
        
        # Generate mel-spectrogram
        # n_mels=128 is a standard feature size for audio deep learning
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        
        # Convert power to decibels (log scale)
        S_dB = librosa.power_to_db(S, ref=np.max)
        
        # Plot and save as image (without axes/borders for clean CNN input)
        plt.figure(figsize=(4, 4))
        librosa.display.specshow(S_dB, sr=sr, fmax=8000)
        plt.axis('off') # Hide axes
        
        # Save image
        plt.savefig(save_path, bbox_inches='tight', pad_inches=0, transparent=True)
        plt.close()
        return True
    except Exception as e:
        print(f"Error processing {audio_path}: {e}")
        return False

def process_dataset(raw_data_dir, output_img_dir):
    """Iterates through the dataset and converts audio to spectrogram images."""
    print("Starting Data Preprocessing...")
    
    # Assuming dataset has subfolders for 'real' and 'fake' (or similar)
    classes = [d for d in os.listdir(raw_data_dir) if os.path.isdir(os.path.join(raw_data_dir, d))]
    
    if not classes:
        print(f"No class folders found in {raw_data_dir}. Please make sure you extracted the dataset correctly.")
        return

    setup_directories(output_img_dir, classes)

    for cls in classes:
        class_dir = os.path.join(raw_data_dir, cls)
        audio_files = [f for f in os.listdir(class_dir) if f.endswith('.wav')]
        
        print(f"\nProcessing class: {cls} ({len(audio_files)} files found)")
        
        for i, file_name in enumerate(audio_files):
            input_path = os.path.join(class_dir, file_name)
            
            # Change extension to .png for the output
            out_file_name = f"{os.path.splitext(file_name)[0]}.png"
            output_path = os.path.join(output_img_dir, cls, out_file_name)
            
            # Skip if already processed
            if os.path.exists(output_path):
                continue
                
            generate_mel_spectrogram(input_path, output_path)
            
            if (i + 1) % 50 == 0:
                print(f"  Processed {i + 1}/{len(audio_files)} files...")

    print("\nPreprocessing Complete! Spectrograms are ready for CNN training.")

if __name__ == "__main__":
    # Define paths based on our project structure
    BASE_DIR = Path(__file__).resolve().parent
    RAW_DATA_DIR = os.path.join(BASE_DIR, "data", "raw")
    OUTPUT_IMG_DIR = os.path.join(BASE_DIR, "data", "spectrograms")
    
    process_dataset(RAW_DATA_DIR, OUTPUT_IMG_DIR)
