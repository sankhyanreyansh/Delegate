# Mandate

> **An AI meeting representative you can rehearse, constrain, and audit before it speaks for you.**

Mandate is for professional meetings a person cannot attend. The owner prepares a
brief with their position, approved references, delegated authority, and escalation
boundaries. Mandate then joins a Zoom meeting as a participant, listens and speaks
in the call, and records the basis for every substantive response.

## Why it is different

Most meeting AI produces a recap after the meeting. Mandate is designed to
represent an approved position during the meeting without improvising authority.

1. **Brief-led representation** — Mandate starts from the owner’s stated goal,
   position, allowed actions, and escalation boundaries.
2. **Evidence receipts** — substantive replies cite the exact retrieved excerpt
   that supported them; ordinary interaction such as identity or hearing a question
   is answered naturally without invented facts.
3. **Rehearsal before delegation** — test generated and manually entered questions
   to see whether Mandate would answer, cite a source, defer, or decline.
4. **Live control and record** — Mandate joins Zoom directly, keeps a live
   transcript and decision ledger, then produces a PDF report.

Mandate does not expose private model chain-of-thought. Its transparency is a
visible decision basis: response type, authority outcome, and cited source excerpt.

## What is implemented

- Meeting briefs with multiple sources, owner position, authority, escalation
  boundaries, tone, and a Zoom link. PDFs, DOCX files, and text references are
  extracted into the local brief before retrieval; raw uploaded files are not kept
  by the server.
- Source chunking, retrieval, evidence receipts, and a separate authority/evidence
  verification pass before a substantive spoken reply.
- Pre-meeting rehearsal with AI-generated and manual questions.
- A real **Zoom bot route** using Attendee’s bidirectional raw-audio WebSocket:
  Attendee joins Zoom, streams meeting PCM to Mandate, and receives Mandate’s
  speech PCM back into the same meeting.
- Deepgram Flux STT for conversational end-of-turn detection and Deepgram Flux TTS
  for live Zoom speech. Demo Mode retains browser microphone capture with stable
  Nova/Aura models.
- Live dashboard events through Server-Sent Events: bot status, transcript,
  interim speech, evidence receipt, escalation, and decision ledger.
- Local browser storage and a generated post-meeting PDF report.
- A friction-free Demo Mode that requires no Zoom meeting.

## Architecture

```text
Zoom participant
      │
      ▼
Attendee Zoom bot ── raw PCM WebSocket ──► Mandate server
                                                │
                                                ▼
                                   Deepgram Flux STT (turn detection)
                                                │
                                                ▼
                         RAG over brief + sources → Gemini decision + verifier
                                                │
                                                ▼
                                   Deepgram Flux TTS (raw PCM)
                                                │
                                                ▼
                         Attendee injects Mandate's audio into Zoom
```

The browser owns local meeting briefs and the dashboard. The Node server keeps
only active live-session state in memory and coordinates Attendee, Deepgram,
Gemini, evidence validation, and report generation.

## Built with Codex and GPT-5.6

Codex accelerated the entire workflow: ideation, competitive research, product
scope, information architecture, responsive UI, brief schema, evidence-retrieval
and verification pipeline, rehearsal UX, Attendee/Zoom audio integration, PDF
reporting, testing, and documentation.

Key product decisions made with Codex:

- Build a bounded representative instead of a personality clone.
- Make every substantive response inspectable through source and authority receipts.
- Treat a deferral as a successful safety outcome, not a failure to answer.
- Rehearse edge cases before a delegate enters a meeting.
- Replace local audio routing with a real hosted Zoom meeting bot.

**Hackathon runtime plan:** GPT-5.6 will replace Gemini for the delegate,
verification, rehearsal, and report-generation calls before submission. GPT-5.6
Luna is the intended live-delegate model and GPT-5.6 Sol the intended quality-first
model for rehearsal and reports. The checked-in implementation currently uses
`gemini-3.1-flash-lite`, as labelled below; do not claim that the deployed runtime
uses GPT-5.6 until that migration is complete.

## Run locally

### Prerequisites

- Node.js 20+
- Python 3
- A Gemini API key for the current runtime
- A Deepgram API key
- An Attendee account and API key for the real Zoom workflow
- A public HTTPS address that reaches this Node server for Full Use Mode

### 1. Install dependencies

```bash
cp .env.example .env
python3 -m venv .venv
.venv/bin/python -m pip install reportlab
npm install
```

### 2. Configure `.env`

For Demo Mode, set at least:

```dotenv
GEMINI_API_KEY=your_gemini_key
DEEPGRAM_API_KEY=your_deepgram_key
REPORT_PYTHON=.venv/bin/python
```

For the real Zoom workflow, also set:

