# Mandate

> **An AI meeting representative that speaks from an approved brief, shows the source behind a substantive response, and defers decisions outside its authority.**

Mandate is for professional meetings a person cannot attend. Rather than only
recording and summarizing the conversation, it prepares a bounded representative:
the owner supplies a position, reference material, allowed actions, and escalation
boundaries. Mandate can then rehearse likely questions, listen and speak in a
meeting, attach a compact decision receipt to its responses, and create a
post-meeting PDF record.

## Why Mandate

Most AI meeting products answer: “What happened?” Mandate answers: “What was my
representative allowed to say, why did it say it, and what did it deliberately
return to me?”

Its core workflow is:

1. **Set the brief** — define the owner's position, sources, authority, and
   escalation boundaries.
2. **Rehearse the edge cases** — test whether Mandate would answer normally,
   cite evidence, or defer.
3. **Represent with a record** — use retrieved excerpts to ground substantive
   replies and preserve decisions, deferrals, and sources in the meeting record.

Mandate does not expose private model reasoning. Instead, every substantive
response receives an inspectable receipt that identifies its response type,
authority outcome, and cited source excerpt. Ordinary conversational interaction
(for example, identity or whether the delegate heard a question) is handled
naturally without pretending that it needs a citation.

## Features

- Meeting briefs with an owner position, authority, escalation boundaries, tone,
  Zoom link, and multiple references.
- Retrieval-augmented generation (RAG): source text is chunked, relevant excerpts
  are retrieved for the question, and cited excerpts can be opened from the UI.
- Evidence and authority verification before substantive speech is returned.
- Pre-meeting rehearsal with generated and manually entered questions.
- Live browser transcription and voice responses through Deepgram.
- Local Zoom + BlackHole demonstration route for sending the delegate's voice into
  a Zoom call and listening to the meeting audio.
- Commitment ledger and generated PDF post-meeting report.
- A friction-free **Demo Mode** for trying briefs, rehearsal, receipts, and
  conversation without Zoom or audio routing.

## Architecture

```text
Meeting brief + reference excerpts
              |
              v
      Retrieve relevant chunks
              |
              v
    Model proposes a response
              |
              v
 Evidence + authority verification
       |                 |
       v                 v
  Speak with receipt   Defer to owner
       |
       v
 Transcript, ledger, and PDF report
```

The browser owns local brief state and the interface. The Node server handles model
calls, retrieval, verification, Deepgram streaming/TTS, and PDF generation.

## Built with Codex and GPT-5.6

Mandate was ideated, designed, implemented, debugged, and polished with Codex.
Codex accelerated the full product workflow: the meeting-brief schema, evidence
retrieval and verification pipeline, Deepgram audio bridge, PDF reporting,
rehearsal experience, responsive interface, test checks, and this documentation.

Key product decisions made during development:

- **Bounded representation over imitation:** Mandate represents an explicit
  position; it does not claim to be the owner.
- **Receipts over hidden reasoning:** the UI reveals sources and authority status
  without presenting private chain-of-thought.
- **Rehearsal before delegation:** users can pressure-test the representative
  before a live meeting.
- **Deferral is a successful outcome:** new commitments and unsupported claims are
  returned to the owner instead of improvised.

GPT-5.6 is the intended runtime model for the delegate response, authority and
evidence verification, rehearsal generation, and report generation. **Current
repository status:** the checked-in server is still configured for Gemini while
the GPT-5.6 adapter migration is in progress. Before hackathon submission, switch
the server and `.env.example` to the GPT-5.6 configuration so the runtime matches
this architecture and the submission description. Do not describe the checked-in
Gemini configuration as a GPT-5.6 runtime until that migration is complete.

## Run locally

### Prerequisites

- Node.js 20+
- Python 3
- A Gemini API key for the current checked-in backend
- A Deepgram API key for transcription and text-to-speech

### Setup

1. Create local configuration:

   ```bash
   cp .env.example .env
   ```

2. Add values to `.env`:

   ```dotenv
   GEMINI_API_KEY=your_key_here
   DEEPGRAM_API_KEY=your_key_here
   ```

