# Requirements.md — Product Bible 📋
> NEXUS — AI Incident Root Cause Analyzer
> Hackathon: 23–24 May 2026 · Submission: 24 May 11:59 PM IST

---

## 1. Vision Statement

> **NEXUS turns the worst moment in an engineer's career — a 2am production outage — into a solved problem in under 30 seconds.**

Current reality: When production goes down, engineers open 10 browser tabs, Slack 5 people, stare at Grafana dashboards, and guess. The mean time to identify root cause (MTTD) at most companies is 45–90 minutes. Every minute costs money and user trust.

NEXUS eliminates that 45-minute window by reasoning across logs, metrics, and deployment history simultaneously — the way a world-class SRE would, but instantly.

---

## 2. User Persona

**Primary: The On-Call Engineer**
- It's 2am. Their phone woke them up.
- They are stressed, groggy, and under pressure
- They need an answer in seconds, not a dashboard to stare at
- They need to know: *what broke, why, and exactly how to fix it*

**Secondary: Engineering Team Lead**
- Reviews incident post-mortems
- Wants trend analysis: what keeps breaking and why
- Needs documentation of what happened for stakeholders

---

## 3. Core Features (Must-Have for Hackathon)

### F1 — Incident Dashboard
- [ ] List view of all incidents with severity badges (P0/P1/P2/P3)
- [ ] Each incident shows: title, service, time triggered, current status
- [ ] Click incident to load full detail view
- [ ] Status indicators: Open / Analyzing / Resolved
- [ ] Color coding: Red (P0), Orange (P1), Yellow (P2), Blue (P3)

### F2 — Log Stream Viewer
- [ ] Scrolling log view for selected incident
- [ ] Color-coded by log level: ERROR=red, WARN=yellow, INFO=grey
- [ ] Timestamps visible per log line
- [ ] Auto-scroll to latest entry (with ability to pause)
- [ ] Filter by log level

### F3 — AI Analysis Trigger
- [ ] "Analyze with NEXUS" button on incident detail view
- [ ] Button disabled if analysis already in progress
- [ ] Visual indicator: "NEXUS is thinking..." with animated state
- [ ] Analysis results persist — don't re-run on revisit

### F4 — Streaming Analysis Output
- [ ] Tokens stream to UI in real-time via WebSocket (typewriter effect)
- [ ] Raw stream visible in a "Thinking" panel as it generates
- [ ] Once complete, structured cards replace raw stream

### F5 — Structured Analysis Report
After analysis completes, display these cards:

**Card 1: Root Cause**
- Summary paragraph
- Component that failed (e.g., `payment-service v2.3.1`)
- Failure category (e.g., `deployment_regression`)
- Confidence score (animated bar, 0–100%)

**Card 2: Blast Radius**
- Services affected (list)
- Estimated users impacted
- Revenue impact estimate (if calculable)

**Card 3: Timeline**
- Chronological sequence of events
- Each event tagged with source (log / metric / deployment)

**Card 4: Immediate Fix**
- Exact action to take right now
- Command or step (copyable)
- Expected recovery time

**Card 5: Prevention**
- 2-3 systemic recommendations
- Priority and effort estimate per item

### F6 — Incident Simulator
- [ ] "Simulate Incident" button loads one of 3 pre-built scenarios
- [ ] Animates logs appearing one by one (1 log per 500ms)
- [ ] Triggers alert after logs load
- [ ] This is the demo mode — makes the demo feel live

### F7 — System Health Header
- [ ] Top bar showing: active incidents count, environment, current UTC time
- [ ] Live clock (updates every second)
- [ ] Pulsing red dot when P0 incident is active

---

## 4. Non-Functional Requirements

### Performance
- [ ] Ollama first token latency: < 3 seconds
- [ ] Full analysis complete: < 90 seconds (llama3.1:8b on RTX 4060)
- [ ] Frontend load time: < 2 seconds
- [ ] WebSocket connection: < 500ms to establish
- [ ] UI frame rate: 60fps (no jank during streaming)

### Reliability (Hackathon Context)
- [ ] Fallback pre-computed responses if Ollama fails
- [ ] JSON parse error recovery (retry with simpler prompt)
- [ ] WebSocket auto-reconnect if connection drops

