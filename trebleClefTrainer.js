class TrebleClefTrainer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentNote = null;
        this.correctCount = 0;
        this.showingHint = false;
        this.isInvincible = false;
        this.noteRange = [];
        this.practiceMode = 'all';
        this.adaptiveDifficulty = false;
        this.adaptiveManager = new AdaptiveDifficultyManager();
        this.audioDetector = new AudioNoteDetector();
        this.wrongAnswers = new Map();
        
        // Animation properties
        this.isCorrectAnimation = false;
        this.isWrongAnimation = false;
        this.noteGlow = 0.0;
        this.backgroundFlash = 0.0;
        this.noteShakeOffset = 0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.loadSettings();
    }

    initializeElements() {
        // Menu elements
        this.mainMenu = document.getElementById('mainMenu');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.mainApp = document.getElementById('mainApp');
        this.statsModal = document.getElementById('statsModal');
        
        // Controls
        this.practiceModeSelect = document.getElementById('practiceMode');
        this.adaptiveCheckbox = document.getElementById('adaptiveDifficulty');
        this.startButton = document.getElementById('startButton');
        this.settingsButton = document.getElementById('settingsButton');
        
        // App elements
        this.canvas = document.getElementById('staffCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusLabel = document.getElementById('statusLabel');
        this.scoreLabel = document.getElementById('scoreLabel');
        this.hintDisplay = document.getElementById('hintDisplay');
        
        this.setupCanvas();
        
        // Force immediate initial draw
        this.drawStaff();
        this.drawTrebleClef();
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const resize = () => {
            // Get container size
            const rect = container.getBoundingClientRect();
            const dpi = window.devicePixelRatio || 1;
            
            // Always use the container's dimensions
            const width = rect.width;
            const height = rect.height;
            
            // Set canvas size accounting for DPI
            this.canvas.width = width * dpi;
            this.canvas.height = height * dpi;
            
            // Set display size
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
            
            // Reset transform and scale for DPI
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpi, dpi);
            
            // Force immediate redraw
            this.drawStaff();
            this.drawTrebleClef();
        };
        
        // Call resize immediately
        resize();
        
        // Set up resize listeners
        window.addEventListener('resize', resize);
        window.addEventListener('fullscreenchange', resize);
        
        // Additional calls to ensure proper rendering
        requestAnimationFrame(resize);
    }

    setupEventListeners() {
        // Menu buttons
        this.startButton.addEventListener('click', () => this.startPractice());
        this.settingsButton.addEventListener('click', () => this.showSettings());
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettings').addEventListener('click', () => this.hideSettings());
        
        // Control buttons
        document.getElementById('newNoteBtn').addEventListener('click', () => this.nextNote());
        document.getElementById('playNoteBtn').addEventListener('click', () => this.playCurrentNote());
        document.getElementById('hintBtn').addEventListener('click', () => this.toggleHint());
        document.getElementById('testBtn').addEventListener('click', () => this.testCorrect());
        document.getElementById('micTestBtn').addEventListener('click', () => this.testMicrophone());
        document.getElementById('statsBtn').addEventListener('click', () => this.showStatistics());
        document.getElementById('menuBtn').addEventListener('click', () => this.returnToMenu());
        
        // Modal close
        document.querySelector('.close').addEventListener('click', () => this.hideStats());
        
        // Volume slider
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        volumeSlider.addEventListener('input', (e) => {
            volumeValue.textContent = e.target.value + '%';
        });
        
        // Animation loop
        this.startAnimationLoop();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (this.mainApp.classList.contains('hidden')) return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.nextNote();
                    break;
                case 'KeyH':
                    this.toggleHint();
                    break;
                case 'KeyP':
                    this.playCurrentNote();
                    break;
                case 'F11':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        });
    }

    startPractice() {
        this.practiceMode = this.practiceModeSelect.value;
        this.adaptiveDifficulty = this.adaptiveCheckbox.checked;
        
        this.initializeNoteRange();
        this.setupAudioDetection();
        
        this.mainMenu.classList.add('hidden');
        this.mainApp.classList.remove('hidden');
        
        this.nextNote();
        this.statusLabel.textContent = '🎹 Play the note shown above';
    }

    initializeNoteRange() {
        const notesByMode = {
            'all': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
            'staff': ['E4', 'G4', 'B4', 'D5', 'F5'], // Staff lines
            'spaces': ['F4', 'A4', 'C5', 'E5'], // Spaces
            'ledger': ['C4', 'D4', 'A5'] // Ledger lines
        };
        
        this.noteRange = notesByMode[this.practiceMode] || notesByMode['all'];
        
        // Initialize adaptive difficulty tracking
        this.noteRange.forEach(note => {
            this.adaptiveManager.initializeNote(note);
        });
    }

    setupAudioDetection() {
        this.audioDetector.setNoteListener((detectedNote) => {
            this.onNoteDetected(detectedNote);
        });
        
        this.audioDetector.startListening().then(() => {
            this.statusLabel.textContent = '🎹 Microphone ready - play the note!';
        }).catch((error) => {
            this.statusLabel.textContent = '❌ Microphone failed - use Test buttons';
            console.error('Microphone setup failed:', error);
        });
    }

    nextNote() {
        if (this.adaptiveDifficulty) {
            this.currentNote = this.adaptiveManager.selectAdaptiveNote(this.noteRange);
        } else {
            this.currentNote = this.noteRange[Math.floor(Math.random() * this.noteRange.length)];
        }
        
        this.showingHint = false;
        this.hintDisplay.classList.add('hidden');
        this.redraw();
    }

    onNoteDetected(detectedNote) {
        if (this.isInvincible) return;
        
        if (this.currentNote === detectedNote) {
            this.correctCount++;
            this.scoreLabel.textContent = `🏆 Score: ${this.correctCount}`;
            this.statusLabel.textContent = '✅ Correct! Well done!';
            this.statusLabel.style.color = '#64c864';
            
            this.adaptiveManager.recordAttempt(this.currentNote, true);
            this.showCorrectAnimation();
            this.playCurrentNote();
            
            setTimeout(() => {
                this.nextNote();
                this.statusLabel.textContent = '🎹 Play the note shown above';
                this.statusLabel.style.color = '#9696ff';
            }, 2000);
        } else {
            this.adaptiveManager.recordAttempt(this.currentNote, false);
            this.wrongAnswers.set(this.currentNote, (this.wrongAnswers.get(this.currentNote) || 0) + 1);
            
            this.statusLabel.textContent = '❌ Wrong note. Try again!';
            this.statusLabel.style.color = '#ff6464';
            
            this.showWrongAnimation();
            this.startInvincibilityPeriod();
        }
    }

    showCorrectAnimation() {
        this.isCorrectAnimation = true;
        this.isWrongAnimation = false;
        this.backgroundFlash = 0.3;
        
        setTimeout(() => {
            this.isCorrectAnimation = false;
            this.noteGlow = 0.0;
        }, 2000);
    }

    showWrongAnimation() {
        this.isWrongAnimation = true;
        this.isCorrectAnimation = false;
        this.backgroundFlash = 0.3;
        
        setTimeout(() => {
            this.isWrongAnimation = false;
            this.noteShakeOffset = 0;
        }, 1000);
    }

    startInvincibilityPeriod() {
        this.isInvincible = true;
        setTimeout(() => {
            this.isInvincible = false;
            this.statusLabel.textContent = '🎹 Ready - try again!';
            this.statusLabel.style.color = '#9696ff';
        }, 1500);
    }

    toggleHint() {
        this.showingHint = !this.showingHint;
        if (this.showingHint && this.currentNote) {
            this.hintDisplay.textContent = `💡 ${this.currentNote}`;
            this.hintDisplay.classList.remove('hidden');
        } else {
            this.hintDisplay.classList.add('hidden');
        }
    }

    playCurrentNote() {
        if (!this.currentNote) return;
        
        const frequencies = {
            'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
            'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
            'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00
        };
        
        const frequency = frequencies[this.currentNote];
        if (frequency) {
            this.playFrequency(frequency, 1000);
        }
    }

    playFrequency(frequency, duration) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        const volume = document.getElementById('volumeSlider').value / 100 * 0.3;
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    testCorrect() {
        if (this.currentNote) {
            this.onNoteDetected(this.currentNote);
        }
    }

    testMicrophone() {
        alert('MICROPHONE TEST:\n\n1. Make noise (clap, speak, play piano)\n2. Watch the console for audio detection\n3. Grant microphone permission if prompted\n\nIf it doesn\'t work:\n- Check browser microphone permissions\n- Try refreshing the page\n- Use a different browser');
    }

    showStatistics() {
        const stats = this.adaptiveManager.getProgressSummary(this.noteRange, this.correctCount);
        document.getElementById('statsContent').innerHTML = `<pre>${stats}</pre>`;
        this.statsModal.classList.remove('hidden');
    }

    hideStats() {
        this.statsModal.classList.add('hidden');
    }

    showSettings() {
        this.mainMenu.classList.add('hidden');
        this.settingsMenu.classList.remove('hidden');
    }

    hideSettings() {
        this.settingsMenu.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
        this.audioDetector.stopListening();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    startAnimationLoop() {
        const animate = () => {
            if (this.isCorrectAnimation) {
                this.noteGlow = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
                this.backgroundFlash = Math.max(0, this.backgroundFlash - 0.05);
            }
            if (this.isWrongAnimation) {
                this.noteShakeOffset = Math.sin(Date.now() * 0.1) * 5;
                this.backgroundFlash = Math.max(0, this.backgroundFlash - 0.05);
            }
            
            this.redraw();
            requestAnimationFrame(animate);
        };
        animate();
    }

    redraw() {
        if (!this.ctx) return;
        
        // Clear entire canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = '#282830';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Ensure staff is drawn even if no note is present
        this.drawStaff();
        this.drawTrebleClef();
        
        // Draw current note if exists
        if (this.currentNote) {
            this.drawNote(this.currentNote);
        }
    }

    drawStaff() {
        const staffLines = 5;
        const staffSpacing = Math.min(40, this.canvas.height / 15);
        const centerY = this.canvas.height / (2 * window.devicePixelRatio);
        const startY = centerY - (staffSpacing * 2);
        const startX = 50; // Fixed position instead of percentage
        const staffWidth = this.canvas.width / window.devicePixelRatio - 100; // Fixed margins

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;

        for (let i = 0; i < staffLines; i++) {
            const y = startY + i * staffSpacing;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(startX + staffWidth, y);
            this.ctx.stroke();
        }
    }

    drawTrebleClef() {
        const startX = (this.canvas.width * 0.15) / window.devicePixelRatio;
        const centerY = this.canvas.height / (2 * window.devicePixelRatio);
        const clefSize = Math.min(120, this.canvas.height / 4);
        
        this.ctx.fillStyle = '#00bfff';
        this.ctx.font = `bold ${clefSize}px serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = 'rgba(0, 191, 255, 0.5)';
        this.ctx.shadowBlur = 15;
        this.ctx.fillText('𝄞', startX, centerY);
        this.ctx.shadowBlur = 0;
    }

    drawNote(noteName) {
        const noteX = this.canvas.width * 0.65 + this.noteShakeOffset;
        const noteY = this.getNoteYPosition(noteName);
        const noteSize = Math.min(35, this.canvas.width / 35);
        
        if (this.isCorrectAnimation && this.noteGlow > 0) {
            this.ctx.fillStyle = `rgba(0, 255, 136, ${this.noteGlow * 0.7})`;
            for (let i = 10; i >= 1; i--) {
                this.ctx.beginPath();
                this.ctx.ellipse(noteX, noteY, noteSize + i*5, (noteSize + i*5) * 0.6, 0, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        
        let noteColor = '#ff4081';
        if (this.isCorrectAnimation) {
            noteColor = '#00ff88';
        } else if (this.isWrongAnimation) {
            const pulse = Math.sin(Date.now() * 0.02) * 80 + 175;
            noteColor = `rgb(${pulse}, 40, 40)`;
        }
        
        this.ctx.fillStyle = noteColor;
        this.ctx.beginPath();
        this.ctx.ellipse(noteX, noteY, noteSize, noteSize * 0.6, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.ctx.strokeStyle = noteColor;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        
        const stemLength = Math.min(150, this.canvas.height / 4);
        const centerY = this.canvas.height / 2;
        if (noteY > centerY) {
            this.ctx.moveTo(noteX + noteSize, noteY);
            this.ctx.lineTo(noteX + noteSize, noteY - stemLength);
        } else {
            this.ctx.moveTo(noteX - noteSize, noteY);
            this.ctx.lineTo(noteX - noteSize, noteY + stemLength);
        }
        this.ctx.stroke();
        
        this.drawLedgerLines(noteX, noteY, noteSize);
    }

    getNoteYPosition(noteName) {
        const staffSpacing = Math.min(60, this.canvas.height / 10);
        const centerY = this.canvas.height / 2;
        const bottomLine = centerY + (staffSpacing * 2);
        
        const positions = {
            'C4': bottomLine + staffSpacing * 1.5,
            'D4': bottomLine + staffSpacing,
            'E4': bottomLine,
            'F4': bottomLine - staffSpacing * 0.5,
            'G4': bottomLine - staffSpacing,
            'A4': bottomLine - staffSpacing * 1.5,
            'B4': bottomLine - staffSpacing * 2,
            'C5': bottomLine - staffSpacing * 2.5,
            'D5': bottomLine - staffSpacing * 3,
            'E5': bottomLine - staffSpacing * 3.5,
            'F5': bottomLine - staffSpacing * 4,
            'G5': bottomLine - staffSpacing * 4.5,
            'A5': bottomLine - staffSpacing * 5
        };
        
        return positions[noteName] || bottomLine;
    }

    drawLedgerLines(noteX, noteY, noteSize) {
        const staffSpacing = Math.min(60, this.canvas.height / 10);
        const centerY = this.canvas.height / 2;
        const staffTop = centerY - (staffSpacing * 2);
        const staffBottom = centerY + (staffSpacing * 2);
        const lineLength = noteSize * 3.5;
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 5;
        
        if (noteY > staffBottom) {
            let ledgerY = staffBottom + staffSpacing;
            while (ledgerY <= noteY + 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(noteX - lineLength, ledgerY);
                this.ctx.lineTo(noteX + lineLength, ledgerY);
                this.ctx.stroke();
                ledgerY += staffSpacing;
            }
        }
        
        if (noteY < staffTop) {
            let ledgerY = staffTop - staffSpacing;
            while (ledgerY >= noteY - 20) {
                this.ctx.beginPath();
                this.ctx.moveTo(noteX - lineLength, ledgerY);
                this.ctx.lineTo(noteX + lineLength, ledgerY);
                this.ctx.stroke();
                ledgerY -= staffSpacing;
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TrebleClefTrainer();
});
