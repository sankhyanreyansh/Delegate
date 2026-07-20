# Delegate

> An AI meeting agent you can trust to represent your position: evidence-backed answers, clear authority boundaries, and real-time deferrals when approval is needed.

Delegate joins Zoom meetings, listens and speaks in real time, and represents the user's prepared position. Before a meeting, users create a brief with goals, authority limits, and reference documents. During the call, Delegate retrieves supporting evidence, always cites it for substantive answers, and defers commitments that require the owner's decision. A live transcript, and downloadable report make each outcome inspectable.

## Built with

- **GPT-5.6 Luna** for grounded responses, authority checks, rehearsal, and reports.
- **OpenAI embeddings** for semantic retrieval over meeting references.
- **Deepgram Flux** for low-latency real-time speech-to-text and text-to-speech in both Demo and Zoom modes.
- **Attendee.dev** for bidirectional Zoom participation.
- **Browserbase + Stagehand** for opt-in, GPT-5.6-powered live browser walkthroughs and screen sharing in Zoom.
- **JavaScript + Node.js** for the full-stack application.

## Run locally

### Prerequisites

- Node.js 20.19+
- Python 3
- OpenAI and Deepgram API keys
- Attendee.dev credentials for Zoom mode

```bash
git clone https://github.com/sankhyanreyansh/Delegate.git
cd Delegate
cp .env.example .env
python3 -m venv .venv
.venv/bin/python -m pip install reportlab
npm install
npm run check
npm start
```

Open [http://localhost:4242](http://localhost:4242).

For **Interactive Demo Mode**, set `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, and `REPORT_PYTHON=.venv/bin/python` in `.env`. To start the live browser presentation in the demo, also set `BROWSERBASE_API_KEY`.

For **Zoom Mode**, also set `ATTENDEE_API_KEY`, `ATTENDEE_WEBHOOK_SECRET`, and a public HTTPS `PUBLIC_BASE_URL`. When a meeting brief has **Enable Delegate’s live browser presentation** turned on, set `BROWSERBASE_API_KEY` (and `BROWSERBASE_PROJECT_ID` if your key does not imply a project). See `.env.example` for all configuration options. Never commit `.env`.

No external sample data is required: create a brief and add a text reference directly in the app. Run `npm run verify` after configuring providers to verify OpenAI, Deepgram, Attendee, and PDF reporting.

## Built with Codex and GPT-5.6

Delegate was built primarily with Codex using **GPT-5.6 Terra**. Light reasoning mode accelerated planning, UI iteration and targeted fixes. Extra High reasoning mode was used for the core architecture: retrieval and authority logic, real-time audio flow, Zoom integration, debugging, and verification.

Codex accelerated the entire development process significantly. I used it to research APIs, evaluate tradeoffs between different architectures, implementing said architectures. It also helped greatly in UI design and simplifying the user workflow.

## Hackathon links

- Demo video: `<ADD_PUBLIC_YOUTUBE_URL>`
- Live demo: `https://delegate-ai.onrender.com/`
- Codex `/feedback` Session ID: `019f6641-26e2-7fc1-9f03-de684e46eb51`
