#!/usr/bin/env python3
"""
Enhanced model downloader with integrity verification
"""

import sys
import json
import time
import os
from pathlib import Path

def safe_print(message):
    """Safely print JSON messages"""
    try:
        if isinstance(message, dict):
            print(json.dumps(message), flush=True)
        else:
            print(str(message), flush=True)
    except Exception as e:
        print(f"Print error: {e}", file=sys.stderr, flush=True)

def verify_model_integrity(model_name):
    """Verify that all required model files exist and are valid"""
    try:
        from faster_whisper import WhisperModel
        
        # Try to load the model - this will fail if files are missing/corrupted
        model = WhisperModel(model_name, device="cpu", compute_type="int8", local_files_only=True)
        
        # If we get here, the model loaded successfully
        del model  # Clean up
        return True
        
    except Exception as e:
        print(f"Model integrity check failed: {e}", file=sys.stderr)
        return False

def get_model_cache_path(model_name):
    """Get the cache path for a model"""
    import os
    from pathlib import Path
    
    # Try different possible cache locations
    possible_paths = [
        Path.home() / ".cache" / "huggingface" / "hub" / f"models--Systran--faster-whisper-{model_name}",
        Path(os.environ.get("HF_HOME", "")) / "hub" / f"models--Systran--faster-whisper-{model_name}" if os.environ.get("HF_HOME") else None,
        Path(os.environ.get("TRANSFORMERS_CACHE", "")) / f"models--Systran--faster-whisper-{model_name}" if os.environ.get("TRANSFORMERS_CACHE") else None,
    ]
    
    for path in possible_paths:
        if path and path.exists():
            return path
    
    return None

def force_remove_corrupted_model(model_name):
    """Remove corrupted model files"""
    try:
        import shutil
        
        cache_path = get_model_cache_path(model_name)
        if cache_path and cache_path.exists():
            print(f"Removing corrupted model at: {cache_path}", file=sys.stderr)
            shutil.rmtree(cache_path)
            return True
        return False
        
    except Exception as e:
        print(f"Error removing corrupted model: {e}", file=sys.stderr)
        return False

def download_and_verify_model(model_name):
    """Download model with integrity verification"""
    start_time = time.time()
    
    try:
        # First check if model exists and is valid
        if verify_model_integrity(model_name):
            safe_print({
                "status": "already_exists",
                "model": model_name,
                "verified": True
            })
            return True
        
        # Model doesn't exist or is corrupted, need to download/re-download
        print(f"Model {model_name} missing or corrupted, downloading...", file=sys.stderr)
        
        # Remove any corrupted files first
        force_remove_corrupted_model(model_name)
        
        safe_print({
            "status": "downloading",
            "model": model_name,
            "size_mb": 769 if model_name == "medium" else "unknown"
        })
        
        # Import here to trigger download
        from faster_whisper import WhisperModel
        
        # This will download the model if it doesn't exist
        print(f"Downloading {model_name} model (this may take several minutes)...", file=sys.stderr)
        model = WhisperModel(model_name, device="cpu", compute_type="int8", local_files_only=False)
        
        # Verify the download worked
        del model  # Clean up first instance
        
        if verify_model_integrity(model_name):
            download_time = time.time() - start_time
            safe_print({
                "status": "success",
                "model": model_name,
                "download_time": f"{download_time:.1f}",
                "verified": True
            })
            return True
        else:
            safe_print({
                "status": "error",
                "model": model_name,
                "error": "Downloaded model failed integrity check"
            })
            return False
            
    except Exception as e:
        error_msg = str(e)
        print(f"Download error: {error_msg}", file=sys.stderr)
        
        safe_print({
            "status": "error",
            "model": model_name,
            "error": error_msg
        })
        return False

def main():
    """Main download function"""
    if len(sys.argv) < 2:
        safe_print({
            "status": "error",
            "error": "Model name required as argument"
        })
        return 1
    
    model_name = sys.argv[1]
    
    print(f"Starting download/verification for model: {model_name}", file=sys.stderr)
    
    success = download_and_verify_model(model_name)
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())