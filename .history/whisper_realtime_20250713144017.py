#!/usr/bin/env python3
"""
Real-time Whisper transcription with enhanced startup reliability
"""

import sys
import json
import struct
import numpy as np
from faster_whisper import WhisperModel
import threading
import queue
import time
import os
import gc

def safe_print(message, file=sys.stdout):
    """Safely print messages with enhanced error handling"""
    try:
        if message is not None:
            if isinstance(message, dict):
                # Ensure all values in dict are not None
                clean_message = {k: v for k, v in message.items() if v is not None}
                print(json.dumps(clean_message), file=file, flush=True)
            else:
                print(str(message), file=file, flush=True)
    except Exception as e:
        try:
            print(f"Error printing message: {e}", file=sys.stderr, flush=True)
        except:
            pass  # If even stderr fails, just continue

def safe_print_error(message):
    """Safely print error messages"""
    safe_print(message, file=sys.stderr)

class WhisperRealtime:
    def __init__(self, model_size="large-v3", device="cpu", compute_type="int8"):
        """Initialize Whisper model with enhanced startup reliability"""
        
        # Initialize all instance variables first
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 3.0
        self.min_audio_length = 1.0
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=10)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.01
        self.silence_duration = 1.5
        self.last_audio_time = time.time()
        self.processing_thread = None
        
        # Enhanced startup with progress reporting
        safe_print_error("Starting Whisper real-time transcription")
        safe_print_error("Python version: " + sys.version)
        safe_print_error(f"Loading Whisper model: {model_size}")
        
        # Model loading with detailed progress
        self._load_model_with_progress(model_size, device, compute_type)
        
        # Start processing thread AFTER model is loaded
        self._start_processing_thread()
        
        # Signal ready state
        self._signal_ready()
    
    def _load_model_with_progress(self, model_size, device, compute_type):
        """Load Whisper model with progress reporting"""
        try:
            safe_print_error("Initializing Whisper model...")
            
            # Check available memory
            try:
                import psutil
                available_memory = psutil.virtual_memory().available / (1024**3)  # GB
                safe_print_error(f"Available system memory: {available_memory:.1f} GB")
                
                if available_memory < 2.0:
                    safe_print_error("Warning: Low memory detected, using smaller model")
                    if model_size == "large-v3":
                        model_size = "base"
                        safe_print_error("Automatically switched to 'base' model due to memory constraints")
            except ImportError:
                safe_print_error("psutil not available, continuing with original model size")
            
            # Create model with enhanced configuration
            safe_print_error(f"Creating WhisperModel with: model={model_size}, device={device}, compute_type={compute_type}")
            
            self.model = WhisperModel(
                model_size, 
                device=device, 
                compute_type=compute_type,
                cpu_threads=min(4, os.cpu_count() or 2),  # Use available CPUs but cap at 4
                num_workers=1,
                download_root=None,  # Use default cache directory
                local_files_only=False  # Allow downloads if needed
            )
            
            safe_print_error("Model object created successfully")
            
            # Test the model with a small sample to ensure it's working
            safe_print_error("Testing model with sample audio...")
            test_audio = np.random.normal(0, 0.1, 16000).astype(np.float32)  # 1 second of noise
            
            try:
                segments, info = self.model.transcribe(
                    test_audio,
                    language="en",
                    beam_size=1,  # Minimal beam for testing
                    condition_on_previous_text=False,
                    vad_filter=False,  # Disable VAD for test
                    word_timestamps=False
                )
                
                # Just try to get the first segment to test the model
                list(segments)  # Convert generator to list to test
                safe_print_error("Model test completed successfully")
                
            except Exception as test_error:
                safe_print_error(f"Model test failed: {test_error}")
                raise Exception(f"Model test failed: {test_error}")
            
            self.model_ready = True
            safe_print_error("Whisper model loaded and tested successfully")
            
        except Exception as e:
            error_message = f"Failed to load Whisper model: {str(e)}"
            safe_print_error(error_message)
            
            # Send error to main process
            error_result = {
                "type": "error",
                "error": error_message
            }
            safe_print(error_result)
            raise
    
    def _start_processing_thread(self):
        """Start the audio processing thread"""
        try:
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop, 
                daemon=True,
                name="WhisperAudioProcessor"
            )
            self.processing_thread.start()
            safe_print_error("Audio processing thread started successfully")
        except Exception as e:
            safe_print_error(f"Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that Whisper is ready to accept audio"""
        safe_print_error("Whisper initialization complete - signaling ready")
        
        # Send ready signal multiple times to ensure it's received
        for i in range(3):
            safe_print("WHISPER_READY")
            time.sleep(0.1)  # Small delay between signals
        
        safe_print_error("Ready signals sent, Whisper is now ready to receive audio")
    
    def _process_audio_loop(self):
        """Background thread for processing audio chunks with enhanced error handling"""
        safe_print_error("Audio processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.1)
                        continue
                        
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk(audio_to_process)
                            consecutive_errors = 0  # Reset error counter on success
                
                time.sleep(0.1)
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Error in processing loop (#{consecutive_errors}): {e}")
                
                error_result = {
                    "type": "error",
                    "error": f"Processing loop error: {str(e)}"
                }
                safe_print(error_result)
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error(f"Too many consecutive errors ({consecutive_errors}), stopping processing loop")
                    break
                
                # Progressive backoff on errors
                time.sleep(min(consecutive_errors * 0.5, 5.0))
        
        safe_print_error("Audio processing loop ended")
    
    def _transcribe_chunk(self, audio_data):
        """Transcribe a chunk of audio data with enhanced error handling"""
        try:
            # Enhanced validation
            if audio_data is None or len(audio_data) == 0:
                return
                
            if not self.model_ready:
                safe_print_error("Model not ready for transcription")
                return
            
            # Skip very quiet audio
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # Ensure minimum length for Whisper
            min_samples = int(self.sample_rate * 0.5)  # 0.5 seconds minimum
            if len(audio_data) < min_samples:
                return
            
            duration = len(audio_data) / self.sample_rate
            safe_print_error(f"Transcribing {duration:.1f}s of audio (max_amp: {max_amplitude:.4f})")
            
            # Enhanced transcription with better parameters
            segments, info = self.model.transcribe(
                audio_data,
                language="en",
                beam_size=3,  # Reduced for speed
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=300,  # Shorter for responsiveness
                    threshold=0.5,
                    min_speech_duration_ms=200,  # Shorter minimum
                    max_speech_duration_s=15     # Shorter max for real-time
                ),
                word_timestamps=False,
                initial_prompt="The following is a clear speech recording with natural conversation."
            )
            
            # Collect all text from segments with timeout
            full_text = ""
            confidence_scores = []
            segment_count = 0
            max_segments = 10  # Limit segments to prevent hanging
            
            for segment in segments:
                if segment_count >= max_segments:
                    break
                    
                if segment and hasattr(segment, 'text') and segment.text:
                    text = segment.text.strip()
                    if text:
                        full_text += text + " "
                        if hasattr(segment, 'avg_logprob'):
                            confidence_scores.append(segment.avg_logprob)
                        segment_count += 1
            
            full_text = full_text.strip()
            
            if full_text:
                # Calculate average confidence safely
                avg_confidence = (np.mean(confidence_scores) 
                                if confidence_scores else -1.0)
                
                # Create result with all non-null values
                result = {
                    "type": "final",
                    "text": full_text,
                    "confidence": float(avg_confidence),
                    "start": 0.0,
                    "end": float(duration),
                    "segments": segment_count
                }
                safe_print(result)
                safe_print_error(f"Transcribed ({segment_count} segments): {full_text}")
        
        except Exception as e:
            safe_print_error(f"Transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk to processing buffer with enhanced validation"""
        try:
            if not self.model_ready:
                safe_print_error("Model not ready, skipping audio chunk")
                return
                
            if audio_data is None:
                safe_print_error("Received null audio data")
                return
                
            # Convert bytes to float32 audio with validation
            if isinstance(audio_data, bytes):
                try:
                    if len(audio_data) % 2 != 0:
                        safe_print_error("Invalid audio data length (not even)")
                        return
                        
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception as e:
                    safe_print_error(f"Error converting audio data: {e}")
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
            # Validate audio array
            if not np.isfinite(audio_array).all():
                safe_print_error("Audio contains non-finite values")
                return
            
            # Check if this chunk has audio (not silence)
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                # Always add to buffer, but track when we last heard audio
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                # Update last audio time if we detected speech
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # Prevent buffer from getting too large (max 30 seconds)
                max_buffer_samples = self.sample_rate * 30
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
                    safe_print_error("Audio buffer trimmed to prevent memory overflow")
                    
        except Exception as e:
            safe_print_error(f"Error adding audio chunk: {e}")
            error_result = {
                "type": "error",
                "error": f"Audio processing error: {str(e)}"
            }
            safe_print(error_result)
    
    def cleanup(self):
        """Clean up resources safely"""
        safe_print_error("Cleaning up Whisper resources...")
        self.is_running = False
        
        if hasattr(self, 'processing_thread') and self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=3.0)
            
        # Clear audio buffer
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        # Force garbage collection
        self.model = None
        gc.collect()
        
        safe_print_error("Whisper cleanup complete")

def main():
    """Main function with enhanced startup reliability"""
    safe_print_error("=== Enhanced Whisper Real-time Transcription Starting ===")
    safe_print_error(f"Python version: {sys.version}")
    safe_print_error(f"NumPy version: {np.__version__}")
    
    # Check dependencies
    try:
        import faster_whisper
        safe_print_error(f"faster-whisper version: {faster_whisper.__version__}")
    except Exception as e:
        safe_print_error(f"faster-whisper import issue: {e}")
    
    # Initialize Whisper with enhanced error handling
    whisper = None
    try:
        safe_print_error("Creating WhisperRealtime instance...")
        whisper = WhisperRealtime(
            model_size="large-v3",
            device="cpu",
            compute_type="int8"
        )
        safe_print_error("WhisperRealtime instance created successfully")
    except Exception as e:
        error_result = {
            "type": "error", 
            "error": f"Failed to initialize Whisper: {str(e)}"
        }
        safe_print(error_result)
        safe_print_error(f"Failed to initialize Whisper: {e}")
        return 1
    
    try:
        safe_print_error("=== Ready to receive audio data ===")
        
        # Enhanced main loop with better error handling
        consecutive_read_errors = 0
        max_read_errors = 5
        
        while True:
            try:
                # Read length of incoming audio data (4 bytes)
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("End of input stream detected, exiting gracefully")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                # Enhanced sanity check on length
                if length == 0:
                    safe_print_error("Received zero-length audio data, skipping")
                    continue
                    
                if length > 5 * 1024 * 1024:  # 5MB max
                    safe_print_error(f"Received suspicious data length: {length}, skipping")
                    continue
                
                # Read the audio data with timeout handling
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    safe_print_error(f"Expected {length} bytes, got {len(audio_data)}, continuing")
                    continue
                
                # Add to processing buffer
                if whisper and whisper.model_ready:
                    whisper.add_audio_chunk(audio_data)
                    consecutive_read_errors = 0  # Reset error counter
                else:
                    safe_print_error("Whisper not ready, skipping audio chunk")
                
            except Exception as e:
                consecutive_read_errors += 1
                safe_print_error(f"Error reading audio data (#{consecutive_read_errors}): {e}")
                
                if consecutive_read_errors >= max_read_errors:
                    safe_print_error(f"Too many consecutive read errors, exiting")
                    break
                
                error_result = {
                    "type": "error",
                    "error": f"Data reading error: {str(e)}"
                }
                safe_print(error_result)
                
                # Short delay before retrying
                time.sleep(0.5)
    
    except KeyboardInterrupt:
        safe_print_error("Interrupted by user")
    except Exception as e:
        error_result = {
            "type": "error",
            "error": f"Main loop error: {str(e)}"
        }
        safe_print(error_result)
        safe_print_error(f"Main loop error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("=== Whisper transcription ended ===")
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)