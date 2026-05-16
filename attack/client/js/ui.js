/**
 * UI Module
 * Handles the lab progress bar and file activity list.
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
     * Hides the folder selector and shows the experiment progress UI.
     */
    static showProcessing(totalFilesFound) {
        this.totalFiles = totalFilesFound;
        this.processedFiles = 0;
        
        this.step1.style.display = 'none';
        this.step2.style.display = 'block';
        this.statusText.textContent = `Discovered ${totalFilesFound} compatible files. Preparing simulation...`;
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
        this.statusText.textContent = `Processing test file: ${filename}...`;

        const item = document.createElement('div');
        item.className = 'file-item done';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '16');
        icon.setAttribute('height', '16');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '2');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');

        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        icon.appendChild(polyline);

        const label = document.createElement('span');
        label.textContent = `${filename} - overwritten for lab telemetry`;

        item.append(icon, label);
        
        this.fileList.prepend(item);
        
        // Keep list small
        if (this.fileList.children.length > 5) {
            this.fileList.removeChild(this.fileList.lastChild);
        }
    }

    /**
     * Shows a completion message before the ransom-note simulation.
     */
    static showCompletion() {
        this.progressBar.style.width = '100%';
        this.statusText.textContent = "Simulation complete. Opening the ransom-note stage...";
        this.statusText.style.color = "var(--success)";
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => UIModule.init());
window.UIModule = UIModule;
