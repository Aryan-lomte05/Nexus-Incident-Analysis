# System.md — Architecture Blueprint 🏗️
> AI Incident Root Cause Analyzer — NEXUS
> Stack: FastAPI · React · Ollama · WebSockets · SQLite

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS PLATFORM                           │
│                                                                  │
│   ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐  │
│   │  React   │◄──►│   FastAPI    │◄──►│   Ollama (Local)    │  │
│   │ Frontend │    │   Backend    │    │   llama3.1:8b       │  │
│   │          │    │              │    │   RTX 4060 8GB      │  │
│   └──────────┘    └──────┬───────┘    └─────────────────────┘  │
│                          │                                       │
│                   ┌──────▼───────┐                              │
│                   │   SQLite DB  │                              │
│                   │  (Incidents) │                              │
│                   └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
nexus/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # All config (model, ports, etc.)
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── nexus.py             # Core AI agent logic
│   │   ├── prompts.py           # All prompt templates (from Claude.md)
│   │   └── parser.py            # JSON extraction & validation
│   ├── api/
│   │   ├── __init__.py
│   │   ├── incidents.py         # Incident CRUD endpoints
│   │   ├── analysis.py          # Analysis trigger endpoints
│   │   └── websocket.py         # Real-time streaming endpoint
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py            # SQLAlchemy models
│   │   ├── database.py          # DB connection
│   │   └── crud.py              # DB operations
│   ├── data/
│   │   ├── scenarios/
│   │   │   ├── inc_001_deployment_regression.json
│   │   │   ├── inc_002_db_connection_pool.json
│   │   │   └── inc_003_memory_leak.json
│   │   └── seed.py              # Load demo data into DB
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── IncidentFeed.jsx       # Left panel — live incident list
│   │   │   ├── AnalysisPanel.jsx      # Right panel — AI output
│   │   │   ├── LogStream.jsx          # Scrolling log viewer
│   │   │   ├── MetricsWidget.jsx      # Sparkline metrics
│   │   │   ├── SeverityBadge.jsx      # P0/P1/P2/P3 badge
│   │   │   ├── ConfidenceBar.jsx      # Animated confidence score
│   │   │   ├── TimelineView.jsx       # Incident timeline
│   │   │   └── StatusHeader.jsx       # Top bar with system health
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js        # WS connection hook
│   │   │   └── useIncidents.js        # Incident state management
│   │   ├── store/
│   │   │   └── incidentStore.js       # Zustand state store
│   │   └── utils/
│   │       ├── formatters.js          # Time, severity formatters
│   │       └── api.js                 # Axios API client
│   ├── package.json
│   └── vite.config.js
│
├── Claude.md                    # AI agent brain (this project's)
├── System.md                    # This file
├── Requirements.md              # Product requirements
├── README.md                    # GitHub-facing docs
└── docker-compose.yml           # Optional: containerize backend
```

---

## 3. Backend — FastAPI

### main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import incidents, analysis, websocket
from db.database import init_db

app = FastAPI(title="NEXUS — AI Incident Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router, prefix="/api/incidents")
app.include_router(analysis.router,  prefix="/api/analysis")

@app.websocket("/ws/analysis/{incident_id}")
async def analysis_stream(websocket, incident_id: str):
    await websocket.handle_analysis_stream(websocket, incident_id)

@app.on_event("startup")
async def startup():
    init_db()
```

### API Endpoints

```
GET    /api/incidents              → List all incidents (paginated)
GET    /api/incidents/{id}         → Get single incident + logs + metrics
POST   /api/incidents              → Create new incident (or simulate one)
POST   /api/incidents/{id}/trigger → Manually trigger AI analysis
GET    /api/incidents/{id}/analysis → Get completed analysis result

WS     /ws/analysis/{incident_id}  → Stream AI tokens in real-time
```

### WebSocket Streaming Endpoint
```python
# api/websocket.py
from fastapi import WebSocket
from agent.nexus import run_analysis, extract_analysis
from db.crud import get_incident, save_analysis

async def handle_analysis_stream(websocket: WebSocket, incident_id: str):
    await websocket.accept()
    
    incident = get_incident(incident_id)
    if not incident:
        await websocket.send_json({"error": "Incident not found"})
        return
    
    full_response = ""
    
    # Stream tokens to frontend — this is what makes the UI feel alive
    await websocket.send_json({"type": "start", "incident_id": incident_id})
    
    async for token in run_analysis(incident.to_dict()):
        full_response += token
        await websocket.send_json({"type": "token", "content": token})
    
    # Parse and send structured result
    try:
        analysis = extract_analysis(full_response)
        save_analysis(incident_id, analysis)
        await websocket.send_json({"type": "complete", "analysis": analysis})
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    
    await websocket.close()
```

