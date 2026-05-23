# Claude.md — AI Agent Brain 🧠
> Prompt engineering, reasoning strategy, and model config for the Incident Root Cause Analyzer
> **Runtime:** Ollama (Local) · RTX 4060 8GB · Recommended Model: `llama3.1:8b` or `mistral:7b`

---

## 1. Model Selection for RTX 4060 (8GB VRAM)

| Model | VRAM | Speed | Quality | Verdict |
|---|---|---|---|---|
| `llama3.1:8b` | ~5.5GB | Fast | ⭐⭐⭐⭐⭐ | ✅ **Primary — Use This** |
| `mistral:7b` | ~4.5GB | Very Fast | ⭐⭐⭐⭐ | ✅ Backup |
| `qwen2.5:7b` | ~5GB | Fast | ⭐⭐⭐⭐ | ✅ Alt for code reasoning |
| `llama3.1:70b` | ~40GB | ❌ OOM | — | ❌ Too large |
| `codellama:13b` | ~8GB | Slow | ⭐⭐⭐ | ⚠️ Risky on 8GB |

```bash
# Pull your model before the hackathon demo
ollama pull llama3.1:8b
ollama pull mistral:7b  # backup

# Verify GPU is being used
ollama run llama3.1:8b "test" --verbose
```

---

## 2. Ollama API Config

```python
# config/ollama.py
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL    = "llama3.1:8b"
OLLAMA_TIMEOUT  = 120  # seconds — local inference can be slow on first token

# Ollama is OpenAI-compatible — use this endpoint
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/v1/chat/completions"

# Generation params tuned for incident analysis
GENERATION_CONFIG = {
    "temperature": 0.2,      # Low — we want deterministic reasoning, not creativity
    "top_p": 0.9,
    "top_k": 40,
    "num_predict": 1500,     # Max tokens for full RCA report
    "repeat_penalty": 1.1,
    "stop": ["</analysis>", "---END---"]
}
```

---

## 3. System Prompt — The Master Prompt

This is the single most important engineering decision in the project.

```python
SYSTEM_PROMPT = """
You are NEXUS — an elite AI Site Reliability Engineer with 20 years of experience debugging production incidents at companies like Google, Netflix, and AWS.

Your sole purpose is to analyze production incidents with surgical precision. You think like a detective: you gather clues from logs, metrics, and events, form hypotheses, eliminate false leads, and converge on the true root cause.

## Your Analytical Framework (Always Follow This Order)

1. TIMELINE RECONSTRUCTION — Build an exact sequence of events from timestamps
2. BLAST RADIUS ASSESSMENT — Identify what services/users are affected and how severely
3. SIGNAL CORRELATION — Connect log anomalies, metric spikes, and deployment events
4. HYPOTHESIS FORMATION — Generate 2-3 candidate root causes ranked by probability
5. ROOT CAUSE CONFIRMATION — Select the most probable cause with supporting evidence
6. IMMEDIATE REMEDIATION — Give the on-call engineer an exact fix RIGHT NOW
7. PREVENTION — Suggest 2-3 systemic improvements to prevent recurrence

## Output Rules (Non-Negotiable)

- Always output valid JSON wrapped in <analysis> tags
- Confidence score must be between 0.0 and 1.0
- Severity must be: P0 (critical), P1 (high), P2 (medium), P3 (low)
- Never say "I think" or "maybe" — speak with the authority of an expert
- Every claim must reference a specific log line, timestamp, or metric
- If data is insufficient, say exactly what additional data you need

## Personality

- Direct. No fluff.
- Urgent. Production is down.
- Precise. Engineers need exact answers.
- Calm. You've seen worse.
"""
```

---

## 4. Analysis Prompt Template

