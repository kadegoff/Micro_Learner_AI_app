
try:
    from faster_whisper import WhisperModel
    import numpy as np
    import time
    
    print("Testing BEST Whisper (large-v3)...")
    start_time = time.time()
    
    # Load the BEST model
    model = WhisperModel("large-v3", device="cpu", compute_type="int8", local_files_only=True)
    load_time = time.time() - start_time
    
    print(f"BEST model loaded in {load_time:.1f} seconds")
    
    # Quick test
    test_audio = np.random.normal(0, 0.01, 16000).astype(np.float32)
    segments, info = model.transcribe(test_audio, beam_size=1)
    list(segments)  # Consume generator
    
    print("BEST model test successful")
    print(f"Language detection: {info.language}")
    print("BEST Whisper ready")
    
except ImportError as e:
    print("faster-whisper import failed:", str(e))
    print("Please install: pip install faster-whisper")
except FileNotFoundError as e:
    print("BEST model not found:", str(e))
    print("Please run download_model.py first")
except Exception as e:
    print("BEST model test error:", str(e))