---

## 4. Database Schema

```sql
-- incidents table
CREATE TABLE incidents (
    id          TEXT PRIMARY KEY,          -- "INC-2024-001"
    title       TEXT NOT NULL,
    alert_name  TEXT NOT NULL,
    environment TEXT DEFAULT 'production',
    status      TEXT DEFAULT 'open',       -- open | analyzing | resolved
    severity    TEXT,                      -- P0 | P1 | P2 | P3
    triggered_at DATETIME NOT NULL,
    resolved_at  DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- logs table  
CREATE TABLE incident_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT REFERENCES incidents(id),
    timestamp   TEXT NOT NULL,
    service     TEXT NOT NULL,
    level       TEXT NOT NULL,             -- INFO | WARN | ERROR | FATAL
    message     TEXT NOT NULL,
    raw_json    TEXT                       -- full log line
);

-- metrics table
CREATE TABLE incident_metrics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT REFERENCES incidents(id),
    metric_name TEXT NOT NULL,
    value       REAL,
    unit        TEXT,
    threshold   REAL,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- deployments table
CREATE TABLE deployments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT REFERENCES incidents(id),
    service     TEXT NOT NULL,
    version     TEXT NOT NULL,
    author      TEXT,
    deployed_at DATETIME NOT NULL
);

-- analyses table
CREATE TABLE analyses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id     TEXT REFERENCES incidents(id),
    raw_output      TEXT,                  -- full LLM output
    structured_json TEXT,                  -- parsed JSON analysis
    confidence      REAL,
    model_used      TEXT DEFAULT 'llama3.1:8b',
    analysis_time_ms INTEGER,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Frontend Architecture

### State Management (Zustand)
```javascript
// store/incidentStore.js
import { create } from 'zustand'

export const useIncidentStore = create((set, get) => ({
  incidents: [],
  selectedIncident: null,
  analysisState: 'idle',   // idle | streaming | complete | error
  streamingTokens: '',
  currentAnalysis: null,
  
  selectIncident: (incident) => set({ 
    selectedIncident: incident, 
    currentAnalysis: null,
    streamingTokens: '',
    analysisState: 'idle'
  }),
  
  startAnalysis: () => set({ analysisState: 'streaming', streamingTokens: '' }),
  
  appendToken: (token) => set(state => ({ 
    streamingTokens: state.streamingTokens + token 
  })),
  
  completeAnalysis: (analysis) => set({ 
    analysisState: 'complete',
    currentAnalysis: analysis 
  }),
}))
```

### WebSocket Hook
```javascript
// hooks/useWebSocket.js
import { useEffect, useRef } from 'react'
import { useIncidentStore } from '../store/incidentStore'

