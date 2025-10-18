#!/usr/bin/env python3
"""
Real-time Whisper transcription using the BASE model
Modified for word-by-word output with sentence grouping
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
import signal
import re

def safe_print(message, file=sys.stdout):
    """Safely print messages"""
    try:
        if message is not None:
            if isinstance(message, dict):
                clean_message = {k: v for k, v in message.items() if v is not None}
                print(json.dumps(clean_message), file=file, flush=True)
            else:
                print(str(message), file=file, flush=True)
    except Exception as e:
        try:
            print(f"Error printing message: {e}", file=sys.stderr, flush=True)
        except:
            pass

def safe_print_error(message):
    """Safely print error messages"""
    safe_print(message, file=sys.stderr)

class WhisperRealtimeWordByWord:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """Initialize with word-by-word processing"""
        
        # Initialize all instance variables
        self.model = None
        self.sample_rate = 16000
        self.chunk_duration = 1.0  # Shorter chunks for faster word detection
        self.min_audio_length = 0.5  # Even shorter minimum
        self.audio_buffer = np.array([], dtype=np.float32)
        self.buffer_lock = threading.Lock()
        self.last_process_time = time.time()
        self.audio_queue = queue.Queue(maxsize=15)
        self.is_running = True
        self.model_ready = False
        self.silence_threshold = 0.008  # Lower threshold for word detection
        self.silence_duration = 0.8  # Shorter silence for responsiveness
        self.last_audio_time = time.time()
        self.processing_thread = None
        self.startup_complete = False
        
        # Word-by-word state management
        self.current_sentence_words = []
        self.last_sent_word_count = 0
        self.sentence_id = int(time.time() * 1000)  # Unique ID for current sentence
        
        # Sentence detection patterns
        self.sentence_endings = re.compile(r'[.!?]+\s*$')
        self.sentence_starters = re.compile(r'^[A-Z]')
        
        # Optimized transcription settings for word-level detection
        self.transcribe_settings = {
            "language": "en",
            "beam_size": 1,  # Single beam for speed
            "best_of": 1,
            "temperature": [0.0],
            "condition_on_previous_text": True,
            "compression_ratio_threshold": 2.4,
            "log_prob_threshold": -1.0,
            "no_speech_threshold": 0.6,
            "vad_filter": True,
            "vad_parameters": dict(
                min_silence_duration_ms=200,  # Shorter for word detection
                threshold=0.4,
                min_speech_duration_ms=100,
                max_speech_duration_s=10
            ),
            "word_timestamps": True,  # Enable word timestamps
            "initial_prompt": "This is a conversation with clear speech."
        }
        
        safe_print_error("🚀 Starting Word-by-Word Whisper Transcription")
        safe_print_error(f"Target model: {model_size} (WORD-BY-WORD MODE)")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # Load the model
        self._load_model(model_size, device, compute_type)
        
        # Start processing thread
        self._start_processing_thread()
        
        # Signal ready
        self._signal_ready()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        safe_print_error(f"Received signal {signum}, shutting down...")
        self.cleanup()
        sys.exit(0)
    
    def _load_model(self, model_size, device, compute_type):
        """Load the Whisper model with word timestamp support"""
        try:
            safe_print_error(f"Loading model for word-by-word: {model_size}")
            
            start_time = time.time()
            
            # Create model instance with word timestamp support
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=2,
                num_workers=1,
                download_root=None,
                local_files_only=True
            )
            
            load_time = time.time() - start_time
            safe_print_error(f"✅ Model loaded in {load_time:.1f} seconds")
            
            # Quick test with word timestamps
            safe_print_error("🧪 Testing word-level transcription...")
            test_audio = np.random.normal(0, 0.01, 8000).astype(np.float32)
            
            segments, info = self.model.transcribe(
                test_audio,
                beam_size=1,
                word_timestamps=True
            )
            
            list(segments)  # Consume results
            safe_print_error("✅ Word-level transcription test completed")
            
            self.model_ready = True
            safe_print_error("🎉 WORD-BY-WORD WHISPER READY!")
            
        except Exception as e:
            error_message = f"Failed to load model: {str(e)}"
            safe_print_error(f"❌ {error_message}")
            raise
    
    def _start_processing_thread(self):
        """Start the audio processing thread"""
        try:
            self.processing_thread = threading.Thread(
                target=self._process_audio_loop,
                daemon=True,
                name="WordByWordProcessor"
            )
            self.processing_thread.start()
            safe_print_error("✅ Word-by-word processing thread started")
        except Exception as e:
            safe_print_error(f"❌ Failed to start processing thread: {e}")
            raise
    
    def _signal_ready(self):
        """Signal that Whisper is ready"""
        safe_print_error("🎉 WORD-BY-WORD INITIALIZATION COMPLETE")
        
        # Send ready signal
        for i in range(3):
            safe_print("WHISPER_READY")
            time.sleep(0.05)
        
        safe_print_error("🚀 READY FOR WORD-BY-WORD TRANSCRIPTION!")
        self.startup_complete = True
    
    def _process_audio_loop(self):
        """Background processing optimized for word detection"""
        safe_print_error("🔄 Word-by-word processing loop started")
        consecutive_errors = 0
        max_consecutive_errors = 3
        
        while self.is_running:
            try:
                current_time = time.time()
                
                with self.buffer_lock:
                    if len(self.audio_buffer) == 0:
                        time.sleep(0.03)  # Faster polling for word detection
                        continue
                    
                    buffer_duration = len(self.audio_buffer) / self.sample_rate
                    time_since_last_audio = current_time - self.last_audio_time
                    
                    # More aggressive processing for word-level detection
                    should_process = (
                        buffer_duration >= self.chunk_duration or
                        (buffer_duration >= self.min_audio_length and 
                         time_since_last_audio >= self.silence_duration)
                    )
                    
                    if should_process:
                        audio_to_process = self.audio_buffer.copy()
                        self.audio_buffer = np.array([], dtype=np.float32)
                        
                        if len(audio_to_process) > 0:
                            self._transcribe_chunk_word_by_word(audio_to_process)
                            consecutive_errors = 0
                
                time.sleep(0.03)  # Faster polling
                
            except Exception as e:
                consecutive_errors += 1
                safe_print_error(f"Processing loop error #{consecutive_errors}: {e}")
                
                if consecutive_errors >= max_consecutive_errors:
                    safe_print_error("Too many consecutive errors, stopping")
                    break
                
                time.sleep(0.5)
        
        safe_print_error("🔄 Word-by-word processing loop ended")
    
    def _transcribe_chunk_word_by_word(self, audio_data):
        """Transcribe with word-level granularity"""
        try:
            if audio_data is None or len(audio_data) == 0:
                return
            
            if not self.model_ready:
                return
            
            # Quick audio validation
            max_amplitude = np.max(np.abs(audio_data))
            if max_amplitude < self.silence_threshold:
                return
            
            # Minimum chunk size for word detection
            min_samples = int(self.sample_rate * 0.2)  # 200ms minimum
            if len(audio_data) < min_samples:
                return
            
            start_time = time.time()
            
            # Transcribe with word timestamps
            segments, info = self.model.transcribe(
                audio_data,
                **self.transcribe_settings
            )
            
            # Process word by word
            new_words = []
            full_text = ""
            
            for segment in segments:
                if hasattr(segment, 'words') and segment.words:
                    # Process individual words
                    for word_info in segment.words:
                        if hasattr(word_info, 'word') and word_info.word:
                            word = word_info.word.strip()
                            if word:
                                new_words.append({
                                    'word': word,
                                    'start': getattr(word_info, 'start', 0.0),
                                    'end': getattr(word_info, 'end', 0.0),
                                    'confidence': getattr(word_info, 'probability', 0.8)
                                })
                                full_text += word + " "
                elif hasattr(segment, 'text') and segment.text:
                    # Fallback: split text into words
                    text = segment.text.strip()
                    if text:
                        words = text.split()
                        for word in words:
                            new_words.append({
                                'word': word,
                                'start': 0.0,
                                'end': 0.0,
                                'confidence': 0.8
                            })
                        full_text = text + " "
            
            if new_words:
                self._process_new_words(new_words, full_text.strip())
                
                transcribe_time = time.time() - start_time
                safe_print_error(f"✅ WORDS: {[w['word'] for w in new_words]} ({transcribe_time:.1f}s)")
        
        except Exception as e:
            safe_print_error(f"❌ Word-by-word transcription error: {e}")
            error_result = {
                "type": "error",
                "error": f"Word transcription error: {str(e)}"
            }
            safe_print(error_result)
    
    def _process_new_words(self, new_words, full_text):
        """Process new words and handle sentence detection"""
        try:
            # Add new words to current sentence
            self.current_sentence_words.extend(new_words)
            
            # Send word-by-word updates
            for i, word_info in enumerate(new_words):
                word_position = len(self.current_sentence_words) - len(new_words) + i
                
                # Send individual word as partial result
                partial_result = {
                    "type": "partial_word",
                    "word": word_info['word'],
                    "word_position": word_position,
                    "sentence_id": str(self.sentence_id),
                    "confidence": word_info['confidence'],
                    "start": word_info['start'],
                    "end": word_info['end']
                }
                safe_print(partial_result)
            
            # Check if sentence is complete
            current_text = " ".join([w['word'] for w in self.current_sentence_words])
            
            # Detect sentence ending
            is_sentence_complete = (
                self.sentence_endings.search(current_text) is not None or
                len(self.current_sentence_words) > 25 or  # Max words per sentence
                self._detect_natural_pause(current_text)
            )
            
            if is_sentence_complete:
                # Send complete sentence
                final_result = {
                    "type": "final",
                    "text": current_text,
                    "sentence_id": str(self.sentence_id),
                    "word_count": len(self.current_sentence_words),
                    "confidence": self._calculate_sentence_confidence(),
                    "model": "base",
                    "quality": "word_by_word"
                }
                safe_print(final_result)
                
                safe_print_error(f"📝 SENTENCE COMPLETE: '{current_text}'")
                
                # Reset for next sentence
                self.current_sentence_words = []
                self.last_sent_word_count = 0
                self.sentence_id = int(time.time() * 1000)  # New sentence ID
            else:
                # Send sentence progress update
                progress_result = {
                    "type": "sentence_progress",
                    "text": current_text,
                    "sentence_id": str(self.sentence_id),
                    "word_count": len(self.current_sentence_words),
                    "is_complete": False
                }
                safe_print(progress_result)
        
        except Exception as e:
            safe_print_error(f"❌ Error processing words: {e}")
    
    def _detect_natural_pause(self, text):
        """Detect natural sentence boundaries"""
        # Simple heuristics for sentence boundaries
        conjunctions_and_pauses = [
            ' and then ', ' but then ', ' so then ', ' however ',
            ' meanwhile ', ' afterwards ', ' later ', ' next '
        ]
        
        for pause_phrase in conjunctions_and_pauses:
            if pause_phrase in text.lower() and len(self.current_sentence_words) > 8:
                return True
        
        return False
    
    def _calculate_sentence_confidence(self):
        """Calculate average confidence for the sentence"""
        if not self.current_sentence_words:
            return 0.8
        
        confidences = [w['confidence'] for w in self.current_sentence_words if 'confidence' in w]
        if confidences:
            return sum(confidences) / len(confidences)
        return 0.8
    
    def add_audio_chunk(self, audio_data):
        """Add audio chunk for word-by-word processing"""
        try:
            if not self.model_ready or not self.startup_complete:
                return
            
            if audio_data is None:
                return
            
            # Convert bytes to float32
            if isinstance(audio_data, bytes):
                try:
                    if len(audio_data) % 2 != 0:
                        audio_data = audio_data[:-1]
                    audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
                except Exception:
                    return
            else:
                audio_array = audio_data
            
            if audio_array is None or len(audio_array) == 0:
                return
            
            if not np.isfinite(audio_array).all():
                return
            
            max_amplitude = np.max(np.abs(audio_array))
            
            with self.buffer_lock:
                self.audio_buffer = np.concatenate([self.audio_buffer, audio_array])
                
                if max_amplitude > self.silence_threshold:
                    self.last_audio_time = time.time()
                
                # Smaller buffer for responsiveness
                max_buffer_samples = self.sample_rate * 8  # 8 seconds max
                if len(self.audio_buffer) > max_buffer_samples:
                    self.audio_buffer = self.audio_buffer[-max_buffer_samples:]
        
        except Exception as e:
            safe_print_error(f"❌ Error adding audio chunk: {e}")
    
    def cleanup(self):
        """Clean up resources"""
        safe_print_error("🧹 Cleaning up word-by-word Whisper resources...")
        self.is_running = False
        
        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)
        
        with self.buffer_lock:
            self.audio_buffer = np.array([], dtype=np.float32)
        
        # Send final sentence if incomplete
        if self.current_sentence_words:
            current_text = " ".join([w['word'] for w in self.current_sentence_words])
            final_result = {
                "type": "final",
                "text": current_text,
                "sentence_id": str(self.sentence_id),
                "word_count": len(self.current_sentence_words),
                "confidence": self._calculate_sentence_confidence(),
                "model": "base",
                "quality": "word_by_word_final"
            }
            safe_print(final_result)
        
        self.model = None
        gc.collect()
        safe_print_error("✅ Word-by-word cleanup complete")

def main():
    """Main function for word-by-word Whisper"""
    safe_print_error("🚀 Word-by-Word Whisper Real-time Transcription")
    
    whisper = None
    try:
        # Initialize word-by-word processor
        whisper = WhisperRealtimeWordByWord(model_size="base")
        
        safe_print_error("🎧 Ready for word-by-word audio input")
        
        while True:
            try:
                # Read length
                length_data = sys.stdin.buffer.read(4)
                if len(length_data) != 4:
                    safe_print_error("📡 End of input stream")
                    break
                
                length = struct.unpack('<I', length_data)[0]
                
                if length == 0 or length > 1024 * 1024:  # 1MB max
                    continue
                
                # Read audio data
                audio_data = sys.stdin.buffer.read(length)
                if len(audio_data) != length:
                    continue
                
                # Process with word-by-word detection
                if whisper and whisper.startup_complete:
                    whisper.add_audio_chunk(audio_data)
            
            except Exception as e:
                safe_print_error(f"❌ Error reading audio: {e}")
                break
    
    except KeyboardInterrupt:
        safe_print_error("⏹️ Interrupted by user")
    except Exception as e:
        error_result = {"type": "error", "error": f"Word-by-word main error: {str(e)}"}
        safe_print(error_result)
        safe_print_error(f"❌ Word-by-word Whisper fatal error: {e}")
    
    finally:
        if whisper:
            whisper.cleanup()
        safe_print_error("🏁 Word-by-Word Whisper ended")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())