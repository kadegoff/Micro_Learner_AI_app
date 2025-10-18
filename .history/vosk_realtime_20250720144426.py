#!/usr/bin/env python3
"""
FIXED vosk_realtime.py - Solves backpressure and write failures
Replace your current vosk_realtime.py with this version
"""

import sys
import json
import struct
import os
import logging
import traceback
import threading
import queue
import time

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

# ✅ WINDOWS FIX: Platform-specific input reading
def read_with_timeout(stream, size, timeout=1.0):
    """Read from stream with timeout - Windows compatible"""
    import time
    import platform
    
    start_time = time.time()
    data = b''
    
    # Windows doesn't support select on pipes, use simple timeout approach
    if platform.system() == 'Windows':
        try:
            # On Windows, just read in small chunks with tiny delays
            while len(data) < size and (time.time() - start_time) < timeout:
                try:
                    remaining = size - len(data)
                    chunk_size = min(remaining, 1024)
                    chunk = stream.read(chunk_size)
                    if not chunk:
                        break
                    data += chunk
                    if len(data) >= size:
                        break
                except:
                    break
                time.sleep(0.001)  # 1ms delay to prevent busy waiting
        except Exception as e:
            log_error(f"Windows read error: {e}")
    else:
        # Unix/Linux - use select
        import select
        while len(data) < size and (time.time() - start_time) < timeout:
            try:
                ready, _, _ = select.select([stream], [], [], 0.1)
                if ready:
                    chunk = stream.read(min(size - len(data), 1024))
                    if not chunk:
                        break
                    data += chunk
                else:
                    time.sleep(0.01)
            except Exception as e:
                log_error(f"Unix read error: {e}")
                break
    
    return data

# ✅ VERSION-COMPATIBLE IMPORT
try:
    import vosk
    log_debug(f"Vosk module imported. Version info: {dir(vosk)}")
    
    if hasattr(vosk, '__version__'):
        log_debug(f"Vosk version: {vosk.__version__}")
    
    try:
        from vosk import Model, Recognizer, SetLogLevel
        recognizer_class = Recognizer
        log_debug("Using NEW Vosk API (Recognizer)")
    except ImportError:
        try:
            from vosk import Model, KaldiRecognizer, SetLogLevel
            recognizer_class = KaldiRecognizer
            log_debug("Using OLD Vosk API (KaldiRecognizer)")
        except ImportError as e:
            log_error(f"Could not import any recognizer class: {e}")
            raise

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

if not os.path.exists(model_path):
    error_msg = f"Model not found at: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

try:
    model = Model(model_path)
    log_debug("Model loaded successfully")
    
    if recognizer_class.__name__ == 'KaldiRecognizer':
        rec = recognizer_class(model, 16000)
        log_debug("Created KaldiRecognizer (old API)")
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
        rec = recognizer_class(model, 16000)
        log_debug("Created Recognizer (new API)")
    
    log_debug("Vosk recognizer initialized successfully")
    print("VOSK_READY", flush=True)
    
except Exception as e:
    error_msg = f"Failed to initialize Vosk: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    log_error(f"Initialization traceback: {traceback.format_exc()}")
    sys.exit(1)

# ✅ CRITICAL FIX: Add audio processing queue and separate thread
audio_queue = queue.Queue(maxsize=100)  # Limit queue size to prevent memory issues
processing_active = True

def audio_processor():
    """Separate thread for processing audio to prevent backpressure"""
    global processing_active
    
    chunks_processed = 0
    successful_recognitions = 0
    
    log_debug("Audio processor thread started")
    
    while processing_active:
        try:
            # Get audio data from queue with timeout
            audio_data = audio_queue.get(timeout=1.0)
            
            if audio_data is None:  # Shutdown signal
                break
                
            chunks_processed += 1
            
            # Debug first few chunks
            if chunks_processed <= 5:
                log_debug(f"Processing queued chunk #{chunks_processed}: {len(audio_data)} bytes")
            
            # Process with Vosk
            try:
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
                        
                        if chunks_processed % 20 == 0:
                            log_debug(f"📝 Partial #{chunks_processed}: '{partial_text[:30]}{'...' if len(partial_text) > 30 else ''}'")
                            
            except json.JSONDecodeError as e:
                log_error(f"JSON decode error in processor: {e}")
                continue
            except Exception as vosk_error:
                log_error(f"Vosk processing error in processor: {vosk_error}")
                continue
                
            # Mark task as done
            audio_queue.task_done()
            
            # Periodic status log
            if chunks_processed % 100 == 0:
                log_debug(f"Processor status: {chunks_processed} chunks, {successful_recognitions} recognitions, queue size: {audio_queue.qsize()}")
                
        except queue.Empty:
            continue  # Timeout, continue loop
        except Exception as e:
            log_error(f"Audio processor error: {e}")
            continue
    
    log_debug(f"Audio processor thread ending. Final stats: {chunks_processed} chunks, {successful_recognitions} recognitions")

