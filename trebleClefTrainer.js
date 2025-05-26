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
        
        this.canvasInitialized = false;
        this.isStarted = false;
        
        this.ghostNote = null;  // Add this line
        this.ghostNoteOpacity = 0;  // Add this line
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.loadSettings();
    }

    initializeElements() {
        // Validate and get critical elements first
        this.mainMenu = document.getElementById('mainMenu');
        this.settingsMenu = document.getElementById('settingsMenu');
        this.mainApp = document.getElementById('mainApp');
        this.clefModeSelect = document.getElementById('clefMode');
        this.practiceModeSelect = document.getElementById('practiceMode');
        this.adaptiveCheckbox = document.getElementById('adaptiveDifficulty');
        this.startButton = document.getElementById('startButton');
        this.settingsButton = document.getElementById('settingsButton');
        this.canvas = document.getElementById('staffCanvas');
        this.statusLabel = document.getElementById('statusLabel');
        this.scoreLabel = document.getElementById('scoreLabel');
        this.hintDisplay = document.getElementById('hintDisplay');

        // Direct event binding for start button
        if (this.startButton) {
            this.startButton.onclick = (e) => {
                e.preventDefault();
                this.startPractice();
            };
        }
        
        // Initialize canvas without recursion
        this.ctx = this.canvas.getContext('2d');
        this.setCanvasSize();
        
        // Load bass clef image
        this.bassClefImage = new Image();
        this.bassClefImage.src = 'bassclef.png';

        // Force initial draw
        this.drawStaff();
        this.drawTrebleClef();
    }

    // New method to handle canvas sizing without recursion
    setCanvasSize() {
        if (!this.ctx || !this.canvas) return;
        
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set physical dimensions
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Set display size
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        
        // Force redraw
        this.redraw();
    }

    setupEventListeners() {
        // Remove old start button binding and use direct assignment
        this.startButton.onclick = () => this.startPractice();
        this.settingsButton.onclick = () => this.showSettings();

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
        document.getElementById('toggleFullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('reinitCanvasBtn').addEventListener('click', () => this.reinitializeCanvas());
        
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
        console.log('Force starting practice...');
        
        // Force switch to main app view
        this.mainMenu.style.display = 'none';
        this.mainApp.style.display = 'flex';
        this.settingsMenu.style.display = 'none';
        
        // Remove all hidden classes
        this.mainMenu.classList.add('hidden');
        this.mainApp.classList.remove('hidden');
        this.settingsMenu.classList.add('hidden');
        
        // Force initialize with defaults
        this.practiceMode = 'treble-all';
        this.currentNote = null;
        this.correctCount = 0;
        this.isStarted = true;
        
        // Initialize game systems
        this.initializeNoteRange();
        this.setupAudioDetection();
        
        // Force a note and redraw
        this.nextNote();
        this.reinitializeCanvas();
        
        this.statusLabel.textContent = '🎹 Play the note shown above';
        console.log('Practice force started');
    }

    initializeNoteRange() {
        const notesByMode = {
            'all': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
            'staff': ['E4', 'G4', 'B4', 'D5', 'F5'],
            'spaces': ['F4', 'A4', 'C5', 'E5'],
            'ledger': ['C4', 'D4', 'A5'],
            'bass-all': ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
            'bass-staff': ['G2', 'B2', 'D3', 'F3', 'A3'],
            'bass-spaces': ['A2', 'C3', 'E3', 'G3']
        };
        
        this.noteRange = notesByMode[this.practiceMode] || notesByMode['all'];
        this.isBassClef = this.practiceMode.startsWith('bass-');
        
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
            
            // Play sound immediately on correct note
            this.playCurrentNote();
            
            setTimeout(() => {
                this.nextNote();
                this.statusLabel.textContent = '🎹 Play the note shown above';
                this.statusLabel.style.color = '#9696ff';
            }, 1000); // Reduced delay
        } else {
            // Show ghost note for wrong answer
            this.ghostNote = detectedNote;
            this.ghostNoteOpacity = 0.6;  // Start fade
            
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
    }

    saveSettings() {
        const settings = {
            volume: document.getElementById('volumeSlider').value,
            largeNotes: document.getElementById('largeNotes').checked,
            fullscreen: document.getElementById('fullscreenMode').checked
        };
        localStorage.setItem('trebleClefSettings', JSON.stringify(settings));
        this.hideSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('trebleClefSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                document.getElementById('volumeSlider').value = settings.volume || 70;
                document.getElementById('volumeValue').textContent = `${settings.volume || 70}%`;
                document.getElementById('largeNotes').checked = settings.largeNotes || false;
                document.getElementById('fullscreenMode').checked = settings.fullscreen !== false;
            } catch (e) {
                console.warn('Failed to load settings:', e);
            }
        }
    }

    returnToMenu() {
        // Reset state
        this.currentNote = null;
        this.correctCount = 0;
        this.isStarted = false;
        
        // Update UI
        this.scoreLabel.textContent = '🏆 Score: 0';
        this.statusLabel.textContent = 'Initializing...';
        this.statusLabel.style.color = '#b4b4be';
        this.hintDisplay.classList.add('hidden');
        
        // Stop audio detection
        this.audioDetector.stopListening();
        
        // Switch views
        this.mainApp.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
        this.settingsMenu.classList.add('hidden');
        
        // Force redraw of menu state
        this.redraw();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setTimeout(() => this.setupCanvas(), 100);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => this.setupCanvas(), 100);
            });
        }
    }

    reinitializeCanvas() {
        // Clear any existing context
        this.ctx = null;
        
        // Get fresh context
        this.canvas = document.getElementById('staffCanvas');
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });
        
        // Resize without recursion
        this.setCanvasSize();
        
        // Mark as initialized
        this.canvasInitialized = true;
        
        console.log('Canvas reinitialized');
    }

    setupCanvas() {
        // Initialize on startup
        if (!this.canvasInitialized) {
            this.reinitializeCanvas();
        }

        // Handle screen changes
        window.addEventListener('resize', () => this.setCanvasSize());
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => this.setCanvasSize(), 100);
        });
    }

    addIPadFullscreenButton() {
        const button = document.createElement('button');
        button.className = 'control-button';
        button.textContent = '📱 Fullscreen';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.zIndex = '1000';
        
        button.addEventListener('click', () => {
            if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            }
        });
        
        document.body.appendChild(button);
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
        const staffSpacing = 80; // Reduced from 100 to give more vertical room
        const centerY = this.canvas.height / 2;
        const startY = centerY - (staffSpacing * 2);
        const startX = 150; // Large margin
        const staffWidth = this.canvas.width - 300;

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 4;

        for (let i = 0; i < staffLines; i++) {
            const y = Math.round(startY + i * staffSpacing);
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(startX + staffWidth, y);
            this.ctx.stroke();
        }
    }

    drawTrebleClef() {
        if (!this.ctx) return;
        
        this.ctx.save();
        const startX = Math.round(this.canvas.width * 0.15);
        const centerY = Math.round(this.canvas.height / 2);
        const clefSize = 320; // Increased from 200
        
        if (this.isBassClef && this.bassClefImage.complete) {
            this.ctx.drawImage(
                this.bassClefImage,
                startX - clefSize/2,
                centerY - clefSize/2,
                clefSize,
                clefSize
            );
        } else {
            this.ctx.fillStyle = '#000000';  // Black color
            this.ctx.font = `bold ${clefSize}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('𝄞', startX, centerY);
        }
        
        this.ctx.restore();
    }

    drawNote(noteName) {
        const noteX = Math.round(this.canvas.width * 0.65);
        const verticalOffset = -0; // Increased upward shift to prevent cropping
        const noteY = Math.round(this.getNoteYPosition(noteName)) + verticalOffset;
        const noteSize = 45;  // Base note size
        const stemLength = 180;
        
        if (this.isCorrectAnimation && this.noteGlow > 0) {
            this.ctx.fillStyle = `rgba(0, 255, 136, ${this.noteGlow * 0.7})`;
            for (let i = 10; i >= 1; i--) {
                this.ctx.beginPath();
                this.ctx.ellipse(noteX, noteY, noteSize + i*2, (noteSize + i*2) * 0.4, 0, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        
        let noteColor = '#000000';
        if (this.isCorrectAnimation) {
            noteColor = '#00ff88';
        } else if (this.isWrongAnimation) {
            const pulse = Math.sin(Date.now() * 0.02) * 80 + 175;
            noteColor = `rgb(${pulse}, 40, 40)`;
        }
        
        // Draw single note head - adjust 0.7 to change oval height
        this.ctx.fillStyle = noteColor;
        this.ctx.beginPath();
        this.ctx.ellipse(noteX, noteY, noteSize, noteSize * 0.7, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw stem
        this.ctx.strokeStyle = noteColor;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        
        // Draw stem based on note position
        const centerY = this.canvas.height / 2;
        if (noteY > centerY) {
            this.ctx.moveTo(noteX + noteSize * 0.9, noteY);
            this.ctx.lineTo(noteX + noteSize * 0.9, noteY - stemLength);
        } else {
            this.ctx.moveTo(noteX - noteSize * 0.9, noteY);
            this.ctx.lineTo(noteX - noteSize * 0.9, noteY + stemLength);
        }
        this.ctx.stroke();
        
        this.drawLedgerLines(noteX, noteY, noteSize);
        
        // Draw ghost note if exists
        if (this.ghostNote && this.ghostNoteOpacity > 0) {
            const ghostX = Math.round(this.canvas.width * 0.45); // Left of main note
            const ghostY = Math.round(this.getNoteYPosition(this.ghostNote));
            
            // Draw ghost note with transparency
            this.ctx.globalAlpha = this.ghostNoteOpacity;
            this.ctx.fillStyle = '#ff6464';  // Red tint
            this.ctx.beginPath();
            this.ctx.ellipse(ghostX, ghostY, noteSize * 0.8, noteSize * 0.8 * 0.7, 0, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Draw ghost stem
            this.ctx.strokeStyle = '#ff6464';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            if (ghostY > this.canvas.height / 2) {
                this.ctx.moveTo(ghostX + noteSize * 0.7, ghostY);
                this.ctx.lineTo(ghostX + noteSize * 0.7, ghostY - stemLength * 0.8);
            } else {
                this.ctx.moveTo(ghostX - noteSize * 0.7, ghostY);
                this.ctx.lineTo(ghostX - noteSize * 0.7, ghostY + stemLength * 0.8);
            }
            this.ctx.stroke();
            
            // Draw ghost ledger lines if needed
            this.drawLedgerLines(ghostX, ghostY, noteSize * 0.8);
            
            this.ctx.globalAlpha = 1.0;  // Reset transparency
            
            // Fade out ghost note
            this.ghostNoteOpacity = Math.max(0, this.ghostNoteOpacity - 0.002);
        }
    }

    getNoteYPosition(noteName) {
        const staffSpacing = 80; // Match new staff spacing
        const centerY = this.canvas.height / 2;
        const bottomLine = centerY + (staffSpacing * 2);
        
        const treblePositions = {
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
        
        const bassPositions = {
            'G2': bottomLine + staffSpacing * 1.5,
            'A2': bottomLine + staffSpacing,
            'B2': bottomLine + staffSpacing * 0.5,
            'C3': bottomLine,
            'D3': bottomLine - staffSpacing * 0.5,
            'E3': bottomLine - staffSpacing,
            'F3': bottomLine - staffSpacing * 1.5,
            'G3': bottomLine - staffSpacing * 2,
            'A3': bottomLine - staffSpacing * 2.5,
            'B3': bottomLine - staffSpacing * 3,
            'C4': bottomLine - staffSpacing * 3.5,
            'D4': bottomLine - staffSpacing * 4,
            'E4': bottomLine - staffSpacing * 4.5
        };
        
        return (this.isBassClef ? bassPositions : treblePositions)[noteName] || bottomLine;
    }

    drawLedgerLines(noteX, noteY, noteSize) {
        const staffSpacing = 80; // Match staff spacing
        const centerY = Math.round(this.canvas.height / 2);
        const staffTop = Math.round(centerY - (staffSpacing * 2));
        const staffBottom = Math.round(centerY + (staffSpacing * 2));
        const lineLength = Math.round(noteSize * 2.5); // Adjusted for new note size
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3; // Match staff line width
        
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