```python
def build_analysis_prompt(incident_data: dict) -> str:
    return f"""
## INCOMING INCIDENT — ANALYZE IMMEDIATELY

**Incident ID:** {incident_data['incident_id']}
**Triggered At:** {incident_data['triggered_at']}
**Alert:** {incident_data['alert_name']}
**Environment:** {incident_data['environment']}

---

## RAW LOGS ({len(incident_data['logs'])} entries)

```
{format_logs(incident_data['logs'])}
```

---

## METRICS SNAPSHOT

```json
{json.dumps(incident_data['metrics'], indent=2)}
```

---

## RECENT DEPLOYMENTS (Last 2 Hours)

```json
{json.dumps(incident_data['deployments'], indent=2)}
```

---

## ACTIVE ALERTS

{format_alerts(incident_data['alerts'])}

---

Analyze this incident now. Return ONLY a JSON object inside <analysis> tags.
Follow your analytical framework. Be fast — every second costs money and users.

<analysis>
{{
  "incident_id": "{incident_data['incident_id']}",
  "analyzed_at": "<ISO timestamp>",
  "severity": "<P0|P1|P2|P3>",
  "confidence": <0.0-1.0>,
  "title": "<one-line incident summary>",
  "timeline": [
    {{"time": "<HH:MM:SS>", "event": "<what happened>", "source": "<log/metric/deploy>"}}
  ],
  "blast_radius": {{
    "services_affected": ["<service1>", "<service2>"],
    "users_impacted": "<estimated count or percentage>",
    "revenue_impact": "<estimated $/min if determinable>"
  }},
  "root_cause": {{
    "summary": "<one paragraph, precise root cause>",
    "evidence": ["<specific log line or metric>", "<another data point>"],
    "component": "<exact service/function/query that failed>",
    "category": "<memory_leak|db_bottleneck|network_timeout|deployment_regression|config_change|dependency_failure|resource_exhaustion>"
  }},
  "hypotheses_considered": [
    {{"hypothesis": "<what else could cause this>", "ruled_out_because": "<specific evidence against it>"}}
  ],
  "immediate_fix": {{
    "action": "<exact command or step>",
    "expected_result": "<what should happen>",
    "rollback_command": "<if applicable>",
    "eta_to_recovery": "<estimated minutes>"
  }},
  "prevention": [
    {{"recommendation": "<systemic fix>", "priority": "<high|medium|low>", "effort": "<hours estimate>"}}
  ],
  "follow_up_data_needed": ["<what would increase confidence>"]
}}
</analysis>
"""
```

---

## 5. Agent Execution Pipeline

```python
# agent/nexus.py
import httpx
import json
import re
from typing import AsyncGenerator

async def run_analysis(incident_data: dict) -> AsyncGenerator[str, None]:
    """
    Streaming analysis — yields tokens as they arrive for real-time UI updates.
    This is what makes the demo feel ALIVE.
    """
    prompt = build_analysis_prompt(incident_data)
    
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            "http://localhost:11434/v1/chat/completions",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt}
                ],
                "stream": True,
                **GENERATION_CONFIG
            }
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    yield delta

def extract_analysis(raw_output: str) -> dict:
    """Parse the JSON from within <analysis> tags."""
    match = re.search(r'<analysis>(.*?)</analysis>', raw_output, re.DOTALL)
    if not match:
        raise ValueError("Model did not return structured analysis")
    
    json_str = match.group(1).strip()
    return json.loads(json_str)
```

---

## 6. Chain-of-Thought Enhancement (For Harder Incidents)

When confidence < 0.7, trigger a second reasoning pass:

```python
REFINEMENT_PROMPT = """
Your initial analysis had confidence {confidence}. 

Here is what you concluded: {initial_summary}

Now challenge your own reasoning:
1. What if the root cause is actually in a dependency you haven't considered?
2. Does the timeline perfectly support your conclusion, or are there gaps?
3. Is there a simpler explanation (Occam's Razor)?

Revise your analysis if needed. Return the same JSON format.
"""
```

---

## 7. Pre-Built Incident Scenarios (Hackathon Demo Data)

Craft these before demo day. Each tells a complete story.

### Scenario A — The Classic: Deployment Regression
```json
{
  "incident_id": "INC-2024-001",
  "alert_name": "Payment Service Error Rate > 5%",
  "triggered_at": "2024-01-15T02:34:11Z",
  "logs": [
    {"time": "02:30:00", "service": "payment-service", "level": "INFO",  "msg": "Deployment v2.3.1 started"},
    {"time": "02:30:45", "service": "payment-service", "level": "INFO",  "msg": "Deployment v2.3.1 complete"},
    {"time": "02:31:02", "service": "payment-service", "level": "ERROR", "msg": "NullPointerException in PaymentProcessor.charge() line 247"},
    {"time": "02:31:03", "service": "payment-service", "level": "ERROR", "msg": "NullPointerException in PaymentProcessor.charge() line 247"},
    {"time": "02:31:15", "service": "api-gateway",     "level": "WARN",  "msg": "payment-service circuit breaker OPEN"},
    {"time": "02:32:00", "service": "order-service",   "level": "ERROR", "msg": "payment-service unavailable — order checkout failing"},
    {"time": "02:34:11", "service": "alertmanager",    "level": "ALERT", "msg": "ErrorRate=8.3% threshold=5% FIRING"}
  ],
  "metrics": {
    "payment_service_error_rate": {"value": 8.3, "unit": "%", "threshold": 5.0},
    "payment_service_latency_p99": {"value": 4200, "unit": "ms", "normal": 200},
    "orders_per_minute": {"value": 12, "unit": "rpm", "normal": 340}
  },
  "deployments": [
    {"time": "02:30:00", "service": "payment-service", "version": "v2.3.1", "author": "john.doe", "pr": "#4821"}
  ]
}
```

