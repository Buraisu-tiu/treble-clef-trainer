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
        
        // Find peak frequency
        let maxAmplitude = 0;
        let peakIndex = 0;
        
        // Focus on musical frequency range (80Hz - 1200Hz)
        const minIndex = Math.floor(80 * this.analyser.fftSize / this.audioContext.sampleRate);
        const maxIndex = Math.floor(1200 * this.analyser.fftSize / this.audioContext.sampleRate);
        
        for (let i = minIndex; i < maxIndex && i < this.dataArray.length; i++) {
            if (this.dataArray[i] > maxAmplitude) {
                maxAmplitude = this.dataArray[i];
                peakIndex = i;
            }
        }
        
        // Check if amplitude is strong enough
        if (maxAmplitude > 100) { // Threshold for detection
            const frequency = peakIndex * this.audioContext.sampleRate / this.analyser.fftSize;
            const note = this.frequencyToNote(frequency);
            
            if (note && note !== this.lastDetectedNote) {
                const now = Date.now();
                if (now - this.lastDetectionTime > 500) { // Debounce
                    console.log(`🎵 Note detected: ${note} (${frequency.toFixed(1)} Hz, amplitude: ${maxAmplitude})`);
                    this.lastDetectedNote = note;
                    this.lastDetectionTime = now;
                    
                    if (this.noteListener) {
                        this.noteListener(note);
                    }
                }
            }
        }
        
        // Continue processing
        setTimeout(() => this.processAudio(), 50);
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

        // Find closest note (with tolerance)
        let closestNote = null;
        let smallestDifference = Infinity;

        for (const [note, noteFreq] of Object.entries(noteFrequencies)) {
            const difference = Math.abs(frequency - noteFreq);
            const tolerance = noteFreq * 0.06; // 6% tolerance
            
            if (difference < tolerance && difference < smallestDifference) {
                smallestDifference = difference;
                closestNote = note;
            }
        }

        return closestNote;
    }
}
