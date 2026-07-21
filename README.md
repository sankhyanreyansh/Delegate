# Delegate

> An AI meeting representative that only answers from evidence, can present a live browser, and defer when approval is needed.

Delegate converses at natural human speed in online meetings, and represents the user's prepared position. Before a meeting, users create a brief with goals, authority limits, screenshare instructions and reference documents. During the call, Delegate uses RAG and follows strict guardrails to answer queries, and defers commitments that require the owner's decision. When enabled in the brief, it can also operate a controlled virtual browser to visibly navigate webpages, documentation, and workflows in real time. A live transcript and downloadable after-meeting report make the process fully transparent.

## Built with

- **GPT-5.6 Luna** for grounded responses, authority checks, rehearsal, and reports.
- **OpenAI embeddings** for semantic retrieval over meeting references.
- **Deepgram Flux** for low-latency real-time speech-to-text and text-to-speech in both Demo and Zoom modes.
- **Attendee.dev** for bidirectional Zoom participation.
- **Browserbase** for opt-in, GPT-5.6-powered live browser walkthroughs presented through Delegate's Zoom video.
- **JavaScript + Node.js** for the full-stack application.

## Run locally

### Prerequisites

- Node.js 20.19+
- Python 3
- OpenAI, Deepgram, and Browserbase API keys
- A Browserbase project ID for live browser presentation
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

For **Interactive Demo Mode**, set `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `REPORT_PYTHON=.venv/bin/python` in `.env`.

For **Zoom Mode**, also set `ATTENDEE_API_KEY`, `ATTENDEE_WEBHOOK_SECRET`, and a public HTTPS `PUBLIC_BASE_URL`. Browser presentation uses the same Delegate video session rather than a separate native Zoom screen-share stream. See `.env.example` for all configuration options.

No external sample data is required: create a brief and add a text reference directly in the app. Run `npm run verify` after configuring providers to verify OpenAI, Deepgram, Attendee, and PDF reporting.

## Built with Codex and GPT-5.6

Delegate was built completely with Codex, using both **GPT-5.6 Terra** and **GPT-5.6 Luna**. Luna accelerated planning, UI iteration and small targeted fixes. Terra was used for the core architecture: retrieval and guardrail logic, real-time audio flow, Zoom integration, and open ended debugging.

Codex accelerated the entire development process significantly. I used it to research APIs, evaluate tradeoffs between different architectures, implementing said architectures. It also helped greatly by giving suggestions for UI design and simplifying the user workflow. I even used Codex to generate the first minute of my demo video using Hyperframes. Thank you OpenAI for making this possible.

## Hackathon links

- Demo video: `https://www.youtube.com/watch?v=x5QBXMjG40M`
- Live demo: `https://delegate-ai.onrender.com/`
- Codex /feedback Session ID: `019f6641-26e2-7fc1-9f03-de684e46eb51`
