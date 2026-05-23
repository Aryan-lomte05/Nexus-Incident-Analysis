// ╔══════════════════════════════════════════════════════════════╗
// ║  NEXUS — AI Incident Root Cause Analyzer                    ║
// ║  Aesthetic: Dark Military Operations Center                  ║
// ║  Fonts: Outfit (UI) · JetBrains Mono (data/logs)            ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, Terminal, Clock, Radio, Copy, Check, Settings,
  Loader2, Shield, GitCommit, Server, AlertCircle,
  Activity, ChevronRight, CheckCircle2, Flame, Cpu,
  X, Wifi, WifiOff, RefreshCw, Database, Bell
} from "lucide-react"

// ─── DESIGN TOKENS ────────────────────────────────────────────
const C = {
  bg:           "#0A0E1A",
  panel:        "#0D1322",
  panelDeep:    "#070B15",
  panelHi:      "#111929",
  border:       "rgba(0,212,255,0.08)",
  borderHi:     "rgba(0,212,255,0.18)",
  borderActive: "rgba(0,212,255,0.35)",
  text:         "#E8EBF4",
  muted:        "#7B8DB0",
  dim:          "#3D4F72",
  cyan:         "#00D4FF",
  cyanDim:      "rgba(0,212,255,0.06)",
  cyanGlow:     "rgba(0,212,255,0.15)",
  amber:        "#FFB800",
  amberDim:     "rgba(255,184,0,0.07)",
  red:          "#FF3B3B",
  redDim:       "rgba(255,59,59,0.07)",
  green:        "#00E87A",
  greenDim:     "rgba(0,232,122,0.07)",
  purple:       "#9B5FFF",
}

const MONO = "'JetBrains Mono', monospace"

const SEV = {
  P0: { text: C.red,    bg: "rgba(255,59,59,0.06)",  border: "rgba(255,59,59,0.28)",  dot: C.red,    name: "CRITICAL" },
  P1: { text: C.amber,  bg: "rgba(255,184,0,0.06)",  border: "rgba(255,184,0,0.28)",  dot: C.amber,  name: "HIGH"     },
  P2: { text: C.cyan,   bg: "rgba(0,212,255,0.05)",  border: "rgba(0,212,255,0.22)",  dot: C.cyan,   name: "MEDIUM"   },
  P3: { text: C.muted,  bg: "rgba(123,141,176,0.05)", border: "rgba(123,141,176,0.2)", dot: C.muted,  name: "LOW"      },
}

const LOG_COLORS = { ERROR: C.red, FATAL: C.red, WARN: C.amber, ALERT: C.cyan, INFO: C.dim }

// ─── INCIDENT DATA ────────────────────────────────────────────
const INCIDENTS = [
  {
    id: "INC-001", title: "Payment Service Error Rate 8.3%",
    service: "payment-service", severity: "P0", ago: "2m ago",
    logs: [
      { t: "02:30:00", svc: "payment-svc",  lvl: "INFO",  msg: "Deployment v2.3.1 started — 342 instances rolling" },
      { t: "02:30:45", svc: "payment-svc",  lvl: "INFO",  msg: "Deployment v2.3.1 complete ✓" },
      { t: "02:31:02", svc: "payment-svc",  lvl: "ERROR", msg: "NullPointerException: PaymentProcessor.charge() line 247" },
      { t: "02:31:03", svc: "payment-svc",  lvl: "ERROR", msg: "NullPointerException: PaymentProcessor.charge() line 247" },
      { t: "02:31:04", svc: "payment-svc",  lvl: "ERROR", msg: "NullPointerException: PaymentProcessor.charge() line 247 [+244 similar]" },
      { t: "02:31:15", svc: "api-gateway",  lvl: "WARN",  msg: "payment-svc circuit breaker OPEN after 247 failures" },
      { t: "02:32:00", svc: "order-svc",    lvl: "ERROR", msg: "Upstream payment-svc unavailable — checkout failing" },
      { t: "02:34:11", svc: "alertmanager", lvl: "ALERT", msg: "FIRING ⚡ PaymentErrorRate=8.3% > threshold=5%" },
    ],
    analysis: {
      severity: "P0", confidence: 0.94,
      title: "Deployment Regression — payment-service v2.3.1",
      root_cause: {
        summary: "NullPointerException in PaymentProcessor.charge() at line 247 introduced in v2.3.1. PR #4821 removed null-safety guards for optional billing_address fields — every payment request without a saved address now throws, cascading into circuit breaker activation and full checkout failure.",
        component: "payment-service v2.3.1 → PaymentProcessor.charge():247",
        category: "DEPLOYMENT REGRESSION",
        evidence: [
          "247 NullPointerExceptions in 60s, onset 17s after deploy completion at 02:30:45",
          "Circuit breaker opened at 02:31:15 — exactly 90s post-deployment",
          "Zero errors in 24h prior to deploy — 100% correlated onset",
        ],
      },
      blast_radius: {
        services: ["payment-service", "order-service", "api-gateway"],
        users: "~12,400 active", revenue: "$93 / min",
      },
      timeline: [
        { time: "02:30:00", event: "Deployment v2.3.1 initiated by CI pipeline", src: "deploy" },
        { time: "02:30:45", event: "Deployment complete — 342 instances updated", src: "deploy" },
        { time: "02:31:02", event: "First NullPointerException — 247 errors/min", src: "log" },
        { time: "02:31:15", event: "Circuit breaker OPEN — api-gateway isolates svc", src: "log" },
        { time: "02:32:00", event: "Order checkout failures cascade downstream", src: "log" },
        { time: "02:34:11", event: "Alert fired — ErrorRate 8.3% > 5% threshold", src: "alert" },
      ],
      fix: { cmd: "kubectl rollout undo deployment/payment-service", eta: "~3 min" },
      prevention: [
        { text: "Add null-safety unit tests for all optional PaymentProcessor inputs before merge", priority: "HIGH" },
        { text: "Enforce canary rollout (5% → 25% → 100%) for all payment-service deploys", priority: "HIGH" },
        { text: "Lower alert threshold from 5% to 2% — 5% error rate is already catastrophic", priority: "MED" },
      ],
    },
  },
  {
    id: "INC-002", title: "API Latency P99 Spiked to 12.3s",
    service: "user-service", severity: "P1", ago: "14m ago",
    logs: [
      { t: "14:15:00", svc: "user-svc",      lvl: "WARN",  msg: "DB connection wait 2300ms (pool: 20/20, waiting: 12)" },
      { t: "14:17:30", svc: "product-svc",   lvl: "WARN",  msg: "DB connection wait 4100ms — pool near exhaustion" },
      { t: "14:19:00", svc: "analytics-job", lvl: "INFO",  msg: "Daily report started — full table scan on orders (45.2M rows)" },
      { t: "14:19:45", svc: "user-svc",      lvl: "WARN",  msg: "DB connection wait 8200ms (pool: 20/20, waiting: 47)" },
      { t: "14:20:00", svc: "user-svc",      lvl: "ERROR", msg: "DB connection timeout after 5000ms — request aborted" },
      { t: "14:20:03", svc: "product-svc",   lvl: "ERROR", msg: "DB connection timeout after 5000ms — request aborted" },
      { t: "14:22:05", svc: "alertmanager",  lvl: "ALERT", msg: "FIRING ⚡ P99Latency=12300ms > threshold=2000ms" },
    ],
    analysis: {
      severity: "P1", confidence: 0.89,
      title: "DB Connection Pool Exhausted by Analytics Full-Scan",
      root_cause: {
        summary: "The daily analytics report job launched a full table scan against orders (45.2M rows) at 14:19, consuming all 20 pooled DB connections. Application services queued behind it with nowhere to go — P99 latency climbed from 180ms to 12.3s in under 3 minutes.",
        component: "analytics-job → orders table full scan → connection pool starvation",
        category: "RESOURCE EXHAUSTION",
        evidence: [
          "Pool 20/20 active + 47 requests waiting at peak — complete saturation",
          "Analytics job start at 14:19:00 directly precedes degradation onset",
          "P99 latency 12,300ms vs baseline 180ms — 68× slowdown",
        ],
      },
      blast_radius: {
        services: ["user-service", "product-service", "analytics-job"],
        users: "~8,200 active", revenue: "$41 / min",
      },
      timeline: [
        { time: "14:15:00", event: "Connection pool pressure begins — 12 waiting", src: "metric" },
        { time: "14:19:00", event: "Analytics full table scan starts (45.2M rows)", src: "log" },
        { time: "14:19:45", event: "Pool fully saturated — 47 requests queued", src: "metric" },
        { time: "14:20:00", event: "Connection timeouts cascade across services", src: "log" },
        { time: "14:22:05", event: "Alert fired — P99 at 12.3 seconds", src: "alert" },
      ],
      fix: { cmd: "kill -9 $(pgrep analytics-job) && SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%analytics%'", eta: "~2 min" },
      prevention: [
        { text: "Route analytics jobs to read replica — never run heavy scans on primary", priority: "HIGH" },
        { text: "Dedicated connection pool (10 max) for batch jobs, isolated from app pool", priority: "HIGH" },
        { text: "Schedule heavy reports at 02:00–04:00 UTC off-peak window", priority: "MED" },
      ],
    },
  },
  {
    id: "INC-003", title: "recommendation-service OOMKilled",
    service: "recommendation-service", severity: "P2", ago: "1h ago",
    logs: [
      { t: "07:00:00", svc: "rec-svc",     lvl: "INFO",  msg: "Heap: 1.2 GB / 4 GB (30%) — nominal" },
      { t: "08:00:00", svc: "rec-svc",     lvl: "INFO",  msg: "Heap: 2.1 GB / 4 GB (52%) — trending upward" },
      { t: "09:00:00", svc: "rec-svc",     lvl: "WARN",  msg: "Heap: 3.4 GB / 4 GB (85%) — GC pause 2.3s" },
      { t: "09:30:00", svc: "rec-svc",     lvl: "ERROR", msg: "GC overhead limit exceeded — application stalling" },
      { t: "09:45:33", svc: "kubernetes",  lvl: "ERROR", msg: "OOMKilled: rec-svc pod/rec-7d9f (exit 137)" },
      { t: "09:45:45", svc: "api-gateway", lvl: "WARN",  msg: "recommendation-svc 503 — cold start delay 45s" },
    ],
    analysis: {
      severity: "P2", confidence: 0.87,
      title: "Memory Leak — Unbounded In-Memory Embedding Cache",
      root_cause: {
        summary: "v1.8.0 (deployed yesterday 22:00 UTC) introduced in-memory caching for user embeddings with no eviction policy and no size limit. Over 9 hours, 900 MB/hr accumulated linearly until the 4 GB container limit was breached. This is the 4th OOMKill in 24 hours.",
        component: "recommendation-service v1.8.0 → EmbeddingCache (no TTL, no max_size)",
        category: "MEMORY LEAK",
        evidence: [
          "Heap: 1.2 → 2.1 → 3.4 → 4.0 GB — linear growth at 900 MB/hr",
          "v1.8.0 changelog: 'Added in-memory caching for user embeddings'",
          "4 OOMKills in 24h — deterministic escalating pattern",
        ],
      },
      blast_radius: {
        services: ["recommendation-service", "api-gateway"],
        users: "~2,100 active", revenue: "$12 / min",
      },
      timeline: [
        { time: "22:00 (prev)", event: "v1.8.0 deployed with unbounded EmbeddingCache", src: "deploy" },
        { time: "07:00",        event: "Heap at 30% — leak not yet visible", src: "metric" },
        { time: "09:00",        event: "GC pressure — heap at 85%, 2.3s pauses", src: "log" },
        { time: "09:30",        event: "GC overhead limit exceeded — app stalling", src: "log" },
        { time: "09:45:33",     event: "OOMKilled — 4th pod restart in 24h", src: "k8s" },
      ],
      fix: { cmd: "kubectl rollout undo deployment/recommendation-service", eta: "~5 min" },
      prevention: [
        { text: "Implement LRU eviction on EmbeddingCache: max 10K entries, TTL 1hr", priority: "HIGH" },
        { text: "Add heap alert at 70% — fire before GC pressure begins", priority: "HIGH" },
        { text: "Require memory profiling in CI for all PRs introducing caching", priority: "MED" },
      ],
    },
  },
]

