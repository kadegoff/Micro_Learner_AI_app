# Add this to your download_model.py or modify the existing downloadMediumModel function in main.js

import sys
import json
import time
from faster_whisper import WhisperModel

def download_small_model():
    """Download and verify small Whisper model"""
    try:
        print(json.dumps({
            "status": "checking", 
            "model": "small",
            "message": "Checking for small model..."
        }))
        
        start_time = time.time()
        
        # Try to load existing model
        try:
            model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
            print(json.dumps({
                "status": "already_exists", 
                "model": "small", 
                "verified": True,
                "message": "Small model already available"
            }))
            return
        except:
            pass
        
        # Download small model
        print(json.dumps({
            "status": "downloading", 
            "model": "small",
            "message": "Downloading small model (~244MB)..."
        }))
        
        # This will download if not present
        model = WhisperModel("small", device="cpu", compute_type="int8")
        
        download_time = time.time() - start_time
        
        print(json.dumps({
            "status": "success", 
            "model": "small", 
            "download_time": f"{download_time:.1f}",
            "message": f"Small model ready in {download_time:.1f}s"
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error", 
            "model": "small",
            "error": str(e)
        }))

if __name__ == "__main__":
    model_type = sys.argv[1] if len(sys.argv) > 1 else "small"
    
    if model_type == "small":
        download_small_model()
    elif model_type == "medium":
        # Your existing medium model code
        pass
    else:
        print(json.dumps({"status": "error", "error": f"Unknown model: {model_type}"}))
        