```dotenv
ATTENDEE_API_KEY=your_attendee_api_key
ATTENDEE_WEBHOOK_SECRET=your_attendee_webhook_secret
PUBLIC_BASE_URL=https://your-public-https-url
```

Keep the Flux defaults from `.env.example` unless you deliberately choose another
supported Flux voice/model. Never commit `.env`.

### 3. Start Mandate

```bash
npm run check
npm start
```

Open [http://localhost:4242](http://localhost:4242).

`npm run verify` additionally checks Gemini, Deepgram browser models, Deepgram Flux
connections, Attendee configuration, and the PDF renderer. Run it after every key
and public URL is configured.

## Full Use Mode: Zoom setup

Attendee must reach Mandate over public HTTPS/WSS. During development, expose the
locally running server with a Cloudflare Tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:4242
```

Copy the resulting `https://…trycloudflare.com` URL into `PUBLIC_BASE_URL`, restart
`npm start`, then use **Use with Zoom** in Mandate.

In Attendee’s dashboard:

1. Create an API key and set it as `ATTENDEE_API_KEY`.
2. Open **Settings → Webhooks**, copy the project webhook secret, and set it as
   `ATTENDEE_WEBHOOK_SECRET`. It is Base64 text: keep it unchanged, including a
   trailing `/`, `+`, or `=` if present.
3. Open **Settings → Credentials** and add the same `DEEPGRAM_API_KEY` used by
   Mandate. Attendee requires its own stored transcription credential to provision
   Zoom bots.
4. Add Zoom credentials in Attendee's **Settings → Credentials**. Create a Zoom
   Marketplace **General App**, copy its Client ID and Client Secret, and enable its
   **Meeting SDK** capability. These credentials are stored in Attendee, not in
   Mandate's `.env`.

Then, in Mandate:

1. Open **Use with Zoom** and create a meeting brief.
2. Open its **Live delegate** page and click **Launch to Zoom**.
3. Paste a normal `https://…zoom.us/...` meeting link, acknowledge participant
   disclosure, and launch.
4. Mandate will join the meeting as `Mandate — [Owner]'s delegate`. Admit it if the
   meeting uses a waiting room.
5. Address **“Delegate”** before a question. The dashboard will display the live
   transcript, response receipt, citations, and any deferral while Mandate speaks
   through Zoom.

There is no BlackHole setup and no browser microphone requirement in Full Use Mode.
Attendee requires Zoom app credentials even for the ordinary guest-joinable demo
route; these let Attendee provision the Zoom meeting bot. A dedicated signed-in Zoom
identity (ZAK flow) is a separate, optional addition for meetings that forbid guest
participants entirely.

## Sample test brief

| Field | Value |
| --- | --- |
| Your name | Alex Rivera |
| Meeting name | Product launch decision |
| Goal | Decide whether the feature can launch next month. |
| Position | Protect reliability before adding new commitments. Do not commit to a launch date until engineering validates remaining risks. |
| May do | Recommend resolving reliability risks first; Ask for an engineering estimate |
| Must escalate | New budget; Revised launch commitment; Contractual commitment |

Add a source called **Product priorities**:

> Reliability is the first priority for the current release. The engineering team
> must estimate and mitigate outstanding incident risks before leadership commits
> to a launch date.

Test:

1. “Delegate, can we launch next month?” — grounded reply with a citation.
2. “Delegate, can you hear me?” — natural basic interaction, no invented meeting claim.
3. “Delegate, can you approve an extra $50,000?” — deferral to the owner.

Use **Rehearse** before launching, click a source receipt after a response, and
export the PDF from **Commitment ledger**.

## Repository map

```text
public/                 Browser dashboard, landing page, styles, and assets
server.mjs              Gemini, retrieval, verification, Attendee, Deepgram, PDF APIs
scripts/generate_report.py
                        PDF renderer
scripts/verify.mjs      Provider/configuration checks
.env.example            Configuration template
```

## MVP limitations

- Briefs, records, and reports are local to the current browser; live session
  state exists only while the Node server is running.
- The MVP targets Zoom only.
- Attendee may need to be admitted through a waiting room.
- The owner remains responsible for approvals and consequential decisions.
- Sources and meeting content are sent to Gemini and Deepgram when those services
  are used; review organisational consent and data-handling requirements before
  using real meetings.

## Submission checklist

- [ ] Migrate all Gemini runtime calls to GPT-5.6 and update this README accurately.
- [ ] Record a public under-three-minute demo: brief → rehearsal → Zoom join →
  grounded answer → deferral → PDF record.
- [ ] Add the public deployment/demo URL and repository URL to Devpost.
- [ ] Include the Codex `/feedback` session ID used for the core build.
- [ ] Confirm the demo and README describe only functionality that actually works.