// ─── STREAM BUILDER ───────────────────────────────────────────
// ─── CLIENT STOCHASTIC ANALYSIS COMPILER ──────────────────────
const generateClientStochasticAnalysis = (inc) => {
  const isPayment = inc.service === "payment-service";
  const isUser = inc.service === "user-service";
  
  const timeline = inc.logs.map(l => {
    let src = "log";
    if (l.msg.toLowerCase().includes("rollout") || l.msg.toLowerCase().includes("deploy")) src = "deploy";
    else if (l.msg.toLowerCase().includes("alert") || l.msg.toLowerCase().includes("firing")) src = "alert";
    else if (l.msg.toLowerCase().includes("heap") || l.msg.toLowerCase().includes("connections")) src = "metric";
    else if (l.msg.toLowerCase().includes("oom") || l.msg.toLowerCase().includes("killed")) src = "k8s";
    return { time: l.t, event: l.msg, src };
  });

  if (isPayment) {
    return {
      severity: "P0",
      confidence: 0.92,
      title: "Dynamic Root Cause Analysis — Payment Gateway Regression",
      root_cause: {
        summary: "A NullPointerException occurred in PaymentProcessor.charge() at line 247. The latest deployment refactored payload handling and omitted null-checks on optional billing address structures. Orders processed without user-profiles fail, causing a cascading API timeout.",
        component: "payment-service → PaymentProcessor.charge():247",
        category: "DEPLOYMENT REGRESSION",
        evidence: [
          "HTTP 500 error rate spiked immediately following version deployment completion",
          "Gateway circuit breaker tripped to OPEN state automatically to isolate system"
        ]
      },
      blast_radius: {
        services: ["payment-service", "api-gateway", "order-service"],
        users: "~12,400 active SRE sessions",
        revenue: "$93 / min"
      },
      timeline,
      fix: { cmd: "kubectl rollout undo deployment/payment-service", eta: "~3 min" },
      prevention: [
        { text: "Add mandatory null-safety test criteria in the CI/CD pipeline.", priority: "HIGH" },
        { text: "Implement dedicated canary release bands (2% -> 10% -> 100%).", priority: "HIGH" }
      ]
    };
  } else if (isUser) {
    return {
      severity: "P1",
      confidence: 0.88,
      title: "Dynamic Root Cause Analysis — Database Connection Starvation",
      root_cause: {
        summary: "Database connection pools are fully starved due to an unindexed analytics query executing a full table scan against the orders table. The query captured all 20 pooled connection threads, blocking API requests.",
        component: "analytics-runner → orders table full scan → connection pool starvation",
        category: "RESOURCE EXHAUSTION",
        evidence: [
          "Active DB connections locked at 20/20 maximum pool threshold",
          "CPU and disk IO spikes observed on primary postgres cluster node"
        ]
      },
      blast_radius: {
        services: ["user-service", "product-service", "analytics-runner"],
        users: "~8,500 active SRE sessions",
        revenue: "$55 / min"
      },
      timeline,
      fix: { cmd: "kill -9 $(pgrep analytics) && psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%orders%';\"", eta: "~2 min" },
      prevention: [
        { text: "Migrate heavy report operations to dedicated read-replica instances.", priority: "HIGH" },
        { text: "Configure statement timeouts of 30s to prevent hanging lock queries.", priority: "HIGH" }
      ]
    };
  } else {
    return {
      severity: "P2",
      confidence: 0.85,
      title: "Dynamic Root Cause Analysis — JVM Heap Memory Leak",
      root_cause: {
        summary: "The recommendation-service was terminated by the host kernel OOM controller due to a slow memory leak. The latest release configured an unbounded memory cache to buffer recommendations but failed to implement eviction TTLs.",
        component: "recommendation-service → EmbeddingCache memory leak",
        category: "MEMORY LEAK",
        evidence: [
          "Linear growth in JVM heap allocation ending in OOMKill exit code 137",
          "Garbage collection pause times escalated to critical threshold before recycle"
        ]
      },
      blast_radius: {
        services: ["recommendation-service", "api-gateway"],
        users: "~2,100 active SRE sessions",
        revenue: "$15 / min"
      },
      timeline,
      fix: { cmd: "kubectl rollout undo deployment/recommendation-service", eta: "~5 min" },
      prevention: [
        { text: "Implement LRU eviction bounds on all in-memory caches.", priority: "HIGH" },
        { text: "Configure automated container alerts triggering heap dumps above 80%.", priority: "HIGH" }
      ]
    };
  }
};

