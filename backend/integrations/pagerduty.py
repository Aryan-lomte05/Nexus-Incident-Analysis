# ╔══════════════════════════════════════════════════════════════╗
# ║  PagerDuty Integration Client                                 ║
# ║  Docs: https://developer.pagerduty.com/api-reference/        ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Supports:
#   - List active incidents (triggered / acknowledged)
#   - Get single incident detail
#   - Get incident log entries (timeline)
#   - Get related alerts

import httpx
from typing import Optional


class PagerDutyClient:
    BASE_URL = "https://api.pagerduty.com"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Token token={api_key}",
            "Accept": "application/vnd.pagerduty+json;version=2",
            "Content-Type": "application/json",
        }

    # ─── CONNECTION TEST ───────────────────────────────────────
    async def test_connection(self) -> dict:
        """Validate API key by fetching the current user."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.BASE_URL}/users/me",
                headers=self.headers,
            )
            if resp.status_code == 200:
                user = resp.json().get("user", {})
                return {
                    "ok": True,
                    "detail": f"PagerDuty connected as {user.get('name', 'unknown')}",
                    "account": user.get("html_url", ""),
                }
            return {"ok": False, "detail": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    # ─── INCIDENTS ────────────────────────────────────────────
    async def list_incidents(
        self,
        statuses: list[str] = None,
        limit: int = 25,
        team_ids: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        List active PagerDuty incidents shaped as NEXUS incident dicts.
        statuses: ["triggered", "acknowledged", "resolved"]
        """
        if statuses is None:
            statuses = ["triggered", "acknowledged"]

        params = {
            "limit": limit,
            "sort_by": "created_at:desc",
        }
        for s in statuses:
            params[f"statuses[]"] = s

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.BASE_URL}/incidents",
                headers=self.headers,
                params=params,
            )
            resp.raise_for_status()
            incidents = resp.json().get("incidents", [])

        return [self._shape_incident(inc) for inc in incidents]

    async def get_incident(self, incident_id: str) -> dict:
        """Fetch full details of a single PD incident."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.BASE_URL}/incidents/{incident_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return self._shape_incident(resp.json()["incident"])

    async def get_log_entries(self, incident_id: str, limit: int = 50) -> list[dict]:
        """
        Fetch log entries (timeline of notifications, escalations, acks)
        for an incident — shaped as NEXUS log entries.
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.BASE_URL}/incidents/{incident_id}/log_entries",
                headers=self.headers,
                params={"limit": limit, "include[]": ["channels", "teams", "services"]},
            )
            resp.raise_for_status()
            entries = resp.json().get("log_entries", [])

        shaped = []
        for e in entries:
            etype = e.get("type", "")
            msg = _pd_entry_message(e)
            ts = e.get("created_at", "")[:19].replace("T", " ")
            svc = e.get("service", {}).get("summary", "pagerduty")
            shaped.append({
                "t": ts[11:19],   # HH:MM:SS
                "svc": svc,
                "lvl": _pd_entry_level(etype),
                "msg": msg,
            })
        return shaped

    async def get_alerts(self, incident_id: str) -> list[dict]:
        """Fetch alerts associated with an incident."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.BASE_URL}/incidents/{incident_id}/alerts",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json().get("alerts", [])

    # ─── ENRICH INCIDENT ──────────────────────────────────────
    async def enrich_incident(self, incident: dict) -> dict:
        """
        Populate the incident's log entries from PagerDuty's timeline.
        Call this when a user selects an incident for analysis.
        """
        pd_id = incident.get("pd_incident_id")
        if not pd_id:
            return incident

        try:
            log_entries = await self.get_log_entries(pd_id)
            if log_entries:
                incident["logs"] = log_entries
        except Exception as e:
            print(f"[PD] Log entries fetch failed for {pd_id}: {e}")

        return incident

    # ─── SHAPER ───────────────────────────────────────────────
    def _shape_incident(self, pd: dict) -> dict:
        """Convert a raw PD incident dict to a NEXUS incident dict."""
        status = pd.get("status", "triggered")
        severity = _pd_urgency_to_severity(pd.get("urgency", "high"), status)
        created_at = pd.get("created_at", "")

        # Extract service name
        service_obj = pd.get("service", {})
        service_name = service_obj.get("summary", "unknown-service")

        return {
            "id": f"PD-{pd['id']}",
            "source": "pagerduty",
            "title": pd.get("title", "Unnamed Incident"),
            "service": service_name,
            "severity": severity,
            "status": status,
            "ago": _format_created_at(created_at),
            "triggered_at": created_at,
            "pd_incident_id": pd["id"],
            "pd_incident_number": pd.get("incident_number"),
            "pd_url": pd.get("html_url", ""),
            "assignee": _get_assignee(pd),
            "logs": [],        # populated by enrich_incident()
            "metrics": {},
            "deployments": [],
        }


# ─── HELPERS ──────────────────────────────────────────────────
def _pd_urgency_to_severity(urgency: str, status: str) -> str:
    if status == "triggered":
        return "P0" if urgency == "high" else "P1"
    if status == "acknowledged":
        return "P1" if urgency == "high" else "P2"
    return "P3"


def _pd_entry_level(etype: str) -> str:
    if "notify" in etype or "escalate" in etype:
        return "ALERT"
    if "acknowledge" in etype:
        return "INFO"
    if "resolve" in etype:
        return "INFO"
    if "trigger" in etype:
        return "ERROR"
    return "INFO"


def _pd_entry_message(entry: dict) -> str:
    etype = entry.get("type", "")
    channel = entry.get("channel", {})
    agent = entry.get("agent", {}).get("summary", "system")

    if "notify" in etype:
        notif = entry.get("notification", {})
        return f"Notified {agent} via {notif.get('type', 'unknown')}: {notif.get('address', '')}"
    if "acknowledge" in etype:
        return f"Acknowledged by {agent}"
    if "resolve" in etype:
        return f"Resolved by {agent}"
    if "escalate" in etype:
        return f"Escalated to {agent}"
    if "annotate" in etype:
        return entry.get("channel", {}).get("summary", "Note added")
    if "trigger" in etype:
        summary = channel.get("summary", "") or entry.get("channel", {}).get("details", "Incident triggered")
        return summary[:200]
    return entry.get("summary", etype)


def _get_assignee(pd: dict) -> str:
    assignments = pd.get("assignments", [])
    if assignments:
        return assignments[0].get("assignee", {}).get("summary", "Unassigned")
    return "Unassigned"


def _format_created_at(ts: str) -> str:
    if not ts:
        return "unknown"
    try:
        from datetime import datetime, timezone
        created = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = int((now - created).total_seconds())
        if delta < 60:
            return f"{delta}s ago"
        if delta < 3600:
            return f"{delta // 60}m ago"
        if delta < 86400:
            return f"{delta // 3600}h ago"
        return f"{delta // 86400}d ago"
    except Exception:
        return ts[:10]
