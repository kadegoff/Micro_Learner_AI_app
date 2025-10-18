#!/usr/bin/env python3
"""
Pre-download the best Whisper model (large-v3) with progress tracking
"""

import sys
import json
import os
import time
from pathlib import Path

def safe_print(message, file=sys.stdout):
    """Safely print messages"""
    try:
        if isinstance(message, dict):
            print(json.dumps(message), file=file, flush=True)
        else:
            print(str(message), file=file, flush=True)
    except Exception as e:
        print(f"Print error: {e}", file=sys.stderr, flush=True)

def safe_print_error(message):
    """Print to stderr"""
    safe_print(message, file=sys.stderr)

def check_model_exists(model_name):
    """Check if model already exists locally"""
    cache_dirs = [
        os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub"),
        os.path.join(os.path.expanduser("~"), ".cache", "whisper"),
        os.path.join(os.path.expanduser("~"), ".cache", "faster-whisper"),
    ]
    
    for cache_dir in cache_dirs:
        if os.path.exists(cache_dir):
            for item in os.listdir(cache_dir):
                if model_name.replace("-", "_") in item.lower() or model_name.replace("_", "-") in item.lower():
                    safe_print_error(f"✅ Found existing model in: {os.path.join(cache_dir, item)}")
                    return True
    
    return False

def download_model_with_progress(model_name="large-v3"):
    """Download Whisper model with progress tracking"""
    safe_print_error(f"🚀 Starting download of Whisper model: {model_name}")
    safe_print_error("This is the BEST quality model - may take 5-10 minutes for first download")
    
    try:
        # Check if already exists
        if check_model_exists(model_name):
            safe_print_error(f"✅ Model {model_name} already exists locally!")
            safe_print({"status": "already_exists", "model": model_name})
            return True
        
        safe_print_error("📥 Model not found locally, downloading...")
        safe_print({"status": "downloading", "model": model_name})
        
        # Import here to show immediate feedback
        safe_print_error("📦 Importing faster-whisper...")
        from faster_whisper import WhisperModel
        
        safe_print_error("🔄 Creating WhisperModel instance (this triggers download)...")
        start_time = time.time()
        
        # Create model - this will download if needed
        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8",
            download_root=None,
            local_files_only=False  # Allow download
        )
        
        download_time = time.time() - start_time
        safe_print_error(f"✅ Model downloaded successfully in {download_time:.1f} seconds!")
        
        # Test the model quickly
        safe_print_error("🧪 Testing model...")
        import numpy as np
        test_audio = np.zeros(16000, dtype=np.float32)  # 1 second of silence
        
        segments, info = model.transcribe(test_audio, beam_size=1)
        list(segments)  # Consume generator
        
        safe_print_error("✅ Model test successful!")
        safe_print({
            "status": "success", 
            "model": model_name,
            "download_time": round(download_time, 1),
            "language": info.language if hasattr(info, 'language') else "unknown"
        })
        
        return True
        
    except Exception as e:
        error_msg = str(e)
        safe_print_error(f"❌ Download failed: {error_msg}")
        
        # Provide helpful error messages
        if "ConnectTimeout" in error_msg or "ConnectionError" in error_msg:
            safe_print_error("💡 Network issue - check your internet connection")
        elif "disk" in error_msg.lower() or "space" in error_msg.lower():
            safe_print_error("💡 Disk space issue - you need ~3GB free space")
        elif "permission" in error_msg.lower():
            safe_print_error("💡 Permission issue - try running as administrator")
        
        safe_print({"status": "error", "error": error_msg, "model": model_name})
        return False

def main():
    """Main downloader function"""
    safe_print_error("🚀 Whisper Model Downloader Starting")
    
    # Get model name from args or use best default
    model_name = sys.argv[1] if len(sys.argv) > 1 else "large-v3"
    
    safe_print_error(f"🎯 Target model: {model_name}")
    safe_print_error("📊 Model sizes:")
    safe_print_error("  • tiny: ~39 MB (fastest, lowest quality)")
    safe_print_error("  • base: ~74 MB (good balance)")
    safe_print_error("  • small: ~244 MB (better quality)")
    safe_print_error("  • medium: ~769 MB (high quality)")
    safe_print_error("  • large-v3: ~1550 MB (BEST quality)")
    
    try:
        success = download_model_with_progress(model_name)
        
        if success:
            safe_print_error("🎉 MODEL READY FOR USE!")
            safe_print_error("You can now start real-time transcription")
            return 0
        else:
            safe_print_error("❌ MODEL DOWNLOAD FAILED")
            return 1
            
    except KeyboardInterrupt:
        safe_print_error("⏹️ Download interrupted by user")
        return 1
    except Exception as e:
        safe_print_error(f"❌ Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())