# ✅ Start audio processor thread
processor_thread = threading.Thread(target=audio_processor, daemon=True)
processor_thread.start()
log_debug("Audio processor thread started")

# ✅ MAIN LOOP WITH IMPROVED ERROR HANDLING AND NON-BLOCKING READS
chunks_received = 0
total_bytes_received = 0
queue_full_count = 0

log_debug("Starting main audio reading loop...")

try:
    while True:
        try:
            # ✅ CRITICAL: Read with timeout to prevent blocking
            length_bytes = read_with_timeout(sys.stdin.buffer, 4, timeout=2.0)
            
            if not length_bytes or len(length_bytes) == 0:
                log_debug("EOF received, shutting down gracefully")
                break
                
            if len(length_bytes) < 4:
                log_error(f"Incomplete length header: got {len(length_bytes)} bytes")
                continue
            
            try:
                length = struct.unpack('<I', length_bytes)[0]
            except struct.error as e:
                log_error(f"Failed to unpack length: {e}")
                continue
            
            if length <= 0 or length > 1000000:  # Max 1MB
                log_error(f"Invalid chunk length: {length} bytes")
                continue
            
            # ✅ CRITICAL: Read audio data with timeout
            audio_data = read_with_timeout(sys.stdin.buffer, length, timeout=5.0)
            
            if not audio_data:
                log_error("No audio data received")
                break
                
            actual_length = len(audio_data)
            if actual_length != length:
                log_error(f"Length mismatch: expected {length}, got {actual_length}")
                continue
            
            chunks_received += 1
            total_bytes_received += actual_length
            
            # ✅ CRITICAL: Add to queue NON-BLOCKING
            try:
                audio_queue.put_nowait(audio_data)
                
                # Log progress for first few chunks and periodically
                if chunks_received <= 5 or chunks_received % 50 == 0:
                    log_debug(f"✅ Queued chunk #{chunks_received}: {actual_length} bytes, queue size: {audio_queue.qsize()}")
                    
            except queue.Full:
                queue_full_count += 1
                if queue_full_count % 10 == 1:  # Log every 10th queue full event
                    log_error(f"❌ Audio queue full! Dropped chunk #{chunks_received}. Total drops: {queue_full_count}")
                # Continue processing - don't block on full queue
                
        except KeyboardInterrupt:
            log_debug("Keyboard interrupt")
            break
        except EOFError:
            log_debug("EOF on stdin")
            break
        except Exception as e:
            log_error(f"Main loop error: {e}")
            continue

except Exception as fatal_error:
    log_error(f"Fatal error in main loop: {fatal_error}")
    log_error(f"Traceback: {traceback.format_exc()}")

# ✅ GRACEFUL SHUTDOWN
log_debug("Starting graceful shutdown...")

# Stop processor thread
processing_active = False
audio_queue.put(None)  # Shutdown signal

# Wait for processor to finish current work
try:
    processor_thread.join(timeout=2.0)
    log_debug("Processor thread joined successfully")
except:
    log_debug("Processor thread join timeout")

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
log_debug(f"🏁 Session complete:")
log_debug(f"   📊 Chunks received: {chunks_received}")
log_debug(f"   📊 Bytes received: {total_bytes_received}")
log_debug(f"   📊 Queue drops: {queue_full_count}")
log_debug(f"   📊 Final queue size: {audio_queue.qsize()}")

logging.info(f"Session ended: {chunks_received} chunks, {total_bytes_received} bytes, {queue_full_count} drops")