export function useAnalysisStream(incidentId) {
  const ws = useRef(null)
  const { startAnalysis, appendToken, completeAnalysis } = useIncidentStore()
  
  const triggerAnalysis = () => {
    if (!incidentId) return
    
    startAnalysis()
    ws.current = new WebSocket(`ws://localhost:8000/ws/analysis/${incidentId}`)
    
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      
      if (msg.type === 'token')    appendToken(msg.content)
      if (msg.type === 'complete') completeAnalysis(msg.analysis)
    }
  }
  
  return { triggerAnalysis }
}
```

---

## 6. UI Component Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 NEXUS  ·  3 Active Incidents  ·  Production  ·  02:34 UTC  │  ← StatusHeader
└─────────────────────────────────────────────────────────────────┘
┌───────────────────┐ ┌───────────────────────────────────────────┐
│  INCIDENT FEED    │ │  AI ANALYSIS                              │
│                   │ │                                           │
│ 🔴 INC-001  [P0] │ │  ┌─────────────────────────────────────┐ │
│ Payment errors    │ │  │ ROOT CAUSE IDENTIFIED               │ │
│ 2m ago           │ │  │                                     │ │
│                   │ │  │ Deployment regression in            │ │
│ 🟠 INC-002  [P1] │ │  │ payment-service v2.3.1             │ │
│ DB latency spike  │ │  │ deployed at 02:30 UTC               │ │
│ 14m ago          │ │  │                                     │ │
│                   │ │  │ Confidence: ████████░░ 84%         │ │
│ 🟡 INC-003  [P2] │ │  └─────────────────────────────────────┘ │
│ Memory climbing   │ │                                           │
│ 1h ago           │ │  TIMELINE ─────────────────────────────── │
│                   │ │  02:30 Deployment started                 │
│                   │ │  02:30 Deployment complete                │
│  [+ Simulate]    │ │  02:31 NullPointerException (247 errors)  │
│                   │ │  02:31 Circuit breaker OPEN               │
│                   │ │  02:34 Alert fired                        │
│                   │ │                                           │
│                   │ │  IMMEDIATE FIX ─────────────────────────  │
│                   │ │  $ kubectl rollout undo                   │
│                   │ │    deployment/payment-service             │
│                   │ │                                           │
└───────────────────┘ └───────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  RAW LOG STREAM                                                  │
│  02:31:03 ERROR payment-service NullPointerException line 247   │
│  02:31:15 WARN  api-gateway circuit breaker OPEN               │  ← LogStream
│  02:32:00 ERROR order-service payment-service unavailable       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow — End to End

```
1. USER clicks incident in IncidentFeed
        ↓
2. Frontend fetches incident data from GET /api/incidents/{id}
        ↓
3. USER clicks "Analyze with NEXUS"
        ↓
4. Frontend opens WebSocket: ws://localhost:8000/ws/analysis/{id}
        ↓
5. Backend fetches incident + logs + metrics from SQLite
        ↓
6. Backend builds prompt (from Claude.md template)
        ↓
7. Backend sends streaming request to Ollama (localhost:11434)
        ↓
8. Ollama streams tokens from llama3.1:8b (GPU inference)
        ↓
9. Backend forwards each token over WebSocket to Frontend
        ↓
10. Frontend renders streaming text in AnalysisPanel (typewriter effect)
        ↓
11. When <analysis> tag closes, Backend parses JSON
        ↓
12. Backend sends { type: "complete", analysis: {...} } over WebSocket
        ↓
13. Frontend renders structured cards: Root Cause, Timeline, Fix, Prevention
        ↓
14. Analysis saved to SQLite for history
```

---

## 8. Running the Project

```bash
# Prerequisites
# - Python 3.11+
# - Node 18+
# - Ollama installed: https://ollama.ai
# - RTX 4060 with CUDA drivers

# ── Step 1: Pull the model (do this BEFORE the demo)
ollama pull llama3.1:8b

# ── Step 2: Backend
cd backend
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt
python db/seed.py                 # Load demo incidents
uvicorn main:app --reload --port 8000

# ── Step 3: Frontend
cd frontend
npm install
npm run dev                       # Opens at http://localhost:5173

# ── Step 4: Verify Ollama is running
curl http://localhost:11434/api/tags  # Should list llama3.1:8b
```

---

## 9. requirements.txt

```txt
fastapi==0.111.0
uvicorn[standard]==0.29.0
httpx==0.27.0
sqlalchemy==2.0.29
python-dotenv==1.0.1
pydantic==2.7.1
websockets==12.0
```

---

## 10. package.json (Frontend)

```json
{
  "name": "nexus-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.2",
    "axios": "^1.7.2",
    "framer-motion": "^11.2.10",
    "recharts": "^2.12.7",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.12"
  }
}
```

---

## 11. Demo Day Checklist

```
Before demo (night before):
□ ollama pull llama3.1:8b  ← do this, it's 5GB
□ Run all 3 scenarios once — verify JSON parsing works
□ Set screen resolution to 1920x1080 for recording
□ Close all browser tabs except localhost:5173
□ Disable notifications on your machine

During demo:
□ Start with Scenario A (most dramatic — payment outage)
□ Let the tokens stream live — don't fast-forward
□ Point at the confidence score as it renders
□ Read the fix command out loud: "kubectl rollout undo..."
□ End with: "Nexus identified in 12 seconds what would take your team 2 hours"
```
