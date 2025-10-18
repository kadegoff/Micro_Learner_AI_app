import sys
print("Python is working")
print("Python version:", sys.version)

try:
    import faster_whisper
    print("faster-whisper module found")
except ImportError:
    print("faster-whisper NOT FOUND - run: pip install faster-whisper")
    sys.exit(1)

print("All tests passed!")
