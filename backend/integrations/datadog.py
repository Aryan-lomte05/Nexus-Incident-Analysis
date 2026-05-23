# ╔══════════════════════════════════════════════════════════════╗
# ║  Datadog Integration Client                                   ║
# ║  Docs: https://docs.datadoghq.com/api/latest/               ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Supports:
#   - List alerting monitors
#   - Query metrics (time series)
#   - Search logs (v2)
#   - Fetch events / audit trail

import httpx
import time
from typing import Optional


class DatadogClient:
    def __init__(self, api_key: str, app_key: str, site: str = "datadoghq.com"):
        self.api_key = api_key
        self.app_key = app_key
        self.base_url = f"https://api.{site}"
        self.headers = {
            "DD-API-KEY": api_key,
            "DD-APPLICATION-KEY": app_key,
            "Content-Type": "application/json",
        }

    # ─── CONNECTION TEST ───────────────────────────────────────
    async def test_connection(self) -> dict:
        """Validate credentials by hitting the validate endpoint."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/api/v1/validate",
                headers=self.headers,
            )
            if resp.status_code == 200:
                return {"ok": True, "detail": "Datadog connected"}
            return {"ok": False, "detail": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    # ─── MONITORS ─────────────────────────────────────────────
    async def list_alerting_monitors(self, tags: Optional[str] = None) -> list[dict]:
        """
        Return monitors currently in ALERT or WARN state.
        Each monitor is shaped into a NEXUS-compatible incident dict.
        """
        params = {"monitor_states": "Alert,Warn", "with_downtimes": "false"}
        if tags:
            params["monitor_tags"] = tags

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/api/v1/monitor",
                headers=self.headers,
                params=params,
            )
            resp.raise_for_status()
            monitors = resp.json()

        incidents = []
        for m in monitors:
            state = m.get("overall_state", "Unknown")
            severity = _dd_state_to_severity(state)
            incidents.append({
                "id": f"DD-{m['id']}",
                "source": "datadog",
                "title": m.get("name", "Unnamed Monitor"),
                "service": _extract_service_tag(m.get("tags", [])),
                "severity": severity,
                "status": "open",
                "ago": _format_ts(m.get("state_changed_at")),
                "triggered_at": m.get("state_changed_at"),
                "dd_monitor_id": m["id"],
                "dd_query": m.get("query", ""),
                "dd_tags": m.get("tags", []),
                "logs": [],   # enriched lazily when incident is opened
                "metrics": {},
                "deployments": [],
            })
        return incidents

    # ─── EVENTS ───────────────────────────────────────────────
    async def get_events(
        self,
        start: int,  # unix epoch
        end: int,
        tags: Optional[str] = None,
        priority: str = "all",
        sources: str = "",
    ) -> list[dict]:
        """Fetch Datadog events for a given time window."""
        params = {
            "start": start,
            "end": end,
            "priority": priority,
        }
        if tags:
            params["tags"] = tags

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/api/v1/events",
                headers=self.headers,
                params=params,
            )
            resp.raise_for_status()
            return resp.json().get("events", [])

    # ─── METRICS ──────────────────────────────────────────────
    async def query_metrics(
        self,
        query: str,
        start: int,
        end: int,
    ) -> dict:
        """
        Query a Datadog metrics expression.
        Example query: "avg:system.cpu.user{service:payment-service}"
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/api/v1/query",
                headers=self.headers,
                params={"from": start, "to": end, "query": query},
            )
            resp.raise_for_status()
            return resp.json()

    # ─── LOGS ─────────────────────────────────────────────────
    async def search_logs(
        self,
        query: str,
        from_ts: str,  # ISO8601 e.g. "2024-01-15T02:00:00Z"
        to_ts: str,
        limit: int = 100,
    ) -> list[dict]:
        """
        Search Datadog logs via Logs Search API v2.
        Returns logs shaped as NEXUS log entries.
        """
        body = {
            "filter": {
                "query": query,
                "from": from_ts,
                "to": to_ts,
                "indexes": ["*"],
            },
            "sort": "timestamp",
            "page": {"limit": min(limit, 1000)},
        }

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{self.base_url}/api/v2/logs/events/search",
                headers=self.headers,
                json=body,
            )
            resp.raise_for_status()
            raw_logs = resp.json().get("data", [])

        # Shape into NEXUS format
        shaped = []
        for log in raw_logs:
            attrs = log.get("attributes", {})
            shaped.append({
                "t": attrs.get("timestamp", "")[:8],
                "svc": attrs.get("service", "unknown"),
                "lvl": attrs.get("status", "INFO").upper(),
                "msg": attrs.get("message", ""),
            })
        return shaped

    # ─── ENRICH INCIDENT ──────────────────────────────────────
    async def enrich_incident(self, incident: dict) -> dict:
        """
        Given a NEXUS incident dict, populate its logs and metrics
        from Datadog using the monitor's tags and timeframe.
        """
        triggered_at = incident.get("triggered_at")
        if not triggered_at:
            return incident

        # Build time window: 30min before → now
        end_ts = int(time.time())
        start_ts = end_ts - 3600  # 1 hour window

        service = incident.get("service", "")
        tags = incident.get("dd_tags", [])
        service_tag = next((t for t in tags if t.startswith("service:")), None)
        log_query = f"service:{service}" if service else "status:error"

        try:
            # Fetch logs
            from datetime import datetime, timezone
            from_ts = datetime.fromtimestamp(start_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            to_ts = datetime.fromtimestamp(end_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            logs = await self.search_logs(log_query, from_ts, to_ts, limit=50)
            incident["logs"] = logs or incident["logs"]
        except Exception as e:
            print(f"[DD] Log fetch failed: {e}")

        try:
            # Fetch error rate metric
            if service:
                metrics_data = await self.query_metrics(
                    f"avg:trace.http.request.errors{{service:{service}}} / avg:trace.http.request.hits{{service:{service}}} * 100",
                    start_ts, end_ts,
                )
                series = metrics_data.get("series", [])
                if series:
                    points = series[0].get("pointlist", [])
                    if points:
                        latest = points[-1][1]
                        incident["metrics"]["error_rate"] = {
                            "value": round(latest, 2),
                            "unit": "%",
                            "source": "datadog",
                        }
        except Exception as e:
            print(f"[DD] Metrics fetch failed: {e}")

        return incident


# ─── HELPERS ──────────────────────────────────────────────────
def _dd_state_to_severity(state: str) -> str:
    return {"Alert": "P1", "Warn": "P2", "No Data": "P3"}.get(state, "P2")


def _extract_service_tag(tags: list[str]) -> str:
    for t in tags:
        if t.startswith("service:"):
            return t.split(":", 1)[1]
    return "unknown-service"


def _format_ts(ts) -> str:
    if not ts:
        return "unknown"
    try:
        import time as t_mod
        delta = int(t_mod.time()) - int(ts)
        if delta < 60:
            return f"{delta}s ago"
        if delta < 3600:
            return f"{delta // 60}m ago"
        return f"{delta // 3600}h ago"
    except Exception:
        return str(ts)
