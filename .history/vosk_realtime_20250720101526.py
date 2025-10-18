#!/usr/bin/env python3
"""
Version-Compatible vosk_realtime.py
Works with both old and new Vosk versions
Save this as vosk_realtime.py (replace your current one)
"""

import sys
import json
import struct
import os
import logging
import traceback

# Set up logging
logging.basicConfig(
    filename='vosk_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def log_debug(message):
    print(f"DEBUG: {message}", file=sys.stderr, flush=True)
    logging.debug(message)

def log_error(message):
    print(f"ERROR: {message}", file=sys.stderr, flush=True)
    logging.error(message)

# ✅ VERSION-COMPATIBLE IMPORT - tries both old and new Vosk versions
try:
    import vosk
    log_debug(f"Vosk module imported. Version info: {dir(vosk)}")
    
    # Try to get version if available
    if hasattr(vosk, '__version__'):
        log_debug(f"Vosk version: {vosk.__version__}")
    
    # Try new-style import first (Vosk 0.3.15+)
    try:
        from vosk import Model, Recognizer, SetLogLevel
        recognizer_class = Recognizer
        log_debug("Using NEW Vosk API (Recognizer)")
    except ImportError:
        # Fall back to old-style import (Vosk < 0.3.15)
        try:
            from vosk import Model, KaldiRecognizer, SetLogLevel
            recognizer_class = KaldiRecognizer
            log_debug("Using OLD Vosk API (KaldiRecognizer)")
        except ImportError as e:
            log_error(f"Could not import any recognizer class: {e}")
            raise

    # Reduce Vosk logging noise
    try:
        SetLogLevel(-1)
    except:
        log_debug("SetLogLevel not available")
        
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
    log_debug("Model loaded successfully")
    
    # ✅ VERSION-COMPATIBLE RECOGNIZER CREATION
    if recognizer_class.__name__ == 'KaldiRecognizer':
        # Old Vosk API
        rec = recognizer_class(model, 16000)
        log_debug("Created KaldiRecognizer (old API)")
        
        # Try to set old API options if available
        try:
            rec.SetWords(True)
            log_debug("SetWords(True) successful")
        except:
            log_debug("SetWords not available")
            
        try:
            rec.SetPartialWords(True)
            log_debug("SetPartialWords(True) successful")
        except:
            log_debug("SetPartialWords not available")
            
    else:
        # New Vosk API
        rec = recognizer_class(model, 16000)
        log_debug("Created Recognizer (new API)")
    
    log_debug("Vosk recognizer initialized successfully")
    
    # Signal that we're ready
    print("VOSK_READY", flush=True)
    
except Exception as e:
    error_msg = f"Failed to initialize Vosk: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    log_error(f"Initialization traceback: {traceback.format_exc()}")
    sys.exit(1)

# Statistics
chunks_processed = 0
total_bytes_received = 0
successful_recognitions = 0

log_debug("Starting audio processing loop...")

try:
    while True:
        try:
            # Read length header (4 bytes)
            length_bytes = sys.stdin.buffer.read(4)
            
            if not length_bytes or len(length_bytes) == 0:
                log_debug("EOF received, shutting down gracefully")
                break
                
            if len(length_bytes) < 4:
                log_error(f"Incomplete length header: got {len(length_bytes)} bytes")
                continue
            
            # Use little-endian format to match JavaScript
            try:
                length = struct.unpack('<I', length_bytes)[0]
            except struct.error as e:
                log_error(f"Failed to unpack length: {e}")
                continue
            
            # Sanity check
            if length <= 0 or length > 1000000:  # Max 1MB
                log_error(f"Invalid chunk length: {length} bytes")
                continue
            
            # Read audio data
            audio_data = sys.stdin.buffer.read(length)
            
            if not audio_data:
                log_error("No audio data received")
                break
                
            actual_length = len(audio_data)
            if actual_length != length:
                log_error(f"Length mismatch: expected {length}, got {actual_length}")
                continue
            
            chunks_processed += 1
            total_bytes_received += actual_length
            
            # Debug first few chunks
            if chunks_processed <= 3:
                log_debug(f"Processing chunk #{chunks_processed}: {actual_length} bytes")
                
                # Check audio level
                if len(audio_data) >= 20:
                    try:
                        samples = struct.unpack('<10h', audio_data[:20])
                        max_sample = max(abs(s) for s in samples)
                        log_debug(f"Audio level check: max amplitude = {max_sample}/32767")
                        
                        if max_sample == 0:
                            log_debug("⚠️  SILENT AUDIO detected!")
                        elif max_sample < 100:
                            log_debug("⚠️  Very low audio level")
                        else:
                            log_debug("✅ Good audio level detected")
                    except:
                        log_debug("Could not analyze audio samples")
            
            # ✅ VERSION-COMPATIBLE PROCESSING
            try:
                # Process the audio chunk
                if rec.AcceptWaveform(audio_data):
                    # Final result
                    result_json = rec.Result()
                    result = json.loads(result_json)
                    
                    text = result.get('text', '').strip()
                    if text:
                        output = {
                            "type": "final", 
                            "text": text,
                            "confidence": result.get('conf', result.get('confidence', 0.0))
                        }
                        print(json.dumps(output), flush=True)
                        successful_recognitions += 1
                        log_debug(f"✅ FINAL result #{successful_recognitions}: '{text}'")
                    else:
                        if chunks_processed % 20 == 0:  # Log occasionally
                            log_debug(f"Empty final result for chunk #{chunks_processed}")
                        
                else:
                    # Partial result
                    partial_json = rec.PartialResult()
                    partial = json.loads(partial_json)
                    
                    partial_text = partial.get('partial', '').strip()
                    if partial_text:
                        output = {
                            "type": "partial", 
                            "text": partial_text
                        }
                        print(json.dumps(output), flush=True)
                        
                        # Log occasionally to avoid spam
                        if chunks_processed % 10 == 0:
                            log_debug(f"📝 Partial #{chunks_processed}: '{partial_text[:30]}{'...' if len(partial_text) > 30 else ''}'")
                    else:
                        # Log processing status occasionally
                        if chunks_processed % 50 == 0:
                            log_debug(f"Processed {chunks_processed} chunks, no current recognition")
                
            except json.JSONDecodeError as e:
                log_error(f"JSON decode error: {e}")
                continue
            except Exception as vosk_error:
                log_error(f"Vosk processing error: {vosk_error}")
                continue
                
        except KeyboardInterrupt:
            log_debug("Keyboard interrupt")
            break
        except EOFError:
            log_debug("EOF on stdin")
            break
        except Exception as e:
            log_error(f"Loop error: {e}")
            continue

except Exception as fatal_error:
    log_error(f"Fatal error: {fatal_error}")
    log_error(f"Traceback: {traceback.format_exc()}")

# Get final result
try:
    final_json = rec.FinalResult()
    if final_json:
        final = json.loads(final_json)
        final_text = final.get('text', '').strip()
        if final_text:
            output = {"type": "final", "text": final_text}
            print(json.dumps(output), flush=True)
            log_debug(f"Final shutdown result: '{final_text}'")
except Exception as e:
    log_error(f"Error getting final result: {e}")

# Final statistics
success_rate = (successful_recognitions / max(chunks_processed, 1)) * 100
log_debug(f"🏁 Session complete:")
log_debug(f"   📊 Chunks: {chunks_processed}")
log_debug(f"   📊 Bytes: {total_bytes_received}")
log_debug(f"   📊 Recognitions: {successful_recognitions}")
log_debug(f"   📊 Success rate: {success_rate:.1f}%")

logging.info(f"Session ended: {chunks_processed} chunks, {total_bytes_received} bytes, {successful_recognitions} recognitions")