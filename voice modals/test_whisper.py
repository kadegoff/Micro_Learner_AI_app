
try:
    from faster_whisper import WhisperModel
    print("faster-whisper import successful")
    print("Testing model initialization...")
    # FIXED: Use "base" model instead of "large-v3" for testing
    model = WhisperModel("base", device="cpu", compute_type="int8")
    print("Model loaded successfully")
except ImportError as e:
    print("faster-whisper import failed:", str(e))
except Exception as e:
    print("Model loading error:", str(e))