// ─── STREAM BUILDER ───────────────────────────────────────────
const buildStream = (inc) => {
  const analysis = inc.analysis || {
    confidence: 0.90,
    root_cause: { category: "SYSTEM ANOMALY", evidence: ["Metric threshold violation", "Error rate breach"] },
    blast_radius: { services: ["api-gateway"], users: "~10,000 active", revenue: "$50 / min" },
    fix: { cmd: "kubectl rollout restart deployment/payment-service", eta: "~5 min" }
  };
  return `> NEXUS ANALYSIS ENGINE v2.4 — INCIDENT ${inc.id}
> Connecting to log aggregator...

[INIT] Fetching ${inc.logs.length} log events for ${inc.service}
      Time range: ${inc.logs[0]?.t || '00:00:00'} → ${inc.logs[inc.logs.length - 1]?.t || '00:00:00'}

[STEP 1] TIMELINE RECONSTRUCTION
         Parsing ${inc.logs.length} events... ✓
         ${inc.logs.filter(l => l.lvl === "ERROR").length} ERROR  ${inc.logs.filter(l => l.lvl === "WARN").length} WARN  ${inc.logs.filter(l => l.lvl === "ALERT").length} ALERT

[STEP 2] SIGNAL CORRELATION
         Cross-referencing deployment history...
         Correlating metric spikes with log timestamps...
         Service dependency graph: ${analysis.blast_radius.services.join(" → ")}

[STEP 3] HYPOTHESIS FORMATION
         [H1] ${analysis.root_cause.category} .............. probability HIGH ↑
         [H2] NETWORK_TIMEOUT ......................... no net errors found ✗
         [H3] DEPENDENCY_FAILURE ...................... upstreams healthy  ✗

[STEP 4] ROOT CAUSE CONFIRMATION
         Eliminating H2 and H3 — insufficient evidence
         H1 confirmed with supporting evidence:
         → ${analysis.root_cause.evidence[0]}
         → ${analysis.root_cause.evidence[1]}

[STEP 5] BLAST RADIUS ASSESSMENT
         Services affected: ${analysis.blast_radius.services.length}
         Estimated users:   ${analysis.blast_radius.users}
         Revenue impact:    ${analysis.blast_radius.revenue}

[STEP 6] REMEDIATION PLAN
         Immediate: ${analysis.fix.cmd}
         ETA: ${analysis.fix.eta}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ANALYSIS COMPLETE  |  CONFIDENCE: ${Math.round(analysis.confidence * 100)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return (
    <span style={{ fontFamily: MONO, color: C.muted, fontSize: 11 }}>
      {t.toUTCString().slice(5, 25)} UTC
    </span>
  )
}

function PulseDot({ color, size = 7 }) {
  return (
    <span className="pulse-dot" style={{ width: size, height: size, color }}>
      <span style={{ position: "relative", width: size, height: size, borderRadius: "50%", background: color, display: "block" }} />
    </span>
  )
}

function SevBadge({ sev, small }) {
  const s = SEV[sev]
  return (
    <span style={{
      color: s.text, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 3, fontSize: small ? 9 : 9.5, fontWeight: 800,
      padding: small ? "1px 5px" : "2px 7px",
      fontFamily: MONO, letterSpacing: "0.08em",
    }}>
      {sev}
    </span>
  )
}

function CopyCmd({ cmd }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(cmd)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <div className="clip-sm" style={{
      background: C.panelDeep, border: `1px solid ${done ? "rgba(0,232,122,0.3)" : "rgba(0,212,255,0.12)"}`,
      padding: "12px 14px", display: "flex", alignItems: "flex-start",
      gap: 10, marginTop: 10, transition: "border-color 0.2s",
    }}>
      <Terminal size={12} color={C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{
        fontFamily: MONO, fontSize: 11.5, color: C.green,
        flex: 1, wordBreak: "break-all", lineHeight: 1.7,
      }}>
        {cmd}
      </span>
      <button onClick={copy} style={{
        background: done ? "rgba(0,232,122,0.1)" : "rgba(0,212,255,0.05)",
        border: `1px solid ${done ? "rgba(0,232,122,0.3)" : C.border}`,
        borderRadius: 4, padding: "4px 10px",
        color: done ? C.green : C.muted,
        cursor: "pointer", display: "flex", alignItems: "center",
        gap: 5, fontSize: 10.5, fontWeight: 600, flexShrink: 0,
        transition: "all 0.2s",
      }}>
        {done ? <Check size={10} /> : <Copy size={10} />}
        {done ? "Copied!" : "Copy"}
      </button>
    </div>
  )
}

function SrcIcon({ src }) {
  const map = { deploy: GitCommit, log: Terminal, metric: Activity, alert: Flame, k8s: Server }
  const colors = { deploy: C.purple, log: C.dim, metric: C.cyan, alert: C.red, k8s: C.amber }
  const Icon = map[src] || AlertCircle
  return <Icon size={10} color={colors[src] || C.dim} />
}

// ─── TELEMETRY SVG CHART ──────────────────────────────────────
function TelemetryChart({ incident, resolved }) {
  const service = incident?.service;
  const incidentId = incident?.id;
  let points = []
  let label = ""
  let val = ""
  let threshold = 0
  let color = C.cyan
  let normalVal = ""

  if (service === "payment-service") {
    label = "payment-service — HTTP 5xx Error Rate"
    const currentVal = incident?.metrics?.payment_error_rate?.value ?? 8.5;
    val = resolved ? "0.1%" : `${currentVal}%`
    normalVal = "0.1% baseline"
    threshold = 80
    color = resolved ? C.green : C.red
    points = resolved 
      ? [
          { x: 0, y: 115 }, { x: 150, y: 115 }, { x: 180, y: 115 },
          { x: 200, y: 30 }, { x: 250, y: 35 }, { x: 300, y: 28 },
          { x: 350, y: 32 }, { x: 380, y: 115 }, { x: 500, y: 115 }
        ]
      : [
          { x: 0, y: 115 }, { x: 150, y: 115 }, { x: 180, y: 115 },
          { x: 200, y: 30 }, { x: 250, y: 35 }, { x: 300, y: 28 },
          { x: 350, y: 32 }, { x: 420, y: 25 }, { x: 500, y: 30 }
        ]
  } else if (service === "user-service") {
    label = "user-service — API Latency (p99)"
    const latencyVal = incident?.metrics?.api_latency_p99_ms?.value ?? 12300;
    val = resolved ? "180ms" : `${(latencyVal / 1000).toFixed(1)}s`
    normalVal = "180ms baseline"
    threshold = 90
    color = resolved ? C.green : C.amber
    points = resolved
      ? [
          { x: 0, y: 115 }, { x: 150, y: 115 }, { x: 180, y: 110 },
          { x: 210, y: 20 }, { x: 260, y: 24 }, { x: 310, y: 18 },
          { x: 360, y: 22 }, { x: 390, y: 115 }, { x: 500, y: 115 }
        ]
      : [
          { x: 0, y: 115 }, { x: 150, y: 115 }, { x: 180, y: 110 },
          { x: 210, y: 20 }, { x: 260, y: 24 }, { x: 310, y: 18 },
          { x: 360, y: 22 }, { x: 430, y: 15 }, { x: 500, y: 17 }
        ]
  } else {
    label = "recommendation-service — JVM Heap Memory"
    const heapVal = incident?.metrics?.heap_gb?.value ?? 4.0;
    val = resolved ? "1.2 GB" : `${heapVal.toFixed(1)} GB`
    normalVal = "1.2 GB baseline"
    threshold = 40
    color = resolved ? C.green : C.amber
    points = resolved
      ? [
          { x: 0, y: 115 }, { x: 100, y: 90 }, { x: 200, y: 65 },
          { x: 300, y: 40 }, { x: 360, y: 20 }, { x: 380, y: 115 },
          { x: 500, y: 115 }
        ]
      : [
          { x: 0, y: 115 }, { x: 100, y: 90 }, { x: 200, y: 65 },
          { x: 300, y: 40 }, { x: 400, y: 20 }, { x: 500, y: 10 }
        ]
  }

  const dPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const areaPath = `${dPath} L 500 120 L 0 120 Z`

  return (
    <div style={{
      background: "#050912", border: `1px solid ${C.border}`,
      padding: "12px 14px", borderRadius: 6, position: "relative",
      height: 140, display: "flex", flexDirection: "column",
      justifyContent: "space-between", overflow: "hidden", marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: C.dim, fontFamily: MONO }}>{normalVal}</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, color, fontFamily: MONO }}>
            {val}
          </span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, top: 40 }}>
        <svg width="100%" height="100%" viewBox="0 0 500 120" preserveAspectRatio="none" style={{ overflow: "visible" }}>
          <line x1="0" y1="40" x2="500" y2="40" stroke="rgba(0,212,255,0.02)" strokeDasharray="3 3" />
          <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(0,212,255,0.02)" strokeDasharray="3 3" />
          <line x1="180" y1="0" x2="180" y2="120" stroke="rgba(0,212,255,0.04)" strokeDasharray="2 2" />
          
          <line x1="0" y1={threshold} x2="500" y2={threshold} stroke="rgba(255,59,59,0.18)" strokeDasharray="4 4" strokeWidth="1.2" />
          <text x="5" y={threshold - 4} fill="rgba(255,59,59,0.35)" style={{ fontSize: 7.5, fontWeight: 800, fontFamily: MONO }}>CRITICAL THRESHOLD</text>

          {service === "payment-service" && (
            <>
              <line x1="180" y1="0" x2="180" y2="120" stroke={C.purple} strokeDasharray="2 2" strokeWidth="1" />
              <text x="184" y="14" fill={C.purple} style={{ fontSize: 8, fontWeight: 800, fontFamily: MONO }}>DEPLOY REGRESSION</text>
            </>
          )}
          {service === "user-service" && (
            <>
              <line x1="180" y1="0" x2="180" y2="120" stroke={C.cyan} strokeDasharray="2 2" strokeWidth="1" />
              <text x="184" y="14" fill={C.cyan} style={{ fontSize: 8, fontWeight: 800, fontFamily: MONO }}>FULL TABLE SCAN</text>
            </>
          )}
          {service === "recommendation-service" && (
            <>
              <line x1="180" y1="0" x2="180" y2="120" stroke={C.purple} strokeDasharray="2 2" strokeWidth="1" />
              <text x="184" y="14" fill={C.purple} style={{ fontSize: 8, fontWeight: 800, fontFamily: MONO }}>EMBEDDING CACHE</text>
            </>
          )}

          {resolved && (
            <>
              <line x1="380" y1="0" x2="380" y2="120" stroke={C.green} strokeDasharray="2 2" strokeWidth="1" />
              <text x="384" y="14" fill={C.green} style={{ fontSize: 8, fontWeight: 800, fontFamily: MONO }}>REMEDIATED</text>
            </>
          )}

          <path d={areaPath} fill={`url(#gradient-${incidentId}-${resolved ? 'ok' : 'err'})`} style={{ transition: "all 0.5s ease" }} />
          <path d={dPath} fill="none" stroke={color} strokeWidth="2.2" style={{ transition: "all 0.5s ease" }} />

          <defs>
            <linearGradient id={`gradient-${incidentId}-err`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`gradient-${incidentId}-ok`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.green} stopOpacity="0.1" />
              <stop offset="100%" stopColor={C.green} stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.dim, fontFamily: MONO, zIndex: 3, marginTop: "auto" }}>
        <span>-60m</span>
        <span>-40m</span>
        <span>-20m</span>
        <span>NOW</span>
      </div>
    </div>
  )
}

