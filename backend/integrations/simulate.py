# ╔══════════════════════════════════════════════════════════════╗
# ║  NEXUS — Simulated Datadog + PagerDuty Clients               ║
# ║  Realistic fake API responses — no real accounts needed      ║
# ╚══════════════════════════════════════════════════════════════╝
#
# These drop-in replacements mirror the exact interface of the real
# DatadogClient and PagerDutyClient so all backend logic is unchanged.
# Used automatically when API keys are not configured.

import time
import random
from datetime import datetime, timezone, timedelta

# ─── SHARED DATA (mirrors demo incidents) ─────────────────────
_DEMO_LOGS = {
    "INC-001": [
        {"t": "02:30:00", "svc": "payment-svc",  "lvl": "INFO",  "msg": "Deployment v2.3.1 started — 342 instances rolling"},
        {"t": "02:30:45", "svc": "payment-svc",  "lvl": "INFO",  "msg": "Deployment v2.3.1 complete ✓"},
        {"t": "02:31:02", "svc": "payment-svc",  "lvl": "ERROR", "msg": "NullPointerException: PaymentProcessor.charge() line 247"},
        {"t": "02:31:03", "svc": "payment-svc",  "lvl": "ERROR", "msg": "NullPointerException: PaymentProcessor.charge() line 247"},
        {"t": "02:31:04", "svc": "payment-svc",  "lvl": "ERROR", "msg": "NullPointerException: PaymentProcessor.charge() line 247 [+244 similar]"},
        {"t": "02:31:15", "svc": "api-gateway",  "lvl": "WARN",  "msg": "payment-svc circuit breaker OPEN after 247 failures"},
        {"t": "02:32:00", "svc": "order-svc",    "lvl": "ERROR", "msg": "Upstream payment-svc unavailable — checkout failing"},
        {"t": "02:34:11", "svc": "alertmanager", "lvl": "ALERT", "msg": "FIRING: PaymentErrorRate=8.3% > threshold=5%"},
    ],
    "INC-002": [
        {"t": "14:15:00", "svc": "user-svc",      "lvl": "WARN",  "msg": "DB connection wait 2300ms (pool: 20/20, waiting: 12)"},
        {"t": "14:17:30", "svc": "product-svc",   "lvl": "WARN",  "msg": "DB connection wait 4100ms"},
        {"t": "14:19:00", "svc": "analytics-job", "lvl": "INFO",  "msg": "Daily report started — full table scan on orders (45.2M rows)"},
        {"t": "14:19:45", "svc": "user-svc",      "lvl": "WARN",  "msg": "DB connection wait 8200ms (pool: 20/20, waiting: 47)"},
        {"t": "14:20:00", "svc": "user-svc",      "lvl": "ERROR", "msg": "DB connection timeout after 5000ms — request aborted"},
        {"t": "14:20:03", "svc": "product-svc",   "lvl": "ERROR", "msg": "DB connection timeout after 5000ms — request aborted"},
        {"t": "14:22:05", "svc": "alertmanager",  "lvl": "ALERT", "msg": "FIRING: P99Latency=12300ms > threshold=2000ms"},
    ],
    "INC-003": [
        {"t": "07:00:00", "svc": "rec-svc",     "lvl": "INFO",  "msg": "Heap: 1.2 GB / 4 GB (30%) — nominal"},
        {"t": "08:00:00", "svc": "rec-svc",     "lvl": "INFO",  "msg": "Heap: 2.1 GB / 4 GB (52%) — trending upward"},
        {"t": "09:00:00", "svc": "rec-svc",     "lvl": "WARN",  "msg": "Heap: 3.4 GB / 4 GB (85%) — GC pause 2.3s"},
        {"t": "09:30:00", "svc": "rec-svc",     "lvl": "ERROR", "msg": "GC overhead limit exceeded — application stalling"},
        {"t": "09:45:33", "svc": "kubernetes",  "lvl": "ERROR", "msg": "OOMKilled: rec-svc pod/rec-7d9f (exit 137)"},
        {"t": "09:45:45", "svc": "api-gateway", "lvl": "WARN",  "msg": "recommendation-svc 503 — cold start delay 45s"},
    ],
}

def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def _mins_ago(n: int) -> str:
    ts = datetime.now(timezone.utc) - timedelta(minutes=n)
    return ts.strftime("%Y-%m-%dT%H:%M:%SZ")

def _fmt_ago(minutes: int) -> str:
    if minutes < 60: return f"{minutes}m ago"
    return f"{minutes // 60}h ago"


