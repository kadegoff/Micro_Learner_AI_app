#!/usr/bin/env python3
"""
Fixed vosk_realtime.py - Corrected version
Save this as vosk_realtime.py (replace your current one)
"""

import sys
import json
import struct
import os
import logging
import traceback

# Set up logging to file for debugging
logging.basicConfig(
    filename='vosk_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def log_debug(message):
    """Helper to log to both stderr and file"""
    print(f"DEBUG: {message}", file=sys.stderr, flush=True)
    logging.debug(message)

def log_error(message):
    """Helper to log errors"""
    print(f"ERROR: {message}", file=sys.stderr, flush=True)
    logging.error(message)

try:
    # Import Vosk with the correct classes
    import vosk
    
    # ✅ FIX 1: Use the correct imports
    # Your code used KaldiRecognizer which is old
    # Current Vosk uses just Recognizer
    from vosk import Model, Recognizer, SetLogLevel
    
    # Reduce Vosk logging noise
    SetLogLevel(-1)
    log_debug("Vosk imported successfully")
    
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
log_debug(f"Loading model from {model_path}")

# Check if model exists
if not os.path.exists(model_path):
    error_msg = f"Model not found at: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

try:
    model = Model(model_path)
    
    # ✅ FIX 2: Use correct Recognizer class and simpler initialization
    rec = Recognizer(model, 16000)  # Just Model and sample rate
    
    log_debug("Vosk initialized successfully")
    
    # Signal that we're ready
    print("VOSK_READY", flush=True)
    
except Exception as e:
    error_msg = f"Failed to load model: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    log_error(f"Model loading traceback: {traceback.format_exc()}")
    sys.exit(1)

# Statistics
chunks_processed = 0
total_bytes_received = 0
successful_recognitions = 0

log_debug("Starting audio processing loop...")

try:
    while True:
        try:
            # ✅ FIX 3: Better error handling for reading length
            length_bytes = sys.stdin.buffer.read(4)
            
            if not length_bytes or len(length_bytes) == 0:
                log_debug("EOF received, shutting down gracefully")
                break
                
            if len(length_bytes) < 4:
                log_error(f"Incomplete length header: got {len(length_bytes)} bytes, expected 4")
                continue
            
            # ✅ FIX 4: Use little-endian format to match JavaScript
            # Your code used 'I' which can be big or little endian
            # JavaScript uses little-endian, so we should too
            try:
                length = struct.unpack('<I', length_bytes)[0]  # < forces little-endian
            except struct.error as e:
                log_error(f"Failed to unpack length: {e}")
                continue
            
            # ✅ FIX 5: Add sanity check for length
            if length <= 0 or length > 1000000:  # Max 1MB per chunk
                log_error(f"Invalid chunk length: {length} bytes")
                continue
            
            log_debug(f"Expecting {length} bytes of audio data")
            
            # Read audio data
            audio_data = sys.stdin.buffer.read(length)
            
            if not audio_data:
                log_error("No audio data received after length header")
                break
                
            actual_length = len(audio_data)
            if actual_length != length:
                log_error(f"Length mismatch: expected {length}, got {actual_length}")
                continue
            
            chunks_processed += 1
            total_bytes_received += actual_length
            
            # ✅ FIX 6: More detailed debugging for first few chunks
            if chunks_processed <= 3:
                log_debug(f"Chunk #{chunks_processed}: {actual_length} bytes")
                
                # Check if audio data looks reasonable
                if len(audio_data) >= 20:
                    first_bytes = audio_data[:20]
                    # Convert to signed 16-bit integers to check audio levels
                    samples = struct.unpack('<10h', first_bytes)  # 10 samples of 16-bit
                    max_sample = max(abs(s) for s in samples)
                    log_debug(f"First 10 samples max amplitude: {max_sample}/32767")
                    
                    if max_sample == 0:
                        log_debug("WARNING: Audio appears to be silent!")
                    elif max_sample < 100:
                        log_debug("WARNING: Audio level very low!")
            
            # ✅ FIX 7: Process with better error handling
            try:
                # Process the audio chunk
                if rec.AcceptWaveform(audio_data):
                    # We got a final result
                    result_json = rec.Result()
                    result = json.loads(result_json)
                    
                    text = result.get('text', '').strip()
                    if text:
                        output = {
                            "type": "final", 
                            "text": text,
                            "confidence": result.get('conf', 0.0)
                        }
                        print(json.dumps(output), flush=True)
                        successful_recognitions += 1
                        log_debug(f"FINAL result #{successful_recognitions}: '{text}'")
                    else:
                        log_debug(f"Final result was empty for chunk #{chunks_processed}")
                        
                else:
                    # Get partial result
                    partial_json = rec.PartialResult()
                    partial = json.loads(partial_json)
                    
                    partial_text = partial.get('partial', '').strip()
                    if partial_text:
                        output = {
                            "type": "partial", 
                            "text": partial_text
                        }
                        print(json.dumps(output), flush=True)
                        
                        # Only log every 10th partial to avoid spam
                        if chunks_processed % 10 == 0:
                            log_debug(f"Partial result #{chunks_processed}: '{partial_text[:50]}{'...' if len(partial_text) > 50 else ''}'")
                    else:
                        # Log silent processing occasionally
                        if chunks_processed % 50 == 0:
                            log_debug(f"Chunk #{chunks_processed} processed silently (no recognition)")
                
            except json.JSONDecodeError as e:
                log_error(f"JSON decode error in chunk #{chunks_processed}: {e}")
                continue
            except Exception as vosk_error:
                log_error(f"Vosk processing error in chunk #{chunks_processed}: {vosk_error}")
                log_error(f"Vosk error traceback: {traceback.format_exc()}")
                continue
                
        except KeyboardInterrupt:
            log_debug("Keyboard interrupt received")
            break
        except EOFError:
            log_debug("EOF on stdin")
            break
        except Exception as e:
            log_error(f"Unexpected error in main loop: {e}")
            log_error(f"Traceback: {traceback.format_exc()}")
            continue

except Exception as fatal_error:
    log_error(f"Fatal error in main processing: {fatal_error}")
    log_error(f"Fatal traceback: {traceback.format_exc()}")

# ✅ FIX 8: Get final result properly
try:
    final_json = rec.FinalResult()
    if final_json:
        final = json.loads(final_json)
        final_text = final.get('text', '').strip()
        if final_text:
            output = {
                "type": "final", 
                "text": final_text
            }
            print(json.dumps(output), flush=True)
            log_debug(f"Final result on shutdown: '{final_text}'")
except Exception as e:
    log_error(f"Error getting final result: {e}")

# ✅ FIX 9: Better final statistics
log_debug(f"Session complete:")
log_debug(f"  - Chunks processed: {chunks_processed}")
log_debug(f"  - Total bytes: {total_bytes_received}")
log_debug(f"  - Successful recognitions: {successful_recognitions}")
log_debug(f"  - Recognition rate: {(successful_recognitions/max(chunks_processed,1))*100:.1f}%")

logging.info(f"Session ended: {chunks_processed} chunks, {total_bytes_received} bytes, {successful_recognitions} recognitions")