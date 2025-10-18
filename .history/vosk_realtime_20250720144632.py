#!/usr/bin/env python3
"""
Universal vosk_realtime.py - Works on Windows, macOS, and Linux
Cross-platform compatible with smart platform detection
Replace your vosk_realtime.py with this single file
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
import platform

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

# ✅ UNIVERSAL: Platform-specific input reading
def read_with_timeout(stream, size, timeout=1.0):
    """Read from stream with timeout - works on all platforms"""
    import time
    current_platform = platform.system()
    
    start_time = time.time()
    data = b''
    
    if current_platform == 'Windows':
        # Windows: Use simple blocking reads with small chunks
        try:
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
                except Exception as e:
                    log_error(f"Windows read error: {e}")
                    break
                time.sleep(0.001)  # 1ms delay to prevent busy waiting
        except Exception as e:
            log_error(f"Windows read outer error: {e}")
            
    else:
        # Unix/Linux/macOS: Use select for non-blocking reads
        try:
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
        except ImportError:
            log_error("select not available, falling back to blocking reads")
            # Fallback to simple blocking read
            try:
                data = stream.read(size)
            except Exception as e:
                log_error(f"Fallback read error: {e}")
    
    return data

def read_audio_data_simple(stream, size):
    """Simple blocking read for Windows - most reliable"""
    try:
        data = stream.read(size)
        if len(data) != size:
            log_error(f"Expected {size} bytes, got {len(data)}")
            return None
        return data
    except Exception as e:
        log_error(f"Simple read error: {e}")
        return None

# ✅ VERSION-COMPATIBLE VOSK IMPORT
try:
    import vosk
    log_debug(f"Vosk module imported on {platform.system()}")
    
    if hasattr(vosk, '__version__'):
        log_debug(f"Vosk version: {vosk.__version__}")
    
    # Try new API first, fall back to old API
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

# Validate arguments
if len(sys.argv) < 2:
    error_msg = "Model path not provided"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

model_path = sys.argv[1]
log_debug(f"Loading model from {model_path} on {platform.system()}")

if not os.path.exists(model_path):
    error_msg = f"Model not found at: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

# Initialize Vosk model and recognizer
try:
    model = Model(model_path)
    log_debug("Model loaded successfully")
    
    # ✅ VERSION-COMPATIBLE RECOGNIZER CREATION
    if recognizer_class.__name__ == 'KaldiRecognizer':
        # Old Vosk API
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
        # New Vosk API
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

# ✅ PLATFORM-ADAPTIVE: Audio processing queue
current_platform = platform.system()
if current_platform == 'Windows':
    # Windows: Smaller queue, more conservative
    audio_queue = queue.Queue(maxsize=30)
    read_timeout = 2.0
    queue_timeout = 0.5
else:
    # Unix/Linux/macOS: Larger queue, more aggressive
    audio_queue = queue.Queue(maxsize=100)
    read_timeout = 1.0
    queue_timeout = 1.0

processing_active = True

def audio_processor():
    """Process audio from queue - platform adaptive"""
    global processing_active
    
    chunks_processed = 0
    successful_recognitions = 0
    
    log_debug(f"Audio processor thread started ({current_platform} mode)")
    
    while processing_active:
        try:
            # Get audio data from queue with platform-specific timeout
            try:
                audio_data = audio_queue.get(timeout=queue_timeout)
            except queue.Empty:
                continue
                
            if audio_data is None:  # Shutdown signal
                break
                
            chunks_processed += 1
            
            # Debug first few chunks
            if chunks_processed <= 5:
                log_debug(f"Processing chunk #{chunks_processed}: {len(audio_data)} bytes")
                
                # Platform-specific audio level check
                if len(audio_data) >= 20:
                    try:
                        samples = struct.unpack('<10h', audio_data[:20])
                        max_sample = max(abs(s) for s in samples)
                        log_debug(f"Audio level: max amplitude = {max_sample}/32767")
                        
                        if max_sample == 0:
                            log_debug("⚠️ SILENT AUDIO detected!")
                        elif max_sample < 100:
                            log_debug("⚠️ Very low audio level")
                        else:
                            log_debug("✅ Good audio level")
                    except:
                        log_debug("Could not analyze audio samples")
            
            # ✅ VOSK PROCESSING
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
                        # Log empty final results occasionally
                        if chunks_processed % 50 == 0:
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
                        
                        # Log partial results occasionally to avoid spam
                        if chunks_processed % 25 == 0:
                            log_debug(f"📝 Partial #{chunks_processed}: '{partial_text[:30]}{'...' if len(partial_text) > 30 else ''}'")
                    else:
                        # Log processing status occasionally
                        if chunks_processed % 100 == 0:
                            log_debug(f"Processed {chunks_processed} chunks, no current recognition")
                
            except json.JSONDecodeError as e:
                log_error(f"JSON decode error in processor: {e}")
                continue
            except Exception as vosk_error:
                log_error(f"Vosk processing error in processor: {vosk_error}")
                continue
                
            # Mark task as done
            audio_queue.task_done()
            
            # Platform-specific status reporting
            status_interval = 50 if current_platform == 'Windows' else 100
            if chunks_processed % status_interval == 0:
                log_debug(f"Processor status: {chunks_processed} chunks, {successful_recognitions} recognitions, queue size: {audio_queue.qsize()}")
                
        except Exception as e:
            log_error(f"Audio processor error: {e}")
            continue
    
    log_debug(f"Audio processor thread ending. Final stats: {chunks_processed} chunks, {successful_recognitions} recognitions")

# ✅ START PROCESSOR THREAD
processor_thread = threading.Thread(target=audio_processor, daemon=True)
processor_thread.start()
log_debug(f"Audio processor thread started for {current_platform}")

# ✅ PLATFORM-ADAPTIVE MAIN LOOP
chunks_received = 0
total_bytes_received = 0
queue_full_count = 0

log_debug(f"Starting main audio reading loop on {current_platform}")

try:
    while True:
        try:
            if current_platform == 'Windows':
                # ✅ WINDOWS: Simple blocking approach
                # Read length header (4 bytes)
                length_bytes = sys.stdin.buffer.read(4)
                
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
                
                # Sanity check with Windows-specific limits
                if length <= 0 or length > 500000:  # 500KB max for Windows
                    log_error(f"Invalid chunk length: {length} bytes")
                    continue
                
                # Read audio data - simple blocking
                audio_data = read_audio_data_simple(sys.stdin.buffer, length)
                
                if not audio_data:
                    log_error("Failed to read audio data")
                    continue
                    
            else:
                # ✅ UNIX/LINUX/MACOS: Timeout-based approach
                # Read length header with timeout
                length_bytes = read_with_timeout(sys.stdin.buffer, 4, timeout=read_timeout)
                
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
                
                # Sanity check
                if length <= 0 or length > 1000000:  # 1MB max for Unix
                    log_error(f"Invalid chunk length: {length} bytes")
                    continue
                
                # Read audio data with timeout
                audio_data = read_with_timeout(sys.stdin.buffer, length, timeout=read_timeout * 2)
                
                if not audio_data:
                    log_error("No audio data received")
                    break
                    
                actual_length = len(audio_data)
                if actual_length != length:
                    log_error(f"Length mismatch: expected {length}, got {actual_length}")
                    continue
            
            chunks_received += 1
            total_bytes_received += len(audio_data)
            
            # ✅ PLATFORM-ADAPTIVE QUEUING
            try:
                audio_queue.put_nowait(audio_data)
                
                # Platform-specific logging frequency
                log_frequency = 25 if current_platform == 'Windows' else 50
                if chunks_received <= 5 or chunks_received % log_frequency == 0:
                    log_debug(f"✅ Queued chunk #{chunks_received}: {len(audio_data)} bytes, queue size: {audio_queue.qsize()}")
                    
            except queue.Full:
                queue_full_count += 1
                drop_log_frequency = 5 if current_platform == 'Windows' else 10
                if queue_full_count % drop_log_frequency == 1:
                    log_error(f"❌ Audio queue full! Dropped chunk #{chunks_received}. Total drops: {queue_full_count}")
                
        except KeyboardInterrupt:
            log_debug("Keyboard interrupt")
            break
        except EOFError:
            log_debug("EOF on stdin")
            break
        except Exception as e:
            log_error(f"Main loop error: {e}")
            
            # Platform-specific error handling
            if current_platform == 'Windows':
                # On Windows, certain pipe errors are fatal
                if "WinError" in str(e) or "socket" in str(e).lower():
                    log_error("Windows pipe error detected, stopping main loop")
                    break
            else:
                # On Unix, try to continue on most errors
                continue

except Exception as fatal_error:
    log_error(f"Fatal error in main loop: {fatal_error}")
    log_error(f"Traceback: {traceback.format_exc()}")

# ✅ GRACEFUL SHUTDOWN
log_debug("Starting graceful shutdown...")

# Stop processor thread
processing_active = False
try:
    audio_queue.put_nowait(None)  # Shutdown signal
except:
    pass

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
success_rate = (chunks_received / max(chunks_received, 1)) * 100 if chunks_received > 0 else 0
log_debug(f"🏁 Session complete on {current_platform}:")
log_debug(f"   📊 Platform: {current_platform}")
log_debug(f"   📊 Chunks received: {chunks_received}")
log_debug(f"   📊 Bytes received: {total_bytes_received}")
log_debug(f"   📊 Queue drops: {queue_full_count}")
log_debug(f"   📊 Final queue size: {audio_queue.qsize()}")

logging.info(f"Session ended on {current_platform}: {chunks_received} chunks, {total_bytes_received} bytes, {queue_full_count} drops")