// ─── REMEDIATION TERMINAL CONSOLE ─────────────────────────────
function RemediationTerminal({ open, onClose, cmd, incidentId, onComplete }) {
  const [logs, setLogs] = useState([])
  const [completed, setCompleted] = useState(false)
  const logsRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setLogs([])
      setCompleted(false)
      return
    }

    let activeInterval = null;

    async function loadRemediationLogs() {
      // Print bootstrap sequence immediately to keep SRE engaged and prevent empty consoles
      const initialLogs = [
        { text: `[INIT] Target Environment Cluster: k8s-prod-us-east-1.nexus.net`, type: "info" },
        { text: `[AUTH] Spawning automated SRE operational subsession (user: nexus-bot-executor)...`, type: "info" },
        { text: `[AUTH] Session credentials approved (RBAC policies: ClusterAdmin, WriteAccess) ✓`, type: "success" },
        { text: `[SYS] Initializing operations context in namespace: prod-core`, type: "info" },
        { text: `[EXEC] Running target remediation action:`, type: "warn" },
        { text: `       $ ${cmd}`, type: "cmd" },
        { text: `[EXEC] Contacting Kubernetes API control plane & executing live analysis...`, type: "info" }
      ]
      
      // Animate the initial logs typing out quickly (100ms per line) so it feels super interactive
      let initIdx = 0;
      const initTimer = setInterval(() => {
        if (initIdx < initialLogs.length) {
          setLogs(prev => [...prev, initialLogs[initIdx]])
          initIdx++
        } else {
          clearInterval(initTimer)
        }
      }, 100)

      try {
        const res = await fetch("/api/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incident_id: incidentId, command: cmd })
        })
        const data = await res.json()
        
        // Wait until initial logs animation finishes before drawing backend logs
        clearInterval(initTimer)
        
        if (data && Array.isArray(data.logs)) {
          // Exclude any duplicate bootstrap logs the backend might return
          const backendLogs = data.logs.filter(log => 
            !log.text.includes("[INIT]") && 
            !log.text.includes("[AUTH]") && 
            !log.text.includes("$") &&
            !log.text.includes("[SYS] Initializing operations") &&
            !log.text.includes("[EXEC] Executing target")
          )
          
          // Render bootstrap sequence instantly in full if it didn't finish animating
          setLogs(initialLogs)
          
          let i = 0
          activeInterval = setInterval(() => {
            if (i < backendLogs.length) {
              setLogs(prev => [...prev, backendLogs[i]])
              i++
            } else {
              clearInterval(activeInterval)
              setCompleted(true)
              onComplete()
            }
          }, 300)
        }
      } catch (err) {
        console.error("Failed to load remediation logs from backend:", err)
        clearInterval(initTimer)
        // Client-side fallback if backend fails
        const fallbackLogs = [
          { text: `[INIT] Target Environment: local-simulation-terminal`, type: "info" },
          { text: `[AUTH] Spawning fallback SRE session...`, type: "info" },
          { text: `[EXEC] Running target remediation:`, type: "warn" },
          { text: `       $ ${cmd}`, type: "cmd" },
          { text: `[SUCCESS] Automated action executed successfully ✓`, type: "success" },
          { text: `[HEALTH] Global system checks passed 100% ✓`, type: "success" },
          { text: `[SYS] Marking incident ${incidentId} as RESOLVED ✓`, type: "success" }
        ]
        let i = 0
        activeInterval = setInterval(() => {
          if (i < fallbackLogs.length) {
            setLogs(prev => [...prev, fallbackLogs[i]])
            i++
          } else {
            clearInterval(activeInterval)
            setCompleted(true)
            onComplete()
          }
        }, 350)
      }
    }

    loadRemediationLogs()
    
    return () => {
      if (activeInterval) clearInterval(activeInterval)
    }
  }, [open, cmd, incidentId])

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  if (!open) return null

  const typeStyles = {
    info: C.muted,
    success: C.green,
    warn: C.amber,
    cmd: C.cyan,
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,9,18,0.85)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div className="clip-panel" style={{
        background: C.panelDeep, border: `1px solid ${C.borderHi}`,
        width: "100%", maxWidth: 600, height: 380,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 0 50px rgba(0,212,255,0.12)",
      }}>
        <div style={{
          height: 38, background: "#050912", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", padding: "0 16px", gap: 8,
        }}>
          <Terminal size={14} color={C.cyan} />
          <span style={{ fontSize: 10, fontWeight: 800, color: C.text, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Nexus Automated Remediation Terminal
          </span>
          {!completed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <Loader2 size={11} className="spin" color={C.cyan} />
              <span style={{ fontSize: 9, color: C.cyan, fontWeight: 700, fontFamily: MONO }}>RUNNING</span>
            </div>
          )}
          {completed && (
            <span style={{ fontSize: 9, color: C.green, fontWeight: 800, fontFamily: MONO, marginLeft: "auto" }}>✓ RESOLVED</span>
          )}
        </div>

        <div ref={logsRef} style={{
          flex: 1, padding: 18, overflowY: "auto",
          fontFamily: MONO, fontSize: 11, lineHeight: 1.8,
          background: "#020408", color: "#A8B8D8",
        }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ color: typeStyles[log.type] || C.text, whiteSpace: "pre-wrap" }}>
              {log.text}
            </div>
          ))}
          {!completed && (
            <span className="blink" style={{ color: C.cyan }}>▋</span>
          )}
        </div>

        {completed && (
          <div style={{ height: 50, background: "#050912", borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 16px" }}>
            <button onClick={onClose} className="clip-sm" style={{
              background: "linear-gradient(135deg, rgba(0,232,122,0.18), rgba(0,232,122,0.08))",
              border: "1px solid rgba(0,232,122,0.4)",
              borderRadius: 4, padding: "6px 18px", color: C.green,
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.05em",
            }}>
              CLOSE CONSOLE
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SRE CHAT COPILOT WAR ROOM ────────────────────────────────
function ChatCopilot({ incidentId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: "NEXUS SRE Sourced Copilot standing by. Ask me anything about this incident's telemetry, logs, metrics, or proposed fix."
      }
    ])
  }, [incidentId])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMsg }])
    setLoading(true)

    const history = messages.slice(1).map(m => ({
      role: m.role,
      content: m.content
    }))

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: incidentId,
          question: userMsg,
          history: history
        })
      })
      const data = await res.json()
      if (data && data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: Received empty response from NEXUS brain." }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Failed to connect to NEXUS SRE server." }])
    }
    setLoading(false)
  }

  return (
    <div className="clip-panel" style={{
      background: C.panelDeep, border: `1px solid ${C.border}`,
      borderRadius: 6, marginTop: 12, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
        <PulseDot color={C.cyan} size={6} />
        <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          SRE Copilot War Room
        </span>
      </div>

      <div style={{
        maxHeight: 240, overflowY: "auto", display: "flex",
        flexDirection: "column", gap: 10, paddingRight: 4,
      }}>
        {messages.map((m, idx) => {
          const isUser = m.role === "user"
          return (
            <div key={idx} style={{
              alignSelf: isUser ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: isUser ? "rgba(0,212,255,0.06)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${isUser ? "rgba(0,212,255,0.18)" : C.border}`,
              borderRadius: 6, padding: "9px 12px",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <span style={{
                fontSize: 8.5, fontWeight: 800,
                color: isUser ? C.cyan : C.muted,
                fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                {isUser ? "ON-CALL SRE" : "NEXUS SRE"}
              </span>
              <span style={{
                fontSize: 11.5, color: isUser ? C.text : "#A8B8D8",
                lineHeight: 1.5, fontFamily: isUser ? "inherit" : MONO,
                whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </span>
            </div>
          )
        })}
        {loading && (
          <div style={{
            alignSelf: "flex-start",
            background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <Loader2 size={11} className="spin" color={C.muted} />
            <span style={{ fontSize: 10, color: C.muted, fontFamily: MONO }}>NEXUS Sourced Analysis in progress...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a technical SRE question..."
          style={{
            flex: 1, background: "#050912", border: `1px solid ${C.border}`,
            borderRadius: 4, padding: "8px 12px", color: C.text,
            fontSize: 11.5, fontFamily: MONO, outline: "none",
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: loading ? "rgba(0,212,255,0.05)" : "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
            border: `1px solid ${loading ? C.border : "rgba(0,212,255,0.3)"}`,
            borderRadius: 4, padding: "0 18px", color: C.cyan,
            fontSize: 11, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            fontFamily: MONO, transition: "all 0.15s",
          }}
        >
          SEND
        </button>
      </form>
    </div>
  )
}

// ─── ANALYSIS CARD ────────────────────────────────────────────
function TacPanel({ title, icon, accent = C.cyan, delay = 0, children }) {
  return (
    <motion.div
      className="clip-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        padding: 20, marginBottom: 12,
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Top-left corner accent */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 2, height: 40, background: accent,
        boxShadow: `0 0 8px ${accent}`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
        <span style={{ color: accent, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  )
}

// ─── SETTINGS DRAWER ──────────────────────────────────────────
function SettingsDrawer({ open, onClose, config, onSave }) {
  const [local, setLocal] = useState(config)
  const [testing, setTesting] = useState({ dd: false, pd: false })
  const [testResult, setTestResult] = useState({ dd: null, pd: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLocal(config) }, [config])

  const testDD = async () => {
    setTesting(p => ({ ...p, dd: true }))
    setTestResult(p => ({ ...p, dd: null }))
    try {
      const res = await fetch("/api/integrations/test/datadog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datadog_api_key: local.datadogApiKey, datadog_app_key: local.datadogAppKey, datadog_site: local.datadogSite }),
      })
      const data = await res.json()
      setTestResult(p => ({ ...p, dd: data }))
    } catch {
      setTestResult(p => ({ ...p, dd: { ok: false, detail: "Backend offline — using demo mode" } }))
    }
    setTesting(p => ({ ...p, dd: false }))
  }

  const testPD = async () => {
    setTesting(p => ({ ...p, pd: true }))
    setTestResult(p => ({ ...p, pd: null }))
    try {
      const res = await fetch("/api/integrations/test/pagerduty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagerduty_api_key: local.pagerdutyApiKey }),
      })
      const data = await res.json()
      setTestResult(p => ({ ...p, pd: data }))
    } catch {
      setTestResult(p => ({ ...p, pd: { ok: false, detail: "Backend offline — using demo mode" } }))
    }
    setTesting(p => ({ ...p, pd: false }))
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datadog_api_key: local.datadogApiKey,
          datadog_app_key: local.datadogAppKey,
          datadog_site: local.datadogSite,
          pagerduty_api_key: local.pagerdutyApiKey,
          mode: local.mode,
        }),
      })
    } catch { /* offline — save locally */ }
    onSave(local)
    setSaving(false)
    onClose()
  }

  const inputStyle = {
    width: "100%", background: C.panelDeep, border: `1px solid ${C.border}`,
    borderRadius: 6, padding: "9px 12px", color: C.text, fontSize: 12.5,
    fontFamily: MONO, outline: "none",
    transition: "border-color 0.15s",
  }

  const labelStyle = { fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6 }

  const IntegSection = ({ title, color, logo, children, testFn, testing: t, result }) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div className="clip-sm" style={{
          width: 32, height: 32, background: `${color}18`,
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 900, color,
        }}>
          {logo}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        {result && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px",
            background: result.ok ? "rgba(0,232,122,0.1)" : "rgba(255,59,59,0.1)",
            border: `1px solid ${result.ok ? "rgba(0,232,122,0.3)" : "rgba(255,59,59,0.3)"}`,
            color: result.ok ? C.green : C.red, borderRadius: 3,
            fontFamily: MONO, marginLeft: "auto",
          }}>
            {result.ok ? "✓ CONNECTED" : "✗ FAILED"}
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
      <button onClick={testFn} disabled={t} style={{
        marginTop: 12, width: "100%",
        background: t ? "rgba(0,212,255,0.04)" : "rgba(0,212,255,0.08)",
        border: `1px solid ${t ? C.border : "rgba(0,212,255,0.2)"}`,
        borderRadius: 6, padding: "8px 0",
        color: t ? C.muted : C.cyan, fontSize: 11.5, fontWeight: 600,
        cursor: t ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        transition: "all 0.15s",
      }}>
        {t ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Wifi size={12} />}
        {t ? "Testing..." : "Test Connection"}
      </button>
      {result && <p style={{ fontSize: 11, color: result.ok ? C.green : C.red, marginTop: 7, fontFamily: MONO }}>{result.detail}</p>}
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200 }}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="clip-panel"
            style={{
              position: "fixed", right: 0, top: 0, bottom: 0,
              width: 420, background: C.panel,
              borderLeft: `1px solid ${C.borderHi}`,
              zIndex: 201, overflowY: "auto", padding: 28,
              boxShadow: `-20px 0 60px rgba(0,0,0,0.6), -1px 0 0 rgba(0,212,255,0.08)`,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
              <Settings size={16} color={C.cyan} style={{ marginRight: 10 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Integrations
              </span>
              <button onClick={onClose} style={{
                marginLeft: "auto", background: "none", border: "none",
                color: C.muted, cursor: "pointer", padding: 4,
              }}>
                <X size={16} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div style={{
              background: C.panelDeep, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "12px 14px", marginBottom: 28,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>Data Source</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {local.mode === "demo" ? "Using 3 pre-built incident scenarios" : "Pulling live from PagerDuty + Datadog"}
                </div>
              </div>
              <div style={{ display: "flex", background: C.panelDeep, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
                {["demo", "live"].map(m => (
                  <button key={m} onClick={() => setLocal(p => ({ ...p, mode: m }))} style={{
                    padding: "5px 14px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                    background: local.mode === m ? (m === "live" ? "rgba(0,212,255,0.15)" : "rgba(255,184,0,0.12)") : "transparent",
                    color: local.mode === m ? (m === "live" ? C.cyan : C.amber) : C.muted,
                  }}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: C.border, marginBottom: 24 }} />

            {/* Datadog */}
            <IntegSection
              title="Datadog" color="#632CA6" logo="DD"
              testFn={testDD} testing={testing.dd} result={testResult.dd}
            >
              <div>
                <label style={labelStyle}>API Key</label>
                <input style={inputStyle} type="password" placeholder="dd_api_xxxxxxxxxxxx"
                  value={local.datadogApiKey}
                  onChange={e => setLocal(p => ({ ...p, datadogApiKey: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Application Key</label>
                <input style={inputStyle} type="password" placeholder="xxxxxxxxxxxxxxxxxxxx"
                  value={local.datadogAppKey}
                  onChange={e => setLocal(p => ({ ...p, datadogAppKey: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Site</label>
                <select style={{ ...inputStyle, cursor: "pointer" }}
                  value={local.datadogSite}
                  onChange={e => setLocal(p => ({ ...p, datadogSite: e.target.value }))}>
                  <option value="datadoghq.com">US1 — datadoghq.com</option>
                  <option value="us3.datadoghq.com">US3 — us3.datadoghq.com</option>
                  <option value="us5.datadoghq.com">US5 — us5.datadoghq.com</option>
                  <option value="datadoghq.eu">EU — datadoghq.eu</option>
                </select>
              </div>
            </IntegSection>

            <div style={{ height: 1, background: C.border, marginBottom: 24 }} />

            {/* PagerDuty */}
            <IntegSection
              title="PagerDuty" color="#06AC38" logo="PD"
              testFn={testPD} testing={testing.pd} result={testResult.pd}
            >
              <div>
                <label style={labelStyle}>API Key (User Token)</label>
                <input style={inputStyle} type="password" placeholder="u+xxxxxxxxxxxxxxxxxxxx"
                  value={local.pagerdutyApiKey}
                  onChange={e => setLocal(p => ({ ...p, pagerdutyApiKey: e.target.value }))} />
              </div>
              <p style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.6 }}>
                Create at: app.pagerduty.com → User Settings → API Access Keys
              </p>
            </IntegSection>

            {/* Save */}
            <button onClick={save} disabled={saving} style={{
              width: "100%", marginTop: 8,
              background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))",
              border: `1px solid rgba(0,212,255,0.3)`,
              borderRadius: 8, padding: "12px 0",
              color: C.cyan, fontSize: 13, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
              letterSpacing: "0.05em",
            }}>
              {saving ? <Loader2 size={13} /> : <CheckCircle2 size={13} />}
              {saving ? "SAVING..." : "SAVE CONFIGURATION"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [incidents, setIncidents] = useState([])
  const [selId, setSelId] = useState("")
  const sel = incidents.find(i => i.id === selId) || {
    id: "", title: "Loading incidents...", service: "sys-agent", severity: "P1", ago: "0m ago",
    logs: [
      { t: "00:00:00", svc: "kernel", lvl: "INFO", msg: "Establishing secure link to SRE telemetry network..." }
    ],
    metrics: {}, deployments: []
  }

  const [phase, setPhase] = useState("idle")
  const [stream, setStream] = useState("")
  const [analysis, setAnalysis] = useState(null)
  const [visibleLogs, setVisibleLogs] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [remediateOpen, setRemediateOpen] = useState(false)
  const [config, setConfig] = useState({
    datadogApiKey: "", datadogAppKey: "", datadogSite: "datadoghq.com",
    pagerdutyApiKey: "", mode: "demo",
  })
  const [integStatus, setIntegStatus] = useState({ datadog: null, pagerduty: null })
  const [counter, setCounter] = useState(0)

  const logRef = useRef(null)
  const streamRef = useRef(null)
  const logTimer = useRef(null)
  const streamTimer = useRef(null)
  const activeWs = useRef(null)
  const fallbackTriggered = useRef(false)
  const intentionalClose = useRef(false)
  const tokensReceived = useRef(0)

  // ── Fetch active incidents from backend on mount
  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetch("/api/incidents")
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setIncidents(data.map(inc => ({
            ...inc,
            ago: inc.ago || "Just now",
            resolved: false,
            logs: inc.logs || [],
            metrics: inc.metrics || {},
            deployments: inc.deployments || []
          })))
          setSelId(data[0].id)
        }
      } catch (err) {
        console.error("Failed to load incidents from backend:", err)
      }
    }
    loadIncidents()
  }, [])

  // ── Fetch full incident details dynamically on selection
  useEffect(() => {
    if (!selId) return
    async function loadIncidentDetails() {
      try {
        const res = await fetch(`/api/incidents/${selId}`)
        const data = await res.json()
        if (data && data.id === selId) {
          setIncidents(prev => prev.map(inc => {
            if (inc.id === selId) {
              return { ...inc, ...data }
            }
            return inc
          }))
        }
      } catch (err) {
        console.error(`Failed to load details for incident ${selId}:`, err)
      }
    }
    loadIncidentDetails()
  }, [selId])

  // ── Log stream animation on incident change
  useEffect(() => {
    setPhase("idle"); setStream(""); setAnalysis(null); setVisibleLogs([])
    clearInterval(logTimer.current); clearInterval(streamTimer.current)
    if (activeWs.current) {
      try { activeWs.current.close() } catch (e) {}
    }
    if (!sel || !sel.logs || sel.logs.length === 0) return
    let i = 0
    logTimer.current = setInterval(() => {
      if (i < sel.logs.length) { setVisibleLogs(p => [...p, sel.logs[i]]); i++ }
      else clearInterval(logTimer.current)
    }, 320)
    return () => {
      clearInterval(logTimer.current)
      clearInterval(streamTimer.current)
      if (activeWs.current) {
        try { activeWs.current.close() } catch (e) {}
      }
    }
  }, [selId, sel?.logs])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [visibleLogs])
  useEffect(() => { if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight }, [stream])

  // ── Confidence counter animation
  useEffect(() => {
    if (phase !== "complete" || !analysis) return
    setCounter(0)
    const target = Math.round(analysis.confidence * 100)
    let n = 0
    const id = setInterval(() => {
      n += Math.ceil(target / 40)
      if (n >= target) { setCounter(target); clearInterval(id) }
      else setCounter(n)
    }, 25)
    return () => clearInterval(id)
  }, [phase, analysis])

  // ── Analyze: try WebSocket → fallback to simulation
  const analyze = useCallback(() => {
    if (phase !== "idle") return
    setPhase("streaming"); setStream(""); setAnalysis(null)
    fallbackTriggered.current = false
    intentionalClose.current = false
    tokensReceived.current = 0

    if (activeWs.current) {
      try { activeWs.current.close() } catch (e) {}
    }

    const triggerFallback = () => {
      if (fallbackTriggered.current) return
      fallbackTriggered.current = true
      fallbackAnalyze()
    }

    let wsConnected = false
    try {
      // Connect through Vite proxy for same-origin safety
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${wsProto}//${window.location.host}/ws/analysis/${sel.id}`
      const ws = new WebSocket(wsUrl)
      activeWs.current = ws

      ws.onopen = () => {
        wsConnected = true
      }

      ws.onmessage = e => {
        const msg = JSON.parse(e.data)
        if (msg.type === "token") {
          tokensReceived.current += 1
          setStream(p => p + msg.content)
        }
        if (msg.type === "complete") {
          intentionalClose.current = true
          setAnalysis(msg.analysis)
          setPhase("complete")
          ws.close()
        }
        if (msg.type === "error") {
          triggerFallback()
        }
      }

      ws.onerror = () => {
        triggerFallback()
      }

      ws.onclose = () => {
        if (!intentionalClose.current) {
          triggerFallback()
        }
      }

      // Timeout safety: if we don't connect or get tokens within 8.0 seconds, trigger fallback
      setTimeout(() => {
        if (!wsConnected || (fallbackTriggered.current === false && tokensReceived.current === 0)) {
          triggerFallback()
        }
      }, 8000)

    } catch (err) {
      triggerFallback()
    }
  }, [phase, sel])

  const fallbackAnalyze = useCallback(() => {
    clearInterval(streamTimer.current)
    const clientAnalysis = generateClientStochasticAnalysis(sel)
    const text = buildStream({ ...sel, analysis: clientAnalysis })
    let i = 0
    streamTimer.current = setInterval(() => {
      if (i <= text.length) { setStream(text.slice(0, i)); i += 2 }
      else {
        clearInterval(streamTimer.current)
        setTimeout(() => { setAnalysis(clientAnalysis); setPhase("complete") }, 400)
      }
    }, 12)
  }, [sel])

  const activeCritical = incidents.filter(i => i.severity === "P0" && !i.resolved).length
  const unresolvedCount = incidents.filter(i => !i.resolved).length

  return (
    <div style={{ background: C.bg, height: "100vh", color: C.text, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* ── Background Effects ────────────────────────────────── */}
      <div className="grid-bg" />
      <div className="scan-line" />

      {/* ══ STATUS BAR ══════════════════════════════════════════ */}
      <div style={{
        height: 48, background: "#050912",
        borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center",
        padding: "0 20px", gap: 18, flexShrink: 0,
        position: "relative", zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: "linear-gradient(135deg, #00D4FF 0%, #0099BB 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
            boxShadow: "0 0 18px rgba(0,212,255,0.4)",
            flexShrink: 0,
          }}>
            <Zap size={13} color="#fff" fill="#fff" />
          </div>
          <div>
            <span className="glow-cyan" style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", color: C.cyan }}>
              NEXUS
            </span>
            <span style={{
              marginLeft: 7, fontSize: 8.5, fontWeight: 700, color: C.cyan,
              background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: 2, padding: "1px 5px", letterSpacing: "0.1em",
            }}>AI·SRE</span>
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: C.border }} />

        {/* Critical count */}
        {activeCritical > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <PulseDot color={C.red} size={7} />
            <span style={{ fontSize: 11, color: C.red, fontWeight: 800, fontFamily: MONO, letterSpacing: "0.04em" }}>
              {activeCritical} CRITICAL
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 800, fontFamily: MONO, letterSpacing: "0.04em" }}>
              ALL SYSTEMS HEALTHY
            </span>
          </div>
        )}

        {/* Integration badges */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "DD", color: "#632CA6", connected: config.datadogApiKey.length > 0 },
            { label: "PD", color: "#06AC38", connected: config.pagerdutyApiKey.length > 0 },
          ].map(({ label, color, connected }) => (
            <div key={label} title={connected ? "Connected" : "Not configured"} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 3,
              background: connected ? `${color}14` : "rgba(255,255,255,0.03)",
              border: `1px solid ${connected ? `${color}30` : "rgba(255,255,255,0.06)"}`,
              cursor: "pointer",
            }} onClick={() => setShowSettings(true)}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: connected ? color : C.dim }} />
              <span style={{ fontSize: 9.5, fontWeight: 800, color: connected ? color : C.dim, fontFamily: MONO }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 10.5, color: C.green, fontWeight: 700, fontFamily: MONO }}>PROD</span>
        </div>

        <span style={{ fontSize: 11, color: C.muted, fontFamily: MONO }}>
          {incidents.length} incidents
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Cpu size={11} color={C.dim} />
            <span style={{ fontSize: 10.5, color: C.dim, fontFamily: MONO }}>llama3.1:8b</span>
          </div>
          <LiveClock />
          <button onClick={() => setShowSettings(true)} style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 5,
            padding: "5px 7px", color: C.muted, cursor: "pointer",
            display: "flex", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHi; e.currentTarget.style.color = C.cyan }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* ══ MAIN ════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 2 }}>

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <div style={{
          width: 272, background: "#070B15",
          borderRight: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{
            padding: "11px 14px 9px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Incident Feed
            </span>
            <span style={{ fontSize: 9, fontFamily: MONO, color: C.dim }}>
              {config.mode.toUpperCase()}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {incidents.map((inc, i) => {
              const s = SEV[inc.severity]
              const active = sel.id === inc.id
              const isResolved = inc.resolved
              return (
                <motion.div
                  key={inc.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => setSelId(inc.id)}
                  className={active ? "clip-sm" : ""}
                  style={{
                    padding: "11px 12px", borderRadius: active ? 0 : 6,
                    marginBottom: 5, cursor: "pointer",
                    background: active ? (isResolved ? "rgba(0,232,122,0.05)" : s.bg) : "transparent",
                    border: `1px solid ${active ? (isResolved ? "rgba(0,232,122,0.22)" : s.border) : "transparent"}`,
                    transition: "all 0.15s",
                    position: "relative",
                    ...(active ? { boxShadow: `0 0 20px ${isResolved ? "rgba(0,232,122,0.15)" : s.border}` } : {}),
                  }}
                  whileHover={{ background: active ? (isResolved ? "rgba(0,232,122,0.05)" : s.bg) : "rgba(255,255,255,0.02)" }}
                >
                  {/* Left severity bar */}
                  {active && (
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: 2, background: isResolved ? C.green : s.dot,
                      boxShadow: `0 0 8px ${isResolved ? C.green : s.dot}`,
                    }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, paddingLeft: active ? 6 : 0 }}>
                    <PulseDot color={isResolved ? C.green : s.dot} size={6} />
                    {isResolved ? (
                      <span style={{
                        color: C.green, background: "rgba(0,232,122,0.07)", border: `1px solid rgba(0,232,122,0.25)`,
                        borderRadius: 3, fontSize: 9, fontWeight: 800,
                        padding: "1px 5px", fontFamily: MONO, letterSpacing: "0.08em",
                      }}>
                        RESOLVED
                      </span>
                    ) : (
                      <SevBadge sev={inc.severity} small />
                    )}
                    <span style={{ fontSize: 9.5, color: C.dim, marginLeft: "auto", fontFamily: MONO }}>{inc.ago}</span>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    color: active ? C.text : (isResolved ? "#508070" : "#6070A0"),
                    lineHeight: 1.4, marginBottom: 4,
                    paddingLeft: active ? 6 : 0,
                    textDecoration: isResolved ? "line-through" : "none",
                  }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: 10, color: C.dim, fontFamily: MONO, paddingLeft: active ? 6 : 0 }}>
                    {inc.service}
                  </div>
                  {active && (
                    <motion.div
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                      style={{
                        height: 1, marginTop: 9,
                        background: `linear-gradient(to right, ${isResolved ? "rgba(0,232,122,0.2)" : s.border}, transparent)`,
                        transformOrigin: "left",
                      }}
                    />
                  )}
                </motion.div>
              )
            })}
          </div>

          <div style={{
            padding: "9px 14px", borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontSize: 9.5, color: C.dim, fontFamily: MONO }}>Groq · llama-3.1-8b-instant</span>
          </div>
        </div>

        {/* ── ANALYSIS AREA ────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Analysis Scroll Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

            {/* Incident header */}
            <div style={{
              display: "flex", alignItems: "flex-start",
              justifyContent: "space-between", gap: 16, marginBottom: 24,
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, color: C.dim, fontFamily: MONO }}>{sel.id}</span>
                  <SevBadge sev={sel.severity} />
                  <span style={{ fontSize: 10.5, color: SEV[sel.severity].text, fontWeight: 700 }}>
                    {SEV[sel.severity].name}
                  </span>
                </div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {sel.title}
                </h1>
                <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.muted, fontFamily: MONO }}>
                  {sel.service} · triggered {sel.ago}
                </p>
              </div>

              {/* Action state */}
              <div style={{ flexShrink: 0 }}>
                {phase === "idle" && (
                  <motion.button
                    onClick={analyze}
                    whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(0,212,255,0.3)" }}
                    whileTap={{ scale: 0.97 }}
                    className="clip-sm"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,100,150,0.2) 100%)",
                      border: `1px solid rgba(0,212,255,0.35)`,
                      borderRadius: 0, padding: "12px 24px",
                      color: C.cyan, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      letterSpacing: "0.05em",
                    }}
                  >
                    <Zap size={14} fill={C.cyan} />
                    ANALYZE WITH NEXUS
                  </motion.button>
                )}
                {phase === "streaming" && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "12px 20px",
                    background: "rgba(0,212,255,0.06)", border: `1px solid rgba(0,212,255,0.2)`,
                    borderRadius: 6, fontSize: 12, color: C.cyan, fontWeight: 700, fontFamily: MONO,
                  }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 size={13} />
                    </motion.div>
                    NEXUS REASONING...
                  </div>
                )}
                {phase === "complete" && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 20px",
                    background: "rgba(0,232,122,0.06)", border: `1px solid rgba(0,232,122,0.22)`,
                    borderRadius: 6, fontSize: 12, color: C.green, fontWeight: 700, fontFamily: MONO,
                  }}>
                    <CheckCircle2 size={13} />
                    ANALYSIS COMPLETE
                  </div>
                )}
              </div>
            </div>

            {/* ── IDLE ── */}
            {phase === "idle" && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="clip-panel"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", padding: "72px 40px", textAlign: "center",
                  background: C.panel, border: `1px dashed rgba(0,212,255,0.1)`,
                }}
              >
                <motion.div
                  animate={{ y: [0, -5, 0], boxShadow: ["0 0 20px rgba(0,212,255,0.15)", "0 0 35px rgba(0,212,255,0.3)", "0 0 20px rgba(0,212,255,0.15)"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="clip-panel"
                  style={{
                    width: 64, height: 64, marginBottom: 20,
                    background: "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,100,150,0.1))",
                    border: `1px solid rgba(0,212,255,0.2)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Zap size={28} color={C.cyan} />
                </motion.div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8, fontFamily: MONO }}>
                  NEXUS STANDING BY
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, maxWidth: 360 }}>
                  Hit <span style={{ color: C.cyan, fontWeight: 600 }}>ANALYZE WITH NEXUS</span> to run AI-powered root cause analysis across{" "}
                  <span style={{ color: C.cyan }}>{sel.logs.length} log events</span>, deployment history, and service topology.
                </div>
              </motion.div>
            )}

            {/* ── STREAMING ── */}
            {phase === "streaming" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="clip-panel"
                ref={streamRef}
                style={{
                  background: C.panelDeep,
                  border: `1px solid rgba(0,212,255,0.1)`,
                  padding: 22, height: 360,
                  overflowY: "auto",
                  fontFamily: MONO, fontSize: 12, lineHeight: 1.9,
                  color: "rgba(0,212,255,0.75)",
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {stream}
                  <span className="blink" style={{ color: C.cyan }}>▋</span>
                </pre>
              </motion.div>
            )}

            {/* ── COMPLETE ── */}
            <AnimatePresence>
              {phase === "complete" && analysis && (
                <>
                  {/* Confidence Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="clip-panel"
                    style={{
                      display: "flex", alignItems: "center", gap: 24,
                      background: "linear-gradient(135deg, rgba(0,212,255,0.04), rgba(0,100,150,0.04))",
                      border: `1px solid rgba(0,212,255,0.15)`,
                      padding: "18px 24px", marginBottom: 12,
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {/* Subtle top bar */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 1,
                      background: "linear-gradient(to right, rgba(0,212,255,0.4), transparent)",
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 5, fontFamily: MONO }}>
                        ROOT CAUSE IDENTIFIED
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                        {analysis.title}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4, fontFamily: MONO }}>
                        CONFIDENCE
                      </div>
                      <div className="glow-cyan" style={{ fontSize: 38, fontWeight: 900, color: C.cyan, lineHeight: 1, fontFamily: MONO, letterSpacing: "-0.02em" }}>
                        {counter}%
                      </div>
                      <div style={{ width: 100, height: 2, background: "rgba(0,212,255,0.1)", borderRadius: 1, marginTop: 8 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.confidence * 100}%` }}
                          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                          style={{ height: "100%", borderRadius: 1, background: `linear-gradient(to right, ${C.cyan}, rgba(0,212,255,0.5))`, boxShadow: `0 0 8px ${C.cyan}` }}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Root Cause */}
                  <TacPanel title="Root Cause" icon={<AlertCircle size={12} />} accent={C.red} delay={0.1}>
                    <span style={{
                      display: "inline-block", fontSize: 9.5, fontWeight: 800, color: C.red,
                      background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.22)",
                      borderRadius: 3, padding: "2px 8px", marginBottom: 12,
                      fontFamily: MONO, letterSpacing: "0.08em",
                    }}>
                      {analysis.root_cause.category}
                    </span>
                    <p style={{ fontSize: 13, color: "#A8B8D8", lineHeight: 1.75, margin: "0 0 14px" }}>
                      {analysis.root_cause.summary}
                    </p>
                    <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.cyan, marginBottom: 14 }}>
                      ↳ {analysis.root_cause.component}
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 9, color: C.muted, marginBottom: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                        Evidence
                      </div>
                      {analysis.root_cause.evidence.map((e, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontSize: 11.5, color: "#6070A0", fontFamily: MONO, lineHeight: 1.5 }}>
                          <ChevronRight size={11} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
                          {e}
                        </div>
                      ))}
                    </div>
                  </TacPanel>

                  {/* Blast Radius + Timeline */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 0 }}>
                    <TacPanel title="Blast Radius" icon={<Radio size={12} />} accent={C.amber} delay={0.18}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                        {analysis.blast_radius.services.map(svc => (
                          <span key={svc} style={{
                            fontSize: 10, padding: "3px 8px",
                            background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.2)",
                            borderRadius: 3, color: C.amber, fontFamily: MONO,
                          }}>{svc}</span>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                        {[
                          { label: "Users Affected", val: sel.resolved ? "0 users" : analysis.blast_radius.users, col: sel.resolved ? C.green : C.text },
                          { label: "Revenue Loss", val: sel.resolved ? "$0 / min" : analysis.blast_radius.revenue, col: sel.resolved ? C.green : C.red },
                        ].map(({ label, val, col }) => (
                          <div key={label} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 5, padding: "10px 11px" }}>
                            <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: col, fontFamily: MONO }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <TelemetryChart incident={sel} resolved={sel.resolved} />
                    </TacPanel>

                    <TacPanel title="Timeline" icon={<Clock size={12} />} accent={C.purple} delay={0.22}>
                      {analysis.timeline.map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < analysis.timeline.length - 1 ? 10 : 0 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ marginTop: 1 }}><SrcIcon src={item.src} /></div>
                            {i < analysis.timeline.length - 1 && (
                              <div style={{ width: 1, flex: 1, background: C.dim, margin: "4px 0" }} />
                            )}
                          </div>
                          <div style={{ paddingBottom: i < analysis.timeline.length - 1 ? 4 : 0 }}>
                            <div style={{ fontSize: 9.5, color: C.dim, fontFamily: MONO, marginBottom: 1 }}>{item.time}</div>
                            <div style={{ fontSize: 11, color: "#8898B8", lineHeight: 1.45 }}>{item.event}</div>
                          </div>
                        </div>
                      ))}
                    </TacPanel>
                  </div>

                  {/* Immediate Fix */}
                  <TacPanel title="Immediate Fix" icon={<Zap size={12} />} accent={C.green} delay={0.28}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12.5, color: C.muted }}>Estimated recovery:</span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.green, fontFamily: MONO }}>{analysis.fix.eta}</span>
                      </div>
                      {sel.resolved ? (
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "4px 12px",
                          background: "rgba(0,232,122,0.08)", border: "1px solid rgba(0,232,122,0.3)",
                          borderRadius: 4, color: C.green, fontFamily: MONO, marginLeft: "auto",
                          letterSpacing: "0.05em"
                        }}>
                          ✓ REMEDIATED & RESOLVED
                        </span>
                      ) : (
                        <button
                          onClick={() => setRemediateOpen(true)}
                          className="clip-sm"
                          style={{
                            background: "linear-gradient(135deg, rgba(0,232,122,0.18), rgba(0,232,122,0.08))",
                            border: "1px solid rgba(0,232,122,0.35)",
                            borderRadius: 4, padding: "6px 16px", color: C.green,
                            fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
                            letterSpacing: "0.05em", transition: "all 0.25s",
                            boxShadow: "0 0 15px rgba(0,232,122,0.15)"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "rgba(0,232,122,0.6)"
                            e.currentTarget.style.boxShadow = "0 0 25px rgba(0,232,122,0.3)"
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "rgba(0,232,122,0.35)"
                            e.currentTarget.style.boxShadow = "0 0 15px rgba(0,232,122,0.15)"
                          }}
                        >
                          <Zap size={11} fill={C.green} />
                          RUN AUTOMATED REMEDIATION
                        </button>
                      )}
                    </div>
                    <CopyCmd cmd={analysis.fix.cmd} />
                  </TacPanel>

                  {/* Prevention */}
                  <TacPanel title="Prevention" icon={<Shield size={12} />} accent={C.cyan} delay={0.34}>
                    {analysis.prevention.map((item, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 12, padding: "10px 0",
                        borderBottom: i < analysis.prevention.length - 1 ? `1px solid ${C.border}` : "none",
                        alignItems: "flex-start",
                      }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: "2px 6px", flexShrink: 0, fontFamily: MONO,
                          background: item.priority === "HIGH" ? "rgba(255,59,59,0.08)" : "rgba(255,184,0,0.07)",
                          border: `1px solid ${item.priority === "HIGH" ? "rgba(255,59,59,0.22)" : "rgba(255,184,0,0.2)"}`,
                          color: item.priority === "HIGH" ? C.red : C.amber,
                          borderRadius: 3, letterSpacing: "0.06em",
                        }}>
                          {item.priority}
                        </span>
                        <span style={{ fontSize: 12.5, color: "#A0B0CC", lineHeight: 1.6 }}>{item.text}</span>
                      </div>
                    ))}
                  </TacPanel>

                  {/* Chat Copilot War Room */}
                  <ChatCopilot incidentId={sel.id} />
                </>
              )}
            </AnimatePresence>
          </div>

          {/* ── LOG STREAM ─────────────────────────────────────── */}
          <div style={{
            height: 190, background: C.panelDeep,
            borderTop: `1px solid ${C.border}`, flexShrink: 0,
          }}>
            <div style={{
              height: 34, display: "flex", alignItems: "center",
              padding: "0 16px", borderBottom: `1px solid ${C.border}`, gap: 9,
            }}>
              <Terminal size={11} color={C.dim} />
              <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                Live Log Stream
              </span>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: MONO }}>
                {sel.id} · {visibleLogs.length}/{sel.logs.length}
              </span>
              {visibleLogs.length < sel.logs.length && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: "blink 1.2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 9, color: C.green, fontWeight: 700, fontFamily: MONO }}>LIVE</span>
                </div>
              )}
            </div>
            <div ref={logRef} style={{ padding: "7px 16px", overflowY: "auto", height: 156 }}>
              {visibleLogs.map((log, i) => {
                if (!log) return null
                const lc = LOG_COLORS[log.lvl] || C.dim
                const isHot = log.lvl === "ERROR" || log.lvl === "ALERT" || log.lvl === "FATAL"
                return (
                  <motion.div
                    key={`${sel.id}-${i}`}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      display: "grid", gridTemplateColumns: "60px 46px 92px 1fr",
                      gap: 10, padding: "2px 0",
                      fontFamily: MONO, fontSize: 11, lineHeight: 1.55,
                      background: isHot ? "rgba(255,59,59,0.03)" : "transparent",
                      borderBottom: isHot ? "1px solid rgba(255,59,59,0.07)" : "none",
                    }}
                  >
                    <span style={{ color: C.dim }}>{log.t}</span>
                    <span style={{ color: lc, fontWeight: 600 }}>{log.lvl}</span>
                    <span style={{ color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.svc}</span>
                    <span style={{ color: isHot ? lc : "#4A5A7A" }}>{log.msg}</span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Remediation Terminal Modal ─────────────────────────── */}
      <RemediationTerminal
        open={remediateOpen}
        cmd={analysis?.fix?.cmd || ""}
        incidentId={sel.id}
        onClose={() => setRemediateOpen(false)}
        onComplete={() => {
          setIncidents(prev => prev.map(inc => {
            if (inc.id === sel.id) {
              return { ...inc, resolved: true }
            }
            return inc
          }))
        }}
      />

      {/* ── Settings Drawer ───────────────────────────────────── */}
      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onSave={cfg => {
          setConfig(cfg)
          setIntegStatus({
            datadog: cfg.datadogApiKey ? "ok" : null,
            pagerduty: cfg.pagerdutyApiKey ? "ok" : null,
          })
        }}
      />
    </div>
  )
}