### UI/UX
- [ ] Dark theme only (fits the "ops console" aesthetic)
- [ ] Responsive to 1920x1080 (demo screen size)
- [ ] No loading spinners without status text
- [ ] Every action gives immediate feedback (< 100ms visual response)
- [ ] Monospace font for log output (JetBrains Mono or Fira Code)

---

## 5. Out of Scope (Do NOT Build These)

These sound tempting. Don't waste time on them.

| Feature | Why Skip |
|---|---|
| Real Datadog/PagerDuty integration | OAuth setup = 4 hours you don't have |
| User authentication / login | Nobody's judging your auth system |
| Multi-user / team features | Solo demo doesn't need it |
| Historical trend analysis | Cool but not demo-able in 3 min |
| Slack/email alerts | Side feature, not core value prop |
| Docker / deployment setup | Local demo is fine for hackathon |
| Dark/light mode toggle | Wastes time, dark mode only |
| Mobile responsive | You're presenting on a laptop |

---

## 6. Tech Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| AI Runtime | Ollama (llama3.1:8b) | Local, free, fast on RTX 4060 |
| Backend | FastAPI (Python) | Async, WebSocket native, fast to write |
| Database | SQLite | Zero config, zero ops, file-based |
| Frontend | React + Vite | Fast HMR, component model perfect for this |
| Styling | Tailwind CSS | No design system needed, utility first |
| State | Zustand | Simpler than Redux, perfect for this scale |
| Charts | Recharts | React-native, no config needed |
| Animation | Framer Motion | Polished transitions with minimal code |
| WS Client | Native WebSocket API | No library needed |
| HTTP Client | Axios | Simple, familiar |

---

## 7. Judging Criteria Mapping

The hackathon awards bonus points for these. Here's exactly how NEXUS wins each:

### ✅ AI Integration
**What judges want to see:** Meaningful AI usage, not just a chatbot wrapper.

**How NEXUS delivers:**
- Structured multi-signal reasoning (logs + metrics + deployments simultaneously)
- Chain-of-thought analytical framework (visible in output)
- Confidence scoring with evidence
- Not just "summarize this" — genuine diagnostic reasoning

**Demo moment:** Point at the AI reasoning through 3 conflicting signals and eliminating false hypotheses.

---

### ✅ Real-World Usability
**What judges want to see:** Would a real company pay for this?

**How NEXUS delivers:**
- Addresses a $500B problem (downtime costs enterprises ~$5,600/min)
- Reduces MTTD from 45 min → 30 seconds
- Output is immediately actionable (copy-paste commands)
- Integrates into existing workflows (you bring your logs, not a new tool)

**Demo moment:** "Every P0 incident your company has costs $5,600 per minute. NEXUS cuts your detection time by 90%."

---

### ✅ UI/UX
**What judges want to see:** Thoughtful design, not a CRUD app.

**How NEXUS delivers:**
- Ops console aesthetic — feels like a real production tool
- Streaming output makes AI feel alive and fast
- Information hierarchy: severity → root cause → fix (most urgent first)
- Monospace fonts, terminal colors — domain-appropriate design

**Demo moment:** The moment structured cards snap into place after streaming. It's cinematic.

---

### ✅ Creativity
**What judges want to see:** Novel application of AI.

**How NEXUS delivers:**
- AI as SRE co-pilot, not just chatbot
- Real-time reasoning visualization (see the AI think)
- Confidence scoring shows epistemic humility — AI doesn't just guess
- The "detective" framing: hypothesis formation + elimination

**Demo moment:** Show the `hypotheses_considered` section — AI explains what it ruled out and why.

---

### ✅ Technical Implementation
**What judges want to see:** Clean code, good architecture, it actually works.

**How NEXUS delivers:**
- Clean separation: agent / api / db layers
- Async streaming pipeline (no blocking)
- Structured prompt engineering (not ad-hoc)
- Error handling and fallback strategy

**Demo moment:** Show the GitHub repo — clean folder structure, good README.

---

## 8. 36-Hour Build Schedule

