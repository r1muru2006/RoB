# RoB: Ransomware over Modern Web Browsers

Educational research project that reproduces and studies the browser-based
ransomware threat model described in the USENIX Security 2023 RoB paper. The
repository contains a controlled proof-of-concept attack flow and several
defense prototypes for detecting or reducing File System Access API abuse.

> Safety note: run this project only in an isolated lab/VM and only against
> disposable test folders. Do not run the attack demo on personal or production
> files.

## Repository Structure

```text
.
├── attack/
│   ├── client/          # Browser demo that exercises File System Access API
│   └── server/          # Express backend for victim registration and ransom page
├── defense/
│   ├── approach1-modification-detection/
│   ├── approach2-activity-monitoring/
│   └── approach3-new-ui/
├── paper.txt
├── prompt.md
└── TODO.md
```

## Attack Demo

The attack side is a simulation used to generate behavior for analysis and
defense testing.

### Backend

```bash
cd attack/server
npm install
npm start
```

The server starts on `http://localhost:3000` by default.

Available routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/register` | Creates a victim ID and RSA key pair, then returns the public key. |
| `GET` | `/api/ransom/:victimId` | Renders the ransom-note demo page for a known victim ID. |
| `POST` | `/api/decrypt-key/:victimId` | Simulates payment verification and returns the private key for the demo. |

### Client

The client must starts on `http://localhost:5500` 
```bash
cd attack/client
python -m http.server 5500
```

Use only a throwaway folder with copied sample files. The demo overwrites
supported files during the simulated encryption flow.

Supported target extensions in the current client:

```text
.docx, .xlsx, .pdf, .txt, .jpeg, .png
```

## Defense Prototypes

See [defense/README.md](defense/README.md) for setup and usage details.

Summary:

| Approach | Directory | Description |
| --- | --- | --- |
| 1 | `defense/approach1-modification-detection` | Detects malicious file modification using entropy and file-size features. |
| 2 | `defense/approach2-activity-monitoring` | Monitors FSA API activity and compares call sequences with n-gram similarity. |
| 3 | `defense/approach3-new-ui` | Experiments with safer permission-dialog UI for risky directory access. |

## Tests

Backend tests:

```bash
cd attack/server
npm test
```

Current tests cover the three backend API routes. Be careful when expanding the
suite: tests should use temporary fixtures or a temporary database file so they
do not overwrite tracked demo files.

## Development Notes

- Keep `attack/server/node_modules/` out of reviews and commits when possible.
- Treat `attack/server/db/victims.json` as demo state, not durable storage.
- Prefer isolated test data for all ransomware-flow experiments.
- Chrome extensions under `defense/` can be loaded from `chrome://extensions`
  with Developer mode enabled and "Load unpacked".

## Ethics

This repository is for security research, education, and defense evaluation.
Do not use it to target systems or data you do not own or have explicit
permission to test.
