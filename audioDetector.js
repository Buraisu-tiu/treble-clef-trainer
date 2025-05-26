class AudioNoteDetector {
    constructor() {
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.dataArray = null;
        this.noteListener = null;
        this.isListening = false;
        this.lastDetectedNote = null;
        this.lastDetectionTime = 0;
        this.consecutiveDetections = new Map(); // Add detection counter
        this.requiredDetections = 2; // Number of consecutive detections needed
    }

    setNoteListener(callback) {
        this.noteListener = callback;
    }

    async startListening() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            
            this.analyser.fftSize = 8192;
            this.analyser.smoothingTimeConstant = 0.8;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            this.microphone.connect(this.analyser);
            
            this.isListening = true;
            this.processAudio();
            
            console.log('🎤 Microphone listening started');
            return Promise.resolve();
        } catch (error) {
            console.error('Microphone access failed:', error);
            return Promise.reject(error);
        }
    }

    stopListening() {
        this.isListening = false;
        if (this.microphone) {
            this.microphone.disconnect();
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    processAudio() {
        if (!this.isListening) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Find peak frequencies - look for multiple peaks
        const peaks = this.findPeakFrequencies();
        
        // Process each peak found
        for (const {frequency, amplitude} of peaks) {
            const note = this.frequencyToNote(frequency);
            
            if (note) {
                // Increment consecutive detection counter
                this.consecutiveDetections.set(note, (this.consecutiveDetections.get(note) || 0) + 1);
                
                // Check if we have enough consecutive detections
                if (this.consecutiveDetections.get(note) >= this.requiredDetections) {
                    const now = Date.now();
                    if (now - this.lastDetectionTime > 200) { // Reduced debounce time
                        console.log(`🎵 Note detected: ${note} (${frequency.toFixed(1)} Hz)`);
                        this.lastDetectedNote = note;
                        this.lastDetectionTime = now;
                        
                        if (this.noteListener) {
                            this.noteListener(note);
                        }
                    }
                }
            }
        }
        
        // Clear counters for notes not detected in this frame
        for (const [note, count] of this.consecutiveDetections) {
            if (!peaks.some(p => this.frequencyToNote(p.frequency) === note)) {
                this.consecutiveDetections.delete(note);
            }
        }
        
        requestAnimationFrame(() => this.processAudio());
    }

    findPeakFrequencies() {
        const peaks = [];
        const minFreq = 220; // A3
        const maxFreq = 880; // A5
        const minIndex = Math.floor(minFreq * this.analyser.fftSize / this.audioContext.sampleRate);
        const maxIndex = Math.floor(maxFreq * this.analyser.fftSize / this.audioContext.sampleRate);
        
        for (let i = minIndex; i < maxIndex; i++) {
            const freq = i * this.audioContext.sampleRate / this.analyser.fftSize;
            const amp = this.dataArray[i];
            
            // Dynamic threshold based on frequency range
            const threshold = freq < 300 ? 60 : freq > 700 ? 65 : 70;
            
            if (amp > threshold && 
                (i === 0 || amp > this.dataArray[i-1]) && 
                (i === this.dataArray.length-1 || amp > this.dataArray[i+1])) {
                peaks.push({
                    frequency: freq,
                    amplitude: amp
                });
            }
        }
        
        return peaks.sort((a, b) => b.amplitude - a.amplitude).slice(0, 3);
    }

    getFrequencyWeight(frequency) {
        // Boost sensitivity for extreme frequencies
        if (frequency < 200) {
            return 1.4; // Boost bass frequencies
        } else if (frequency > 800) {
            return 1.3; // Boost high frequencies
        }
        return 1.0;
    }

    getAdaptiveThreshold(peakIndex) {
        // Lower threshold for extreme frequencies
        const frequency = peakIndex * this.audioContext.sampleRate / this.analyser.fftSize;
        if (frequency < 200 || frequency > 800) {
            return 70; // More sensitive for extreme frequencies
        }
        return 80; // Normal threshold for mid-range
    }

    frequencyToNote(frequency) {
        // Note frequencies (in Hz)
        const noteFrequencies = {
            'C4': 261.63,
            'D4': 293.66,
            'E4': 329.63,
            'F4': 349.23,
            'G4': 392.00,
            'A4': 440.00,
            'B4': 493.88,
            'C5': 523.25,
            'D5': 587.33,
            'E5': 659.25,
            'F5': 698.46,
            'G5': 783.99,
            'A5': 880.00
        };

        // Use dynamic tolerance based on frequency
        let closestNote = null;
        let smallestDifference = Infinity;

        for (const [note, noteFreq] of Object.entries(noteFrequencies)) {
            const difference = Math.abs(frequency - noteFreq);
            // Wider tolerance for lower notes (8%) and higher notes (7%)
            const tolerance = noteFreq * (noteFreq < 300 ? 0.05 : noteFreq > 600 ? 0.04 : 0.045);
            
            if (difference < tolerance && difference < smallestDifference) {
                smallestDifference = difference;
                closestNote = note;
            }
        }

        return closestNote;
    }
}