```
DAY 1 — MAY 23

[Hour 0-1]   Setup
  - Create GitHub repo (public)
  - Initialize backend (FastAPI) + frontend (Vite + React)
  - ollama pull llama3.1:8b
  - Verify GPU inference works

[Hour 1-3]   Backend Core
  - SQLite models + seed data (3 scenarios from Claude.md)
  - GET /api/incidents endpoint
  - GET /api/incidents/{id} endpoint

[Hour 3-5]   AI Agent
  - Implement prompts.py (copy from Claude.md)
  - Implement nexus.py (streaming + parsing)
  - Test with all 3 scenarios via curl
  - Tune until JSON output is reliable

[Hour 5-7]   WebSocket
  - Implement /ws/analysis/{incident_id}
  - Test streaming with wscat or browser console
  - Implement fallback responses

[Hour 7-10]  Frontend Foundation
  - IncidentFeed component (left panel)
  - Basic AnalysisPanel (right panel)
  - WebSocket hook (useAnalysisStream)
  - Zustand store
  - Wire everything together (ugly but working)

[SLEEP — non-negotiable]

DAY 2 — MAY 24

[Hour 10-14] Frontend Polish
  - StatusHeader component
  - LogStream component (with level colors)
  - Streaming typewriter effect
  - Structured analysis cards (Root Cause, Fix, Timeline)
  - SeverityBadge + ConfidenceBar animations

[Hour 14-17] Incident Simulator
  - "Simulate Incident" button
  - Log animation (500ms per entry)
  - Auto-trigger analysis after simulation
  - This is the demo's hero moment — perfect it

[Hour 17-21] Polish + Edge Cases
  - Error states (what if Ollama is slow?)
  - Loading states (every async action)
  - Typography + spacing pass
  - Make it look like it costs $50k

[Hour 21-27] Demo Video + README
  - Record 3-min demo video
  - Script: "It's 2am. Production is down. Watch this."
  - Show all 3 scenarios if time allows
  - Write README: problem → solution → architecture → how to run
  - Add architecture diagram to README

[Hour 27-30] Submission Buffer
  - Final testing
  - GitHub cleanup (no debug logs, clean commits)
  - Submit before 11:59 PM IST
```

---

## 9. Demo Video Script (3 Minutes)

```
[0:00-0:20] The Hook
"It's 2am. Your phone just woke you up. 
Production is down. Error rate is 8%. 
Payments are failing. Every second costs $93.
Your team is panicking in Slack.
This is NEXUS."

[0:20-1:00] The Problem
"Traditionally, your on-call engineer opens 10 browser 
tabs, searches through thousands of log lines, 
cross-references metrics manually. 
Average time to find root cause? 47 minutes.
At $5,600 per minute of downtime."

[1:00-2:20] The Demo (LIVE)
[Load incident INC-001 on screen]
"Here's an active P0 incident — payment service 
error rate spiked 8 minutes ago."
[Click Analyze with NEXUS]
"NEXUS is now reasoning across 200 log lines, 
6 metrics, and deployment history simultaneously."
[Watch tokens stream]
"Notice it's forming hypotheses and eliminating them."
[Structured cards appear]
"Root cause: deployment regression in payment-service v2.3.1.
Confidence: 94%.
Fix: one kubectl command. 
Estimated recovery: 3 minutes."

[2:20-2:50] The Impact
"NEXUS identified in 23 seconds what would take 
your team 47 minutes.
That's $4,300 saved. Per incident.
The average company has 40 incidents per month."

[2:50-3:00] The Close
"NEXUS. Because 2am shouldn't last until 4am."
```

---

## 10. README Structure (For GitHub)

```markdown
# NEXUS — AI Incident Root Cause Analyzer

> Stop searching logs at 2am. Let AI find the root cause in seconds.

## The Problem
[2 sentences]

## The Solution  
[2 sentences + screenshot of the UI]

## How It Works
[Architecture diagram]

## Tech Stack
[Table]

## Setup & Run
[Step by step, < 10 lines]

## Demo Scenarios
[Brief description of 3 scenarios]

## Hackathon
Built in 36 hours for [Hackathon Name] · May 2026
```

---

## 11. Winning Mindset

**You are not building a startup. You are building a story.**

The story is:
1. Production goes down (relatable pain)
2. Engineers scramble (emotional tension)  
3. NEXUS analyzes in real-time (drama)
4. Root cause appears with 94% confidence (resolution)
5. One command fixes it (satisfaction)

Every technical decision — the streaming output, the confidence score, the detective framing, the terminal aesthetic — serves that story.

**Build the story. Win the hackathon.**
