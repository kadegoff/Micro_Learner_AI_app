import sys
import json
import wave
from vosk import Model, KaldiRecognizer

def transcribe(audio_file, model_path):
    wf = wave.open(audio_file, 'rb')
    model = Model(model_path)
    rec = KaldiRecognizer(model, wf.getframerate())
    
    results = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            results.append(json.loads(rec.Result()))
    
    results.append(json.loads(rec.FinalResult()))
    print(json.dumps(results))

if __name__ == "__main__":
    audio_file = sys.argv[1]
    model_path = sys.argv[2]
    transcribe(audio_file, model_path)