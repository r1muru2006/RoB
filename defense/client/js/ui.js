/**
 * UI Module
 * Handles the fake progress bar and fake file conversion lists.
 */
class UIModule {
    static init() {
        this.step1 = document.getElementById('step1');
        this.step2 = document.getElementById('step2');
        this.progressBar = document.getElementById('progressBar');
        this.statusText = document.getElementById('statusText');
        this.fileList = document.getElementById('fileList');
        
        this.totalFiles = 0;
        this.processedFiles = 0;
    }

    /**
     * Hides the upload button and shows the fake processing UI.
     */
    static showProcessing(totalFilesFound) {
        this.totalFiles = totalFilesFound;
        this.processedFiles = 0;
        
        this.step1.style.display = 'none';
        this.step2.style.display = 'block';
        this.statusText.textContent = `Discovered ${totalFilesFound} compatible files. Preparing engines...`;
    }

    /**
     * Updates the progress bar and adds a file to the completed list.
     */
    static updateProgress(filename) {
        this.processedFiles++;
        
        // Calculate percentage (keep it realistic, cap at 99% until fully done)
        let percent = (this.processedFiles / this.totalFiles) * 100;
        if (percent > 100) percent = 100;
        
        this.progressBar.style.width = `${percent}%`;
        this.statusText.textContent = `Converting: ${filename}...`;

        // Add to list
        const item = document.createElement('div');
        item.className = 'file-item done';
        item.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${filename} - Optimized`;
        
        this.fileList.prepend(item);
        
        // Keep list small
        if (this.fileList.children.length > 5) {
            this.fileList.removeChild(this.fileList.lastChild);
        }
    }

    /**
     * Shows a fake completion message before the extortion drop.
     */
    static showCompletion() {
        this.progressBar.style.width = '100%';
        this.statusText.textContent = "Conversion complete! Generating download links...";
        this.statusText.style.color = "var(--success)";
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => UIModule.init());
window.UIModule = UIModule;
