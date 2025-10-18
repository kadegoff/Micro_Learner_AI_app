
import sys
import json
import struct

try:
    from vosk import Model, KaldiRecognizer
    model_path = sys.argv[1]
    model = Model(model_path)
    rec = KaldiRecognizer(model, 16000)
    print("VOSK_READY", flush=True)
    
    while True:
        try:
            length_bytes = sys.stdin.buffer.read(4)
            if not length_bytes:
                break
            
            length = struct.unpack('I', length_bytes)[0]
            audio_data = sys.stdin.buffer.read(length)
            if not audio_data:
                break
            
            if rec.AcceptWaveform(audio_data):
                result = json.loads(rec.Result())
                if result.get('text', '').strip():
                    print(json.dumps({"type": "final", "text": result['text']}), flush=True)
            else:
                partial = json.loads(rec.PartialResult())
                if partial.get('partial', '').strip():
                    print(json.dumps({"type": "partial", "text": partial['partial']}), flush=True)
                    
        except Exception as e:
            print(json.dumps({"type": "error", "error": str(e)}), flush=True)
            
except Exception as e:
    print(json.dumps({"type": "error", "error": f"Startup error: {str(e)}"}), flush=True)
    sys.exit(1)
