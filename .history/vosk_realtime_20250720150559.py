#!/usr/bin/env python3
"""
COMPLETELY FIXED vosk_realtime.py - Handles audio data correctly
This version properly validates and processes Int16 PCM audio data from JavaScript
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

# Enhanced logging setup
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

def log_info(message):
    print(f"INFO: {message}", file=sys.stderr, flush=True)
    logging.info(message)

# ✅ ENHANCED: Audio data validation
def validate_audio_data(data, expected_length):
    """Validate that audio data is in the correct Int16 PCM format"""
    if not data:
        return False, "No data received"
    
    if len(data) != expected_length:
        return False, f"Length mismatch: expected {expected_length}, got {len(data)}"
    
    # Check if data length is appropriate for 16-bit samples
    if len(data) % 2 != 0:
        return False, f"Odd number of bytes ({len(data)}) - not valid for 16-bit samples"
    
    # Basic sanity checks
    if len(data) < 20:  # At least 10 samples (20 bytes)
        return False, f"Data too short: {len(data)} bytes"
    
    if len(data) > 2000000:  # 2MB max (very generous)
        return False, f"Data too large: {len(data)} bytes"
    
    # Try to validate the first few samples are reasonable
    try:
        sample_count = min(10, len(data) // 2)
        samples = struct.unpack(f'<{sample_count}h', data[:sample_count * 2])
        
        # Check if samples are within reasonable 16-bit range
        max_sample = max(abs(s) for s in samples)
        if max_sample > 32767:
            return False, f"Sample out of range: {max_sample} > 32767"
            
        return True, f"Valid Int16 PCM: {len(data)} bytes, {len(data)//2} samples"
        
    except struct.error as e:
        return False, f"Invalid 16-bit PCM format: {e}"

# ✅ ENHANCED: Platform-specific reading with better error handling
def read_with_timeout(stream, size, timeout=3.0):
    """Read from stream with timeout and enhanced error handling"""
    current_platform = platform.system()
    start_time = time.time()
    data = b''
    
    try:
        if current_platform == 'Windows':
            # Windows: Use simple blocking reads with chunking
            while len(data) < size and (time.time() - start_time) < timeout:
                try:
                    remaining = size - len(data)
                    chunk_size = min(remaining, 8192)  # 8KB chunks
                    chunk = stream.read(chunk_size)
                    if not chunk:
                        log_debug(f"Windows: No more data available after {len(data)} bytes")
                        break
                    data += chunk
                    
                    # Brief pause to prevent CPU spinning
                    if len(data) < size:
                        time.sleep(0.001)
                        
                except Exception as e:
                    log_error(f"Windows read error after {len(data)} bytes: {e}")
                    break
                    
        else:
            # Unix/Linux/macOS: Use select for non-blocking reads
            try:
                import select
                while len(data) < size and (time.time() - start_time) < timeout:
                    ready, _, _ = select.select([stream], [], [], 0.1)
                    if ready:
                        remaining = size - len(data)
                        chunk = stream.read(min(remaining, 8192))
                        if not chunk:
                            log_debug(f"Unix: No more data available after {len(data)} bytes")
                            break
                        data += chunk
                    else:
                        time.sleep(0.01)  # Brief pause when no data ready
                        
            except ImportError:
                log_debug("select not available, using blocking read")
                try:
                    data = stream.read(size)
                except Exception as e:
                    log_error(f"Blocking read error: {e}")
                    return b''
            except Exception as e:
                log_error(f"Unix read error: {e}")
                return b''
    
    except Exception as e:
        log_error(f"Unexpected read error: {e}")
        return b''
    
    if len(data) != size:
        log_debug(f"Read {len(data)} of {size} bytes requested (timeout: {timeout:.1f}s)")
    
    return data

# ✅ VOSK SETUP with comprehensive error handling
try:
    import vosk
    log_info(f"Vosk module imported successfully on {platform.system()}")
    
    if hasattr(vosk, '__version__'):
        log_info(f"Vosk version: {vosk.__version__}")
    
    # Try new API first, fall back to old API
    try:
        from vosk import Model, Recognizer, SetLogLevel
        recognizer_class = Recognizer
        log_info("Using NEW Vosk API (Recognizer)")
    except ImportError:
        try:
            from vosk import Model, KaldiRecognizer, SetLogLevel
            recognizer_class = KaldiRecognizer
            log_info("Using OLD Vosk API (KaldiRecognizer)")
        except ImportError as e:
            log_error(f"Could not import any recognizer class: {e}")
            raise

    # Reduce Vosk logging noise
    try:
        SetLogLevel(-1)
        log_debug("Vosk logging level set to quiet")
    except:
        log_debug("SetLogLevel not available")
        
    log_info("Vosk imported and configured successfully")
    
except ImportError as e:
    error_msg = f"Failed to import vosk: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

# ✅ ENHANCED: Argument validation
if len(sys.argv) < 2:
    error_msg = "Usage: python vosk_realtime.py <model_path>"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

model_path = sys.argv[1]
log_info(f"Loading Vosk model from: {model_path}")

if not os.path.exists(model_path):
    error_msg = f"Model directory not found: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

if not os.path.isdir(model_path):
    error_msg = f"Model path is not a directory: {model_path}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    sys.exit(1)

# ✅ ENHANCED: Model and recognizer initialization
try:
    log_info("Loading Vosk model...")
    model = Model(model_path)
    log_info("Model loaded successfully")
    
    # Create recognizer with proper configuration
    if recognizer_class.__name__ == 'KaldiRecognizer':
        # Old Vosk API
        rec = recognizer_class(model, 16000)
        log_info("Created KaldiRecognizer (old API) with 16kHz sample rate")
        
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
        log_info("Created Recognizer (new API) with 16kHz sample rate")
    
    log_info("Vosk recognizer initialized and configured successfully")
    print("VOSK_READY", flush=True)
    
except Exception as e:
    error_msg = f"Failed to initialize Vosk: {str(e)}"
    print(json.dumps({"type": "error", "error": error_msg}), flush=True)
    logging.error(error_msg)
    log_error(f"Initialization traceback: {traceback.format_exc()}")
    sys.exit(1)

# ✅ ENHANCED: Audio processing with statistics tracking
current_platform = platform.system()
audio_queue = queue.Queue(maxsize=50)  # Reasonable queue size for all platforms
processing_active = True

# Enhanced statistics tracking
stats = {
    'chunks_received': 0,
    'chunks_processed': 0,
    'chunks_dropped': 0,
    'bytes_received': 0,
    'successful_recognitions': 0,
    'partial_results': 0,
    'validation_errors': 0,
    'processing_errors': 0,
    'empty_results': 0
}

def audio_processor():
    """Enhanced audio processor with comprehensive error handling and validation"""
    global processing_active, stats
    
    log_info(f"Audio processor thread started ({current_platform} mode)")
    
    while processing_active:
        try:
            # Get audio data from queue
            try:
                audio_data = audio_queue.get(timeout=1.0)
            except queue.Empty:
                continue
                
            if audio_data is None:  # Shutdown signal
                log_debug("Received shutdown signal")
                break
                
            stats['chunks_processed'] += 1
            
            # ✅ CRITICAL: Validate audio data format
            is_valid, validation_msg = validate_audio_data(audio_data, len(audio_data))
            if not is_valid:
                log_error(f"Audio validation failed for chunk #{stats['chunks_processed']}: {validation_msg}")
                stats['validation_errors'] += 1
                audio_queue.task_done()
                continue
            
            # Enhanced debugging for first few chunks
            if stats['chunks_processed'] <= 10:
                log_debug(f"Processing chunk #{stats['chunks_processed']}: {validation_msg}")
                
                # Analyze audio content
                try:
                    sample_count = len(audio_data) // 2
                    samples = struct.unpack(f'<{min(sample_count, 10)}h', audio_data[:20])
                    max_sample = max(abs(s) for s in samples)
                    avg_sample = sum(abs(s) for s in samples) / len(samples)
                    
                    log_debug(f"Audio analysis: max={max_sample}/32767, avg={avg_sample:.1f}")
                    
                    if max_sample == 0:
                        log_debug("⚠️ SILENT AUDIO detected!")
                    elif max_sample < 100:
                        log_debug("⚠️ Very low audio level")
                    else:
                        log_debug("✅ Good audio level detected")
                        
                except Exception as e:
                    log_debug(f"Could not analyze audio samples: {e}")
            
            # ✅ VOSK PROCESSING with enhanced error handling
            try:
                if rec.AcceptWaveform(audio_data):
                    # Final result
                    result_json = rec.Result()
                    
                    try:
                        result = json.loads(result_json)
                    except json.JSONDecodeError as e:
                        log_error(f"JSON decode error in final result: {e}")
                        log_error(f"Raw result: {result_json}")
                        stats['processing_errors'] += 1
                        audio_queue.task_done()
                        continue
                    
                    text = result.get('text', '').strip()
                    if text:
                        output = {
                            "type": "final", 
                            "text": text,
                            "confidence": result.get('conf', result.get('confidence', 0.0))
                        }
                        print(json.dumps(output), flush=True)
                        stats['successful_recognitions'] += 1
                        log_info(f"✅ FINAL result #{stats['successful_recognitions']}: '{text}' (confidence: {output['confidence']:.3f})")
                    else:
                        stats['empty_results'] += 1
                        # Log empty final results occasionally
                        if stats['empty_results'] % 50 == 1:
                            log_debug(f"Empty final result #{stats['empty_results']} for chunk #{stats['chunks_processed']}")
                        
                else:
                    # Partial result
                    partial_json = rec.PartialResult()
                    
                    try:
                        partial = json.loads(partial_json)
                    except json.JSONDecodeError as e:
                        log_error(f"JSON decode error in partial result: {e}")
                        stats['processing_errors'] += 1
                        audio_queue.task_done()
                        continue
                    
                    partial_text = partial.get('partial', '').strip()
                    if partial_text:
                        output = {
                            "type": "partial", 
                            "text": partial_text
                        }
                        print(json.dumps(output), flush=True)
                        stats['partial_results'] += 1
                        
                        # Log partial results occasionally to avoid spam
                        if stats['partial_results'] % 25 == 1:
                            log_debug(f"📝 Partial #{stats['partial_results']}: '{partial_text[:50]}{'...' if len(partial_text) > 50 else ''}'")
                    else:
                        # Log processing status occasionally
                        if stats['chunks_processed'] % 100 == 0:
                            log_debug(f"Processed {stats['chunks_processed']} chunks, no current partial recognition")
                
            except Exception as vosk_error:
                log_error(f"Vosk processing error for chunk #{stats['chunks_processed']}: {vosk_error}")
                log_error(f"Vosk error traceback: {traceback.format_exc()}")
                stats['processing_errors'] += 1
                audio_queue.task_done()
                continue
                
            # Mark task as done
            audio_queue.task_done()
            
            # Periodic comprehensive status reporting
            if stats['chunks_processed'] % 100 == 0:
                log_info(f"📊 Processor status: {stats['chunks_processed']} processed, "
                        f"{stats['successful_recognitions']} final, "
                        f"{stats['partial_results']} partial, "
                        f"{stats['validation_errors']} validation errors, "
                        f"{stats['processing_errors']} processing errors, "
                        f"queue: {audio_queue.qsize()}")
                
        except Exception as e:
            log_error(f"Audio processor thread error: {e}")
            log_error(f"Processor error traceback: {traceback.format_exc()}")
            stats['processing_errors'] += 1
            try:
                audio_queue.task_done()
            except:
                pass
            continue
    
    log_info(f"Audio processor thread ending. Final stats: {json.dumps(stats, indent=2)}")

# ✅ START PROCESSOR THREAD
processor_thread = threading.Thread(target=audio_processor, daemon=True)
processor_thread.start()
log_info(f"Audio processor thread started for {current_platform}")

# ✅ ENHANCED: Main loop with comprehensive error handling
log_info(f"Starting main audio reading loop on {current_platform}")
log_info("Expecting Int16 PCM audio data from JavaScript")

try:
    while True:
        try:
            # ✅ UNIVERSAL: Read length header (4 bytes)
            length_bytes = read_with_timeout(sys.stdin.buffer, 4, timeout=3.0)
            
            if not length_bytes or len(length_bytes) == 0:
                log_info("EOF received, shutting down gracefully")
                break
                
            if len(length_bytes) < 4:
                log_error(f"Incomplete length header: got {len(length_bytes)} bytes")
                continue
            
            try:
                length = struct.unpack('<I', length_bytes)[0]
            except struct.error as e:
                log_error(f"Failed to unpack length header: {e}")
                log_error(f"Raw header bytes: {length_bytes.hex()}")
                continue
            
            # ✅ ENHANCED: Length validation with detailed reporting
            min_length = 20   # At least 10 Int16 samples
            max_length = 1000000  # 1MB max (500k samples)
            
            if length < min_length:
                log_error(f"Audio chunk too small: {length} bytes (minimum: {min_length})")
                continue
                
            if length > max_length:
                log_error(f"Audio chunk too large: {length} bytes (maximum: {max_length})")
                continue
            
            # ✅ UNIVERSAL: Read audio data
            audio_data = read_with_timeout(sys.stdin.buffer, length, timeout=5.0)
            
            if not audio_data:
                log_error("Failed to read audio data")
                continue
                
            actual_length = len(audio_data)
            if actual_length != length:
                log_error(f"Length mismatch: expected {length}, got {actual_length}")
                continue
            
            stats['chunks_received'] += 1
            stats['bytes_received'] += len(audio_data)
            
            # ✅ ENHANCED: Pre-queue validation
            is_valid, validation_msg = validate_audio_data(audio_data, length)
            if not is_valid:
                log_error(f"Pre-queue validation failed for chunk #{stats['chunks_received']}: {validation_msg}")
                stats['validation_errors'] += 1
                continue
            
            # ✅ ENHANCED: Queue management with detailed reporting
            try:
                audio_queue.put_nowait(audio_data)
                
                # Enhanced logging for first chunks and periodically
                if stats['chunks_received'] <= 10 or stats['chunks_received'] % 50 == 0:
                    sample_count = len(audio_data) // 2
                    log_info(f"✅ Queued chunk #{stats['chunks_received']}: {len(audio_data)} bytes, "
                            f"{sample_count} samples, queue size: {audio_queue.qsize()}")
                    
            except queue.Full:
                stats['chunks_dropped'] += 1
                if stats['chunks_dropped'] % 10 == 1:
                    log_error(f"❌ Audio queue full! Dropped chunk #{stats['chunks_received']}. "
                             f"Total drops: {stats['chunks_dropped']}")
                    log_error(f"Queue might be backing up - processor may be too slow")
                
        except KeyboardInterrupt:
            log_info("Keyboard interrupt received")
            break
        except EOFError:
            log_info("EOF on stdin")
            break
        except Exception as e:
            log_error(f"Main loop error: {e}")
            log_error(f"Main loop traceback: {traceback.format_exc()}")
            
            # Platform-specific error handling
            if current_platform == 'Windows':
                if "WinError" in str(e) or "socket" in str(e).lower():
                    log_error("Windows pipe error detected, stopping main loop")
                    break
            
            # Continue processing for most errors
            continue

except Exception as fatal_error:
    log_error(f"Fatal error in main loop: {fatal_error}")
    log_error(f"Fatal error traceback: {traceback.format_exc()}")

# ✅ ENHANCED: Graceful shutdown
log_info("Starting graceful shutdown...")

# Stop processor thread
processing_active = False
try:
    audio_queue.put_nowait(None)  # Shutdown signal
except:
    pass

# Wait for processor to finish current work
try:
    processor_thread.join(timeout=5.0)
    log_info("Processor thread joined successfully")
except:
    log_info("Processor thread join timeout")

# ✅ ENHANCED: Get final result
try:
    log_debug("Getting final result from recognizer...")
    final_json = rec.FinalResult()
    if final_json:
        try:
            final = json.loads(final_json)
            final_text = final.get('text', '').strip()
            if final_text:
                output = {"type": "final", "text": final_text}
                print(json.dumps(output), flush=True)
                log_info(f"Final shutdown result: '{final_text}'")
                stats['successful_recognitions'] += 1
        except json.JSONDecodeError as e:
            log_error(f"JSON decode error in final result: {e}")
except Exception as e:
    log_error(f"Error getting final result: {e}")

# ✅ ENHANCED: Comprehensive final statistics
log_info(f"🏁 Session complete on {current_platform}")
log_info(f"📊 Comprehensive Statistics:")
log_info(f"   📊 Platform: {current_platform}")
log_info(f"   📊 Chunks received: {stats['chunks_received']}")
log_info(f"   📊 Chunks processed: {stats['chunks_processed']}")
log_info(f"   📊 Chunks dropped: {stats['chunks_dropped']}")
log_info(f"   📊 Bytes received: {stats['bytes_received']:,}")
log_info(f"   📊 Final recognitions: {stats['successful_recognitions']}")
log_info(f"   📊 Partial results: {stats['partial_results']}")
log_info(f"   📊 Empty results: {stats['empty_results']}")
log_info(f"   📊 Validation errors: {stats['validation_errors']}")
log_info(f"   📊 Processing errors: {stats['processing_errors']}")
log_info(f"   📊 Final queue size: {audio_queue.qsize()}")

# Calculate success rates
if stats['chunks_received'] > 0:
    process_rate = (stats['chunks_processed'] / stats['chunks_received']) * 100
    log_info(f"   📊 Processing success rate: {process_rate:.1f}%")
    
if stats['chunks_processed'] > 0:
    recognition_rate = (stats['successful_recognitions'] / stats['chunks_processed']) * 100
    log_info(f"   📊 Recognition rate: {recognition_rate:.1f}%")

if stats['bytes_received'] > 0:
    avg_chunk_size = stats['bytes_received'] / stats['chunks_received']
    samples_per_chunk = avg_chunk_size / 2
    log_info(f"   📊 Average chunk: {avg_chunk_size:.0f} bytes ({samples_per_chunk:.0f} samples)")

# Final session summary
logging.info(f"Session ended successfully: {json.dumps(stats)}")
log_info("Vosk session terminated cleanly")