# ╔══════════════════════════════════════════════════════════════╗
# ║  MOCK DATADOG CLIENT                                         ║
# ╚══════════════════════════════════════════════════════════════╝
class MockDatadogClient:
    """
    Simulates Datadog API responses with realistic monitor/metric/log data.
    Drop-in replacement for DatadogClient — identical interface.
    """

    # ── Connection Test ────────────────────────────────────────
    async def test_connection(self) -> dict:
        await _fake_latency(80, 200)
        return {
            "ok": True,
            "simulated": True,
            "detail": "Datadog (simulated) — 3 monitors firing in production",
            "org": "nexus-demo",
            "site": "datadoghq.com",
        }

    # ── Monitors ──────────────────────────────────────────────
    async def list_alerting_monitors(self, tags=None) -> list[dict]:
        await _fake_latency(150, 300)
        return [
            {
                "id": "INC-001",
                "source": "datadog",
                "dd_monitor_id": 83921,
                "title": "Payment Service Error Rate > 5%",
                "service": "payment-service",
                "severity": "P0",
                "status": "open",
                "ago": _fmt_ago(2),
                "triggered_at": _mins_ago(2),
                "dd_query": "avg(last_5m):sum:trace.http.request.errors{service:payment-service} / sum:trace.http.request.hits{service:payment-service} * 100 > 5",
                "dd_tags": ["env:production", "service:payment-service", "team:payments", "version:v2.3.1"],
                "logs": _DEMO_LOGS["INC-001"],
                "metrics": {
                    "payment_error_rate":    {"value": 8.3,  "unit": "%",  "threshold": 5.0, "source": "datadog"},
                    "api_latency_p99_ms":    {"value": 4200, "normal": 200, "source": "datadog"},
                    "orders_per_minute":     {"value": 12,   "normal": 340, "source": "datadog"},
                },
                "deployments": [
                    {"time": "02:30:00", "service": "payment-service", "version": "v2.3.1", "author": "ci-pipeline", "pr": "#4821"}
                ],
            },
            {
                "id": "INC-002",
                "source": "datadog",
                "dd_monitor_id": 83944,
                "title": "API Latency P99 > 10s",
                "service": "user-service",
                "severity": "P1",
                "status": "open",
                "ago": _fmt_ago(14),
                "triggered_at": _mins_ago(14),
                "dd_query": "avg(last_5m):avg:trace.http.request.duration.by.service{service:user-service} > 10",
                "dd_tags": ["env:production", "service:user-service", "team:platform"],
                "logs": _DEMO_LOGS["INC-002"],
                "metrics": {
                    "db_active_connections":  {"value": 20,    "max_pool": 20,  "source": "datadog"},
                    "db_waiting_connections": {"value": 47,                     "source": "datadog"},
                    "api_latency_p99_ms":     {"value": 12300, "normal": 180,   "source": "datadog"},
                    "db_cpu_percent":         {"value": 94,    "normal": 30,    "source": "datadog"},
                },
                "deployments": [],
            },
            {
                "id": "INC-003",
                "source": "datadog",
                "dd_monitor_id": 83967,
                "title": "recommendation-service OOMKilled",
                "service": "recommendation-service",
                "severity": "P2",
                "status": "open",
                "ago": _fmt_ago(60),
                "triggered_at": _mins_ago(60),
                "dd_query": "events('sources:kubernetes priority:all tags:recommendation-service').rollup('count').last('5m') > 0",
                "dd_tags": ["env:production", "service:recommendation-service", "team:ml"],
                "logs": _DEMO_LOGS["INC-003"],
                "metrics": {
                    "heap_gb_series":    {"values": [1.2, 2.1, 3.4, 4.0], "source": "datadog"},
                    "gc_pause_ms":       {"value": 8200, "normal": 50,     "source": "datadog"},
                    "pod_restarts_24h":  {"value": 4,                      "source": "datadog"},
                },
                "deployments": [
                    {"time": "2024-01-14T22:00:00Z", "service": "recommendation-service", "version": "v1.8.0", "change": "Added in-memory caching for user embeddings"}
                ],
            },
        ]

    # ── Events ────────────────────────────────────────────────
    async def get_events(self, start: int, end: int, tags=None, priority="all", sources="") -> list[dict]:
        await _fake_latency(100, 200)
        return [
            {
                "id": 9182736,
                "title": "Deployment payment-service v2.3.1",
                "text": "CI pipeline deployed payment-service v2.3.1 to production (342 instances)",
                "date_happened": start + 1800,
                "tags": ["deployment", "service:payment-service", "version:v2.3.1"],
                "source": "ci-pipeline",
                "priority": "normal",
            },
            {
                "id": 9182737,
                "title": "Monitor Alert: Payment Service Error Rate > 5%",
                "text": "Payment error rate is 8.3% — above threshold of 5%",
                "date_happened": start + 2051,
                "tags": ["monitor", "service:payment-service", "alert"],
                "source": "datadog",
                "priority": "high",
            },
        ]

    # ── Metrics ───────────────────────────────────────────────
    async def query_metrics(self, query: str, start: int, end: int) -> dict:
        await _fake_latency(80, 150)
        # Generate a realistic time series
        step = 60  # 1-min intervals
        points = []
        t = start
        base = random.uniform(0.5, 2.0)
        while t < end:
            val = base + random.gauss(0, 0.1)
            points.append([t * 1000, round(max(0, val), 3)])
            t += step
        return {
            "status": "ok",
            "series": [{
                "metric": query.split(":")[1].split("{")[0] if ":" in query else "metric",
                "pointlist": points,
                "scope": "env:production",
                "unit": [{"family": "percentage", "name": "percent"}, None],
            }],
            "from_date": start * 1000,
            "to_date": end * 1000,
            "simulated": True,
        }

    # ── Logs ──────────────────────────────────────────────────
    async def search_logs(self, query: str, from_ts: str, to_ts: str, limit: int = 100) -> list[dict]:
        await _fake_latency(120, 250)
        # Return logs matching the queried service
        for inc_id, logs in _DEMO_LOGS.items():
            for log in logs:
                if log["svc"].replace("-svc", "") in query or log["svc"] in query:
                    return logs
        return _DEMO_LOGS["INC-001"]

    # ── Enrich ────────────────────────────────────────────────
    async def enrich_incident(self, incident: dict) -> dict:
        await _fake_latency(50, 100)
        inc_id = incident.get("id", "INC-001")
        # Set logs from demo data if not already populated
        if not incident.get("logs"):
            incident["logs"] = _DEMO_LOGS.get(inc_id, _DEMO_LOGS["INC-001"])
        # Add simulated metric enrichment badge
        if "metrics" not in incident:
            incident["metrics"] = {}
        incident["metrics"]["_source"] = "datadog_simulated"
        return incident


