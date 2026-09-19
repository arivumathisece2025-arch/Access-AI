# Access AI

**See, speak, sign - accessibility without limits.**

Access AI is a multi-modal accessibility assistant that combines computer vision, speech recognition, and sign language translation into one offline-first platform. Built for HackSpora 2.0.

---

## The Problem

Existing solutions are fragmented:
- **Be My Eyes / Be My AI** - visual assistance only
- **Microsoft Seeing AI** - screen reader only
- **Ava** - live captions only
- **Signapse** - sign language only (BSL/ASL, not ISL)

None combine all four modalities. None run fully offline. None cost nothing to operate.

## The Solution

Access AI delivers **three capabilities in one app**:

1. **AI Screen Reader** - Point a camera at any scene. Florence-2 vision-language model describes it in natural language. RapidOCR extracts printed text. Edge-TTS speaks the result. **1.48s on GPU, zero cloud dependency.**

2. **Text to Speech** - Paste any text (medicine labels, exam questions, messages). Neural voices online, browser voices offline. **Never silent.**

3. **Speech to Sign Language** - Speak a phrase. Faster-whisper transcribes it. A validated Indian Sign Language phrasebook is ready to trigger recorded ISL clips with gloss captions. **Human signers, not synthetic avatars.** The 12 clips remain the final physical demo asset to record.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, Uvicorn, PyTorch 2.5.1 + CUDA 12.4 |
| **Vision** | Florence-2-base (fp16), RapidOCR (ONNX Runtime) |
| **Speech** | faster-whisper medium (fp16), edge-tts (Microsoft neural voices) |
| **Sign Language** | Phrasebook + fuzzy matching, 12 planned ISL MP4 clips |
| **Web Frontend** | React 18 + TypeScript, Vite, Framer Motion, Lucide icons |
| **Mobile** | Expo / React Native (thin client, zero ML on device) |
| **Auth** | SQLite + bcrypt hashes + JWT sessions + guest demo mode |
| **Compute** | NVIDIA RTX 4060 (8 GB VRAM) - 100% local inference |

---

## Performance (Measured)

| Metric | Value |
|---|---|
| Image query (fresh) | 1.48s |
| Image query (cached) | ~0s |
| TTS (30 KB audio) | 0.94-1.12s |
| Warmup (models in VRAM) | 1.8s |
| RSS memory | 1550 MB |
| Whisper model | medium (fp16) |

*Benchmarked with `backend/bench.py` on RTX 4060. Reproducible: run `python bench.py ..\docs\test.jpg` from `backend`.*

---

## Architecture

```text
+-----------------+         +-----------------+
| React Frontend  |-------->| FastAPI Backend |
| (3 tabs, auth)  |  HTTP   | (feature APIs)  |
+-----------------+         +--------+--------+
                                     |
                            +--------v--------+
                            |  GPU Inference  |
                            |  Florence-2     |
                            |  RapidOCR       |
                            |  faster-whisper|
                            |  edge-tts       |
                            +-----------------+
```

**Key design decisions:**
- **All inference local** - no vendor quotas, no per-query cost, works offline
- **Bounded TTL-LRU cache** - flat memory over hours of use
- **Semaphore-gated inference** - burst-safe under load
- **Temp files unlinked per request** - flat disk usage
- **Guest demo mode** - judges enter with one tap, no signup friction

---

## Quick Start

### Prerequisites
- Python 3.12
- Node.js 18+
- NVIDIA GPU with CUDA 12.4 (or CPU fallback)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# GPU only: swap to CUDA PyTorch
pip uninstall -y torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

python main.py
# Wait for: [startup] device=cuda / device=cpu
#           [startup] warmup done
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Click **Enter Demo Mode** to skip signup.

### Mobile (Optional)

```bash
cd mobile
npx expo start
```

Set the laptop LAN address in `mobile/App.tsx`, then scan the QR with Expo Go. Point at text, tap the button, and hear the description.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/auth/register` | POST | Create account (email + password) |
| `/auth/login` | POST | Sign in |
| `/auth/guest` | POST | One-tap demo token (no account) |
| `/auth/me` | GET | Current user (Bearer token required) |
| `/describe-image` | POST | Image -> caption + extracted text |
| `/speech-to-text` | POST | Audio -> transcription |
| `/speech-to-sign` | POST | Audio -> transcript + ISL phrase + clip |
| `/text-to-speech` | POST | Text -> MP3 audio blob |
| `/metrics` | GET | Live system metrics (device, RSS, uptime) |

---

## Accessibility

Access AI is an accessibility product. Our UI is itself accessible:
- **WCAG 2.1 AA target** - controls are keyboard-navigable with readable contrast
- **Screen reader support** - interactive elements have accessible names or visible text
- **Motion-safe** - animations respect `prefers-reduced-motion` and Framer Motion user settings
- **High contrast mode** - toggle in app, yellow-on-black for low-vision users
- **Scalable text** - A / A+ / A++ controls, tested at 130% text size

---

## Competitive Positioning

| Competitor | Their focus | Our advantage |
|---|---|---|
| Be My AI | Vision + conversation | We add **real ISL sign language** |
| Seeing AI | Screen reader | We add **speech-to-sign** for Deaf users |
| Google Lookout | Scene understanding | We run **100% offline** |
| Ava | Live captions | We add **vision + sign** beyond text |
| Signapse | Animated BSL/ASL | We use **real ISL clips** (human, not synthetic) |

**One-liner:** *Be My Eyes sees, Ava hears, Signapse signs - Access AI does all three, runs offline, and costs nothing to operate.*

---

## Project Structure

```text
Access-AI/
├── backend/
│   ├── main.py              # FastAPI app and feature endpoints
│   ├── auth.py              # SQLite + bcrypt + JWT
│   ├── signbook.py          # ISL phrasebook + fuzzy matcher
│   ├── bench.py             # Latency benchmark
│   ├── soak.py              # Sustained load test
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Auth-gated app shell
│   │   ├── components/
│   │   │   ├── AuthPage.tsx       # Login/signup + guest demo
│   │   │   ├── ScreenReader.tsx    # Camera/upload + describe
│   │   │   ├── TextToSpeech.tsx    # Text input + speak
│   │   │   └── SignTranslator.tsx  # Mic + ISL clips
│   │   └── lib/
│   │       ├── api.ts       # HTTP client
│   │       ├── auth.ts       # Auth persistence
│   │       └── speak.ts      # TTS with fallback chain
│   └── package.json
├── mobile/
│   ├── App.tsx              # Expo screen reader
│   └── package.json
└── docs/
    ├── BENCH.md             # Performance numbers
    ├── DEMO_REHEARSAL.md    # Three-minute pitch and clip checklist
    └── test.jpg             # Benchmark fixture
```

---

## License

MIT

---

**Built for HackSpora 2.0 by Access AI team.**