3. Install dependencies:

   ```bash
   python3 -m venv .venv
   .venv/bin/python -m pip install reportlab
   npm install
   ```

4. Verify syntax and provider configuration, then start the app:

   ```bash
   npm run check
   npm run verify
   npm start
   ```

5. Open [http://localhost:4242](http://localhost:4242) in Chrome.

`npm run verify` requires working internet access and valid provider keys. Keep
the terminal open while Mandate is running; stop it with `Control+C`.

## Sample scenario for testing

Choose **Try the interactive demo**, create a meeting brief, and use this data.
It gives a reviewer one answerable question and one decision Mandate must defer.

| Field | Sample value |
| --- | --- |
| Your name | Alex Rivera |
| Meeting name | Product launch decision |
| When | Friday · 11:00 AM |
| Attendees / context | Product leadership |
| Meeting goal | Decide whether the new feature can launch next month. |
| Your position | Protect reliability before adding new commitments. Do not commit to a launch date until engineering validates the remaining risks. |
| May do | Recommend resolving reliability risks first; Ask for an engineering estimate |
| Must escalate | A new budget; A revised launch commitment; Contractual commitments |
| Communication tone | Clear, concise, and constructive. |

Add a reference named **Product priorities** with this excerpt:

> Reliability is the first priority for the current release. The engineering team
> must estimate and mitigate outstanding incident risks before leadership commits
> to a launch date.

Then test these questions in **Rehearse** or **Live delegate**:

1. “Delegate, can we launch next month?” — expected: a grounded answer that
   recommends validating reliability risk and cites *Product priorities*.
2. “Can you hear me?” — expected: a natural basic response with no invented
   meeting claim.
3. “Can you approve an additional $50,000 for launch readiness?” — expected: a
   deferral because new budget is outside the brief.

Click the receipt/source after the first response, then export the PDF report
from **Commitment ledger**.

## Optional Zoom demonstration (macOS)

The Zoom workflow is a local desktop demonstration. It does not use Zoom OAuth,
a Zoom API key, or an automatic bot-join integration.

1. Install [BlackHole 2ch](https://existential.audio/blackhole/).
2. In Zoom, select **BlackHole 2ch** as the Mandate participant's microphone.
3. Keep Zoom's speaker on physical speakers or a Multi-Output Device.
4. In Mandate's **Live delegate** screen, choose the listening source that carries
   the meeting audio, then start the live bridge.
5. Join Zoom using the displayed participant name and tell attendees that Mandate
   is an AI representative. Obtain any recording/transcription consent required.

For direct incoming Zoom audio, BlackHole 16ch plus a Multi-Output Device can be
used as the listening source. Keep BlackHole 2ch exclusively for Mandate's speech
into Zoom.

## Validation

Run:

```bash
npm run check
```

This checks the Node server, browser application, and provider verification script
for syntax errors. Use `npm run verify` after adding valid keys to check provider
configuration.

## Repository map

```text
public/                 Browser UI, CSS, and assets
server.mjs              API server, retrieval, verification, audio, reporting
scripts/generate_report.py
                        PDF report generator
.env.example            Required local configuration template
```

## Privacy and MVP limitations

- Briefs, transcripts, and ledger data are stored in the current browser's local
  storage.
- Source excerpts and meeting questions are sent to the configured model provider
  and Deepgram when audio is used.
- The Zoom route is intentionally local and macOS-oriented for this prototype.
- Mandate is a bounded representative, not an autonomous authority: the owner
  remains responsible for approvals and consequential decisions.

## Hackathon submission checklist

- [ ] Complete the GPT-5.6 runtime migration and update `.env.example`.
- [ ] Add a public deployment or functioning demo link for judges.
- [ ] Record a public YouTube demo under three minutes showing brief → rehearsal
  → grounded response → deferral → PDF record.
- [ ] Add the public repository URL and an appropriate open-source license.
- [ ] Add the Codex `/feedback` session ID used for the core build.
- [ ] Verify the video and README accurately describe the working implementation.