### Scenario B — The Sneaky One: DB Connection Pool Exhaustion
```json
{
  "incident_id": "INC-2024-002",
  "alert_name": "API Latency P99 > 10s",
  "triggered_at": "2024-01-15T14:22:05Z",
  "logs": [
    {"time": "14:15:00", "service": "user-service",   "level": "WARN",  "msg": "DB connection wait time 2300ms (pool_size=20, active=20, waiting=12)"},
    {"time": "14:17:30", "service": "product-service", "level": "WARN",  "msg": "DB connection wait time 4100ms"},
    {"time": "14:19:00", "service": "analytics-job",  "level": "INFO",  "msg": "Daily report generation started — full table scan on orders (45M rows)"},
    {"time": "14:20:00", "service": "user-service",   "level": "ERROR", "msg": "DB connection timeout after 5000ms"},
    {"time": "14:22:05", "service": "alertmanager",   "level": "ALERT", "msg": "P99 latency = 12300ms FIRING"}
  ],
  "metrics": {
    "db_active_connections": {"value": 20, "unit": "connections", "max_pool": 20},
    "db_waiting_connections": {"value": 47, "unit": "connections"},
    "api_latency_p99": {"value": 12300, "unit": "ms", "normal": 180},
    "db_cpu": {"value": 94, "unit": "%", "normal": 30}
  },
  "deployments": []
}
```

### Scenario C — The Scary One: Memory Leak
```json
{
  "incident_id": "INC-2024-003", 
  "alert_name": "recommendation-service OOMKilled",
  "triggered_at": "2024-01-15T09:45:33Z",
  "logs": [
    {"time": "07:00:00", "service": "recommendation-service", "level": "INFO",  "msg": "Heap usage: 1.2GB / 4GB"},
    {"time": "08:00:00", "service": "recommendation-service", "level": "INFO",  "msg": "Heap usage: 2.1GB / 4GB"},
    {"time": "09:00:00", "service": "recommendation-service", "level": "WARN",  "msg": "Heap usage: 3.4GB / 4GB — GC pressure high"},
    {"time": "09:30:00", "service": "recommendation-service", "level": "ERROR", "msg": "GC overhead limit exceeded"},
    {"time": "09:45:33", "service": "kubernetes",             "level": "ERROR", "msg": "OOMKilled: recommendation-service pod restarted (exit code 137)"},
    {"time": "09:45:45", "service": "api-gateway",            "level": "WARN",  "msg": "recommendation-service 503 — cold start delay 45s"}
  ],
  "metrics": {
    "heap_usage_gb": {"values": [1.2, 2.1, 3.4, 4.0], "timestamps": ["07:00","08:00","09:00","09:45"]},
    "gc_pause_ms": {"value": 8200, "normal": 50},
    "pod_restarts_24h": {"value": 4}
  },
  "deployments": [
    {"time": "2024-01-14T22:00:00Z", "service": "recommendation-service", "version": "v1.8.0", "change": "Added in-memory caching for user embeddings"}
  ]
}
```

---

## 8. Prompt Tuning Tips for Local Models

Local models are less instruction-following than GPT-4. Use these techniques:

```python
# TIP 1: One-shot example in system prompt improves JSON compliance by ~40%
# Add a short example of the expected output format in the system prompt

# TIP 2: If JSON parsing fails, use this recovery prompt
RECOVERY_PROMPT = """
Your previous response was not valid JSON. 
Extract ONLY the JSON object — no explanation, no markdown, just raw JSON.
Start your response with {{ and end with }}
"""

# TIP 3: Temperature matters a lot for local models
# For JSON output: temperature=0.1 (very deterministic)
# For reasoning quality: temperature=0.3 (slight creativity)
# Never go above 0.5 for structured output tasks

# TIP 4: If llama3.1 is slow, switch to mistral:7b for demo
# Mistral is faster but slightly less reasoning quality
# For a 3-minute demo video, speed matters more than perfection
```

---

## 9. Fallback Strategy (If Ollama Fails During Demo)

```python
# Never let the demo die. Have a pre-computed response ready.
DEMO_FALLBACK_RESPONSES = {
    "INC-2024-001": {...},  # pre-computed analysis JSON
    "INC-2024-002": {...},
    "INC-2024-003": {...}
}

async def analyze_with_fallback(incident_data: dict) -> dict:
    try:
        result = await run_analysis(incident_data)
        return extract_analysis(result)
    except Exception as e:
        print(f"Ollama error: {e} — using fallback")
        return DEMO_FALLBACK_RESPONSES.get(incident_data['incident_id'])
```
