class AdaptiveDifficultyManager {
    constructor() {
        this.noteAttempts = new Map();
        this.noteCorrect = new Map();
        this.lastPracticed = new Map();
        this.loadFromStorage();
    }

    initializeNote(noteName) {
        if (!this.noteAttempts.has(noteName)) {
            this.noteAttempts.set(noteName, 0);
            this.noteCorrect.set(noteName, 0);
        }
    }

    recordAttempt(noteName, correct) {
        this.noteAttempts.set(noteName, (this.noteAttempts.get(noteName) || 0) + 1);
        if (correct) {
            this.noteCorrect.set(noteName, (this.noteCorrect.get(noteName) || 0) + 1);
        }
        this.lastPracticed.set(noteName, Date.now());
        this.saveToStorage();
    }

    getAccuracy(noteName) {
        const attempts = this.noteAttempts.get(noteName) || 0;
        const correct = this.noteCorrect.get(noteName) || 0;
        return attempts > 0 ? correct / attempts : 0.5;
    }

    selectAdaptiveNote(noteRange) {
        // Calculate weights for each note (lower accuracy = higher weight)
        const noteWeights = new Map();
        let totalWeight = 0;

        for (const noteName of noteRange) {
            const attempts = this.noteAttempts.get(noteName) || 0;
            const accuracy = this.getAccuracy(noteName);
            
            // Base weight on accuracy (lower accuracy = higher weight)
            let weight = Math.max(0.1, 1.0 - accuracy);
            
            // Boost weight for notes that haven't been practiced much
            if (attempts < 5) {
                weight *= 1.5;
            }
            
            // Boost weight for notes not practiced recently
            const lastTime = this.lastPracticed.get(noteName) || 0;
            const timeSince = Date.now() - lastTime;
            if (timeSince > 300000) { // 5 minutes
                weight *= 1.2;
            }
            
            noteWeights.set(noteName, weight);
            totalWeight += weight;
        }

        // Weighted random selection
        let randomValue = Math.random() * totalWeight;
        
        for (const noteName of noteRange) {
            randomValue -= noteWeights.get(noteName);
            if (randomValue <= 0) {
                return noteName;
            }
        }
        
        // Fallback
        return noteRange[Math.floor(Math.random() * noteRange.length)];
    }

    getNotesNeedingPractice(noteRange) {
        return noteRange
            .sort((a, b) => this.getAccuracy(a) - this.getAccuracy(b))
            .slice(0, 5);
    }

    getProgressSummary(noteRange, currentScore) {
        let summary = '📈 SESSION STATISTICS\n\n';
        summary += `Current Score: ${currentScore}\n`;
        summary += `Session Time: ${new Date().toLocaleTimeString()}\n\n`;
        
        const needsPractice = this.getNotesNeedingPractice(noteRange);
        
        if (needsPractice.length > 0 && this.noteAttempts.get(needsPractice[0]) > 0) {
            summary += '🎯 NOTES TO PRACTICE:\n';
            for (const note of needsPractice) {
                const attempts = this.noteAttempts.get(note) || 0;
                const accuracy = this.getAccuracy(note);
                if (attempts > 0) {
                    summary += `• ${note}: ${(accuracy * 100).toFixed(1)}% (${attempts} attempts)\n`;
                }
            }
        } else {
            summary += '🎉 Great job! Keep practicing to see detailed stats.';
        }
        
        return summary;
    }

    saveToStorage() {
        const data = {
            noteAttempts: Array.from(this.noteAttempts.entries()),
            noteCorrect: Array.from(this.noteCorrect.entries()),
            lastPracticed: Array.from(this.lastPracticed.entries())
        };
        localStorage.setItem('trebleClefProgress', JSON.stringify(data));
    }

    loadFromStorage() {
        const saved = localStorage.getItem('trebleClefProgress');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.noteAttempts = new Map(data.noteAttempts || []);
                this.noteCorrect = new Map(data.noteCorrect || []);
                this.lastPracticed = new Map(data.lastPracticed || []);
            } catch (e) {
                console.warn('Failed to load progress data:', e);
            }
        }
    }

    exportToJSON() {
        return JSON.stringify({
            noteAttempts: Object.fromEntries(this.noteAttempts),
            noteCorrect: Object.fromEntries(this.noteCorrect),
            lastPracticed: Object.fromEntries(this.lastPracticed)
        });
    }
}