# ╔══════════════════════════════════════════════════════════════╗
# ║  MOCK PAGERDUTY CLIENT                                       ║
# ╚══════════════════════════════════════════════════════════════╝
class MockPagerDutyClient:
    """
    Simulates PagerDuty API responses with realistic incident/log-entry data.
    Drop-in replacement for PagerDutyClient — identical interface.
    """

    _INCIDENTS = [
        {
            "id": "INC-001",
            "pd_id": "Q3V2WX8YZ1",
            "title": "Payment Service Error Rate 8.3%",
            "service": "payment-service",
            "severity": "P0",
            "status": "triggered",
            "urgency": "high",
            "ago_mins": 2,
            "assignee": "alice.chen@company.com",
            "pd_url": "https://app.pagerduty.com/incidents/Q3V2WX8YZ1",
        },
        {
            "id": "INC-002",
            "pd_id": "Q7A3BC9DE2",
            "title": "API Latency P99 Spiked to 12.3s",
            "service": "user-service",
            "severity": "P1",
            "status": "acknowledged",
            "urgency": "high",
            "ago_mins": 14,
            "assignee": "bob.kim@company.com",
            "pd_url": "https://app.pagerduty.com/incidents/Q7A3BC9DE2",
        },
        {
            "id": "INC-003",
            "pd_id": "Q2F4GH7IJ3",
            "title": "recommendation-service OOMKilled",
            "service": "recommendation-service",
            "severity": "P2",
            "status": "triggered",
            "urgency": "low",
            "ago_mins": 60,
            "assignee": "carol.lee@company.com",
            "pd_url": "https://app.pagerduty.com/incidents/Q2F4GH7IJ3",
        },
    ]

    # ── Connection Test ────────────────────────────────────────
    async def test_connection(self) -> dict:
        await _fake_latency(100, 250)
        return {
            "ok": True,
            "simulated": True,
            "detail": "PagerDuty (simulated) — oncall@company.com · 2 active incidents",
            "account": "https://nexus-demo.pagerduty.com",
        }

    # ── Incidents ─────────────────────────────────────────────
    async def list_incidents(self, statuses=None, limit=25, team_ids=None) -> list[dict]:
        await _fake_latency(150, 320)
        if statuses is None:
            statuses = ["triggered", "acknowledged"]
        return [self._shape(inc) for inc in self._INCIDENTS if inc["status"] in statuses]

    async def get_incident(self, incident_id: str) -> dict:
        await _fake_latency(80, 180)
        # Match by NEXUS ID or PD ID
        for inc in self._INCIDENTS:
            if incident_id in (inc["id"], f"PD-{inc['pd_id']}", inc["pd_id"]):
                return self._shape(inc)
        # Fallback to first incident
        return self._shape(self._INCIDENTS[0])

    async def get_log_entries(self, incident_id: str, limit: int = 50) -> list[dict]:
        await _fake_latency(100, 200)
        # Find which demo incident this maps to
        nexus_id = "INC-001"
        for inc in self._INCIDENTS:
            if incident_id in (inc["id"], f"PD-{inc['pd_id']}", inc["pd_id"]):
                nexus_id = inc["id"]
                break

        ago_mins = next((i["ago_mins"] for i in self._INCIDENTS if i["id"] == nexus_id), 5)

        # Return realistic PD-style timeline entries for this incident
        pd_timeline = [
            {"t": "00:00:00", "svc": "pagerduty",  "lvl": "ALERT", "msg": f"Incident triggered — {_get_title(nexus_id)}"},
            {"t": "00:00:30", "svc": "pagerduty",  "lvl": "INFO",  "msg": f"Notified {_get_assignee(nexus_id)} via push notification"},
            {"t": "00:01:15", "svc": "pagerduty",  "lvl": "INFO",  "msg": f"Notified {_get_assignee(nexus_id)} via phone call"},
            {"t": "00:03:00", "svc": "pagerduty",  "lvl": "INFO",  "msg": f"Acknowledged by {_get_assignee(nexus_id)}"},
        ]
        # Prepend the actual service logs
        return _DEMO_LOGS.get(nexus_id, []) + pd_timeline

    async def get_alerts(self, incident_id: str) -> list[dict]:
        await _fake_latency(60, 120)
        return [
            {
                "id": f"ALERT-{incident_id[-4:]}01",
                "summary": _get_title(incident_id),
                "status": "triggered",
                "created_at": _mins_ago(5),
                "severity": "critical",
                "body": {"details": {"runbook": "https://wiki.company.com/runbooks/sre"}},
            }
        ]

    # ── Enrich ────────────────────────────────────────────────
    async def enrich_incident(self, incident: dict) -> dict:
        await _fake_latency(80, 160)
        inc_id = incident.get("id", "INC-001")
        if not incident.get("logs"):
            logs = await self.get_log_entries(inc_id)
            incident["logs"] = logs
        incident["_pd_simulated"] = True
        return incident

    # ── Shape ─────────────────────────────────────────────────
    def _shape(self, inc: dict) -> dict:
        created_at = _mins_ago(inc["ago_mins"])
        return {
            "id": inc["id"],
            "source": "pagerduty",
            "title": inc["title"],
            "service": inc["service"],
            "severity": inc["severity"],
            "status": inc["status"],
            "ago": _fmt_ago(inc["ago_mins"]),
            "triggered_at": created_at,
            "pd_incident_id": inc["pd_id"],
            "pd_incident_number": int(inc["pd_id"][-4:], 16) % 9999 + 1000,
            "pd_url": inc["pd_url"],
            "assignee": inc["assignee"],
            "logs": _DEMO_LOGS.get(inc["id"], []),
            "metrics": {},
            "deployments": [],
        }


# ─── HELPERS ──────────────────────────────────────────────────
async def _fake_latency(min_ms: int = 50, max_ms: int = 200):
    """Simulate realistic network latency so the UI feels real."""
    import asyncio
    ms = random.randint(min_ms, max_ms) / 1000
    await asyncio.sleep(ms)


def _get_title(inc_id: str) -> str:
    titles = {
        "INC-001": "Payment Service Error Rate 8.3%",
        "INC-002": "API Latency P99 Spiked to 12.3s",
        "INC-003": "recommendation-service OOMKilled",
    }
    return titles.get(inc_id, "Unknown Incident")


def _get_assignee(inc_id: str) -> str:
    assignees = {
        "INC-001": "alice.chen@company.com",
        "INC-002": "bob.kim@company.com",
        "INC-003": "carol.lee@company.com",
    }
    return assignees.get(inc_id, "oncall@company.com")
