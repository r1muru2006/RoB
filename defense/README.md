# RoB Defense System

Defense solutions against browser-based ransomware (RoB) based on the USENIX Security 2023 paper.

## Three Defense Approaches

### Approach 1: Malicious Modification Identification
Detects ransomware by analyzing entropy and file size changes between original and modified files using ML classifiers (RF, KNN, DT, XGBoost). Includes a Chrome extension that hooks FSA API calls to intercept and analyze writes in real-time.

### Approach 2: Local Activity Monitoring
Monitors FSA API call sequences, system calls, and file system activities. Uses n-gram analysis and Euclidean distance similarity matrices to distinguish benign web apps from ransomware patterns.

### Approach 3: New UI Design
Redesigns FSA API permission dialogs to better inform users about risks. Adds warning icons, explicit mentions of subdirectory access, and lists of impacted files.

## Setup

```bash
cd defense
pip install -r requirements.txt
```

## Usage

### Approach 1
```bash
cd approach1-modification-detection
python dataset/generate_samples.py
python features/extract.py
python classifier/train.py
python classifier/evaluate.py
python evasion/generate_evasion.py
python evasion/test_evasion.py
```

### Approach 2
```bash
cd approach2-activity-monitoring
python generate_sample_data.py
python analysis/ngram.py
python analysis/similarity.py
python analysis/heatmap.py
```

### Approach 3
Open `approach3-new-ui/mockups/generate_mockups.html` in a browser to see the UI comparison.

### Chrome Extensions
Load any of the `browser_extension/` or `chrome_extension/` directories as unpacked extensions in Chrome (`chrome://extensions` > Developer mode > Load unpacked).
