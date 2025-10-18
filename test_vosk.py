
try:
    import vosk
    print("Vosk import successful")
    print("Vosk version:", vosk.__version__ if hasattr(vosk, '__version__') else 'unknown')
except ImportError as e:
    print("Vosk import failed:", str(e))
except Exception as e:
    print("Unexpected error:", str(e))
