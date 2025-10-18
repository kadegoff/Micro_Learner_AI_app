import sys
import json
import struct
import os
import logging

# Set up logging to file for debugging
logging.basicConfig(
    filename='vosk_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

try:
    from vosk import Model, KaldiRecognizer, SetLogLevel
    # Reduce Vosk logging noise in console
    SetLogLevel(-1)
    print("DEBUG: Vosk imported successfully", file=sys.stderr)
    logging.info("Vosk imported successfully")
except ImportError as e:
    error_msg = f"Failed to import vosk: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

if len(sys.argv) < 2:
    error_msg = "Model path not provided"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

model_path = sys.argv[1]
print(f"DEBUG: Loading model from {model_path}", file=sys.stderr)
logging.info(f"Loading model from {model_path}")

# Check if model exists
if not os.path.exists(model_path):
    error_msg = f"Model not found at: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

try:
    model = Model(model_path)
    # Create recognizer with improved settings
    rec = KaldiRecognizer(model, 16000)
    
    # Set words to true for better accuracy
    rec.SetWords(True)
    
    # Set partial results to true for real-time feedback
    rec.SetPartialWords(True)
    
    # Set maximum alternatives to 0 for faster processing
    rec.SetMaxAlternatives(0)
    
    print("VOSK_READY", flush=True)
    print("DEBUG: Vosk ready with optimized settings", file=sys.stderr)
    logging.info("Vosk initialized successfully")
except Exception as e:
    error_msg = f"Failed to load model: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

# Counter for debugging
chunks_processed = 0
total_bytes_received = 0

while True:
    try:
        # Read length of audio data (4 bytes)
        length_bytes = sys.stdin.buffer.read(4)
        
        if not length_bytes:
            logging.info("No more data (empty read), exiting")
            print("DEBUG: No more data, exiting", file=sys.stderr)
            break
            
        if len(length_bytes) < 4:
            logging.warning(f"Incomplete length bytes: {len(length_bytes)}")
            print(f"DEBUG: Incomplete length bytes: {len(length_bytes)}", file=sys.stderr)
            break
        
        length = struct.unpack('I', length_bytes)[0]
        logging.debug(f"Expecting {length} bytes of audio data")
        
        # Read audio data
        audio_data = sys.stdin.buffer.read(length)
        
        if not audio_data:
            logging.warning("No audio data received")
            break
            
        actual_length = len(audio_data)
        if actual_length < length:
            logging.warning(f"Incomplete audio data: {actual_length} < {length}")
            print(f"DEBUG: Incomplete audio data: {actual_length} < {length}", file=sys.stderr)
            # Try to continue with what we have
        
        chunks_processed += 1
        total_bytes_received += actual_length
        
        logging.debug(f"Processing chunk #{chunks_processed}, size: {actual_length} bytes")
        
        # Log first few bytes of audio data for debugging
        if chunks_processed <= 5:
            first_bytes = ' '.join(f'{b:02x}' for b in audio_data[:20])
            logging.debug(f"First 20 bytes of chunk: {first_bytes}")
        
        # Process immediately for better responsiveness
        if rec.AcceptWaveform(audio_data):
            # Final result for this chunk
            result = json.loads(rec.Result())
            logging.info(f"Final result: {result}")
            
            if result.get('text', '').strip():
                output = {"type": "final", "text": result['text']}
                print(json.dumps(output), flush=True)
                print(f"DEBUG: Final result #{chunks_processed}: {result['text']}", file=sys.stderr)
                logging.info(f"Sent final result: {result['text']}")
        else:
            # Partial result - send it for real-time feedback
            partial = json.loads(rec.PartialResult())
            
            if partial.get('partial', '').strip():
                output = {"type": "partial", "text": partial['partial']}
                print(json.dumps(output), flush=True)
                # Don't flood stderr with partial results
                if chunks_processed % 10 == 0:
                    print(f"DEBUG: Partial result #{chunks_processed}: {partial['partial'][:50]}...", file=sys.stderr)
                logging.debug(f"Sent partial result: {partial['partial']}")
            else:
                # Log that we processed but got no result
                if chunks_processed % 10 == 0:
                    logging.debug(f"Chunk #{chunks_processed} processed but no partial result")
                
    except struct.error as e:
        error_msg = f"Struct unpacking error: {str(e)}"
        print(json.dumps({"type": "error", "error": error_msg}), flush=True)
        logging.error(error_msg)
        break
    except Exception as e:
        error_msg = f"Error processing chunk #{chunks_processed}: {str(e)}"
        print(json.dumps({"type": "error", "error": error_msg}), flush=True)
        print(f"DEBUG: {error_msg}", file=sys.stderr)
        logging.error(error_msg)
        # Try to continue processing
        continue

# Get final result if any
try:
    final = json.loads(rec.FinalResult())
    if final.get('text', '').strip():
        output = {"type": "final", "text": final['text']}
        print(json.dumps(output), flush=True)
        logging.info(f"Final result on exit: {final['text']}")
except Exception as e:
    logging.error(f"Error getting final result: {str(e)}")

print(f"DEBUG: Processed {chunks_processed} chunks, {total_bytes_received} bytes total", file=sys.stderr)
logging.info(f"Session ended: {chunks_processed} chunks, {total_bytes_received} bytes processed")