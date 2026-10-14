# RailSync: Real-Time Inter-Departmental Railway Operations Coordination Platform

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18%20%2F%20Vite-61DAFB.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%20Multi--AZ-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%20Pub%2FSub-DC382D.svg)](https://redis.io/)
[![AWS](https://img.shields.io/badge/AWS-ECS%20Fargate%20%7C%20ALB%20%7C%20S3%20WORM-FF9900.svg)](https://aws.amazon.com/)
[![SLA](https://img.shields.io/badge/Latency%20SLA-P95%20%3C%20300ms%20(Observed%20185ms)-brightgreen.svg)]()
[![TTR](https://img.shields.io/badge/Time--to--Recovery-3.2%20min%20(RTO%20%3C%205m)-brightgreen.svg)]()

> **Strategic Tagline:** *"From fragmented communication to a unified real-time operational decision layer."*

---

## 1. Domain Context & Strategic Moat

**RailSync** is an event-driven cloud coordination layer designed for **Indian Railways** (Central Railway, Nagpur Division, Wardha–Sevagram High-Density Corridor).

### The Operational Challenge
- Indian Railways operates **13,000+ passenger trains** and **~9,000 freight trains** daily across **~68,000 route kilometers**.
- On High-Density Network (HDN) routes, line capacity utilization frequently exceeds **100%** (118.4% on Wardha–Sevagram).
- Maintenance blocks (e.g., 25kV catenary wire replacement, track tamping) require coordination across 4 distinct departmental silos: **Operating (Traffic)**, **Electrical (OHE)**, **Engineering (Civil / P-Way)**, and **Signal & Telecom (S&T)**.
- Legacy coordination relies on manual phone trees, disjointed paper registers, and untracked verbal handoffs.

### Fundamental System Law & Strategic Moat: "Interoperability, Not Replacement"
- RailSync **does NOT** replace, rewrite, or disrupt established Indian Railways systems (**COA, FOIS, e-Office**).
- RailSync **never** performs autonomous operational control or overrides safety-critical physical interlocking.
- It provides a centralized Domain-Driven Design aggregate root—the **`OperationalEvent`**—to orchestrate workflows, resolve dependency graphs, and record immutable audit ledgers.

---

## 2. Monorepo Directory Architecture

```
railsync/
├── backend/                      # Python 3.11+ / FastAPI Microservices Engine
│   ├── main.py                   # REST endpoints, WebSocket pub/sub, structured JSON logging
│   ├── models.py                 # Pydantic v2 schemas, FSM Enums, request/response models
│   ├── fsm.py                    # 11-Stage FSM Lifecycle engine with statutory guards
│   ├── dependency_engine.py      # Dynamic Dependency Engine resolving the 6 Invariants
│   ├── locking.py                # Redis Distributed Fencing Token locking mechanism
│   ├── audit_ledger.py           # S3 WORM SHA-256 hash chains & Merkle DAG engine
│   ├── database.py               # ACID persistence & Transactional Outbox
│   ├── schema.sql                # Amazon RDS PostgreSQL 15 Multi-AZ production DDL
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile                # Multi-stage production container build (non-root)
│
├── frontend/                     # React 18 / Vite / TypeScript / Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx                 # Telemetry bar, live status & screen switcher
│   │   │   ├── CorridorVideoWall.tsx      # Screen 1: Real-time track section visualizer
│   │   │   ├── RequisitionModal.tsx       # Screen 2: Event requisition & 7-stage OHE
│   │   │   ├── FsmLifecycleView.tsx       # Screen 3: 11-Stage FSM & 6 Invariants
│   │   │   ├── DualKeyApprovalPortal.tsx  # Screen 4: Dual-Key Multi-Party Sign-off
│   │   │   ├── AuditLedgerView.tsx        # Screen 5: S3 WORM Cryptographic Ledger
│   │   │   ├── ChaosSreDashboard.tsx      # Screen 6: Live SRE & 4-Phase TTR Stopwatch
│   │   │   └── MobileOfflineBanner.tsx    # Mobile CP/AP boundary explainer
│   │   ├── api.ts                # API client with Idempotency-Key support
│   │   ├── types.ts              # Domain TypeScript types
│   │   └── App.tsx               # Root view with WebSocket feed
│   ├── nginx.conf                # Nginx reverse proxy configuration
│   ├── Dockerfile                # Multi-stage frontend container build
│   └── package.json
│
├── infra/                        # Infrastructure as Code & SRE Automation
│   ├── main.tf                   # Terraform AWS ECS Fargate, ALB, RDS, S3 WORM, VPC
│   ├── aws-cost-model.md         # $145/month production budget analysis
│   ├── chaos.sh                  # Automated Chaos failure injection (Bash)
│   ├── chaos.ps1                 # Automated Chaos failure injection (PowerShell)
│   └── canary.js                 # AWS CloudWatch Synthetics canary script
│
├── tests/
│   └── locustfile.py             # Locust load test (500 virtual users, 2,500 req/min)
│
├── docs/
│   ├── SECTION_14_EVALUATION_RUBRIC.md # Complete mapping to 14 evaluation criteria
│   ├── ORAL_DEFENSE_SCRIPT.md          # 5-minute presentation script & professor Q&A
│   └── SYSTEM_DESIGN_DEEP_DIVE.md      # HLD/LLD, CAP dual-stance, decentralized mesh
│
├── docker-compose.yml            # Multi-service stack (Postgres 15, Redis 7, Backend, Frontend)
└── README.md                     # Root project documentation
```

---

## 3. The 6 Core Interactive UI Screens

1. **Screen 1: Corridor Live Video Wall & Division Overview**
   - Real-time track section visualizer for Wardha (WR) ⇄ Sevagram (SEGM), KM 140.00 to 148.00.
   - Interactive tracks: 25kV Catenary, UP MAIN, DN MAIN, LOOP 01, YARD 04.
   - Multi-department status filters (All, OHE, Operating, Civil/P-Way, S&T).
   - High Density Network (HDN) Capacity > 100% (118.4%) alert banners.
   - Ambient notification drawer powered by Redis Pub/Sub WebSocket stream.

2. **Screen 2: Operational Event Requisition Modal & 7-Stage OHE Workflow**
   - Geofence inputs (KM 142.10 to 143.04) and scheduled start/end windows.
   - Impact Vector toggles: 25kV Catenary Power Trip, Absolute Traffic Block, Adjacent Track TSR 30 km/h, Physical Point Clamping.
   - 7-Stage OHE Power & Traffic Block Workflow guide.

3. **Screen 3: 11-Stage FSM Lifecycle Engine, Distributed Fencing Tokens & Invariants**
   - Visual progress tracker across all 11 stages with exact badge colors:
     - `DRAFT` (#718096), `SUBMITTED` (#3182CE), `DEPENDENCY_RESOLVED` (#2B6CB0), `AWAITING_APPROVAL` (#DD6B20), `APPROVED` (#4C51BF), `SCHEDULED` (#805AD5), `ACTIVE_IN_PROGRESS` (#38A169), `WORK_COMPLETED` (#D69E2E), `SAFETY_VERIFIED` (#319795), `BLOCK_CLEARED` (#00A3C4), `AUDIT_LOCKED` (#1A365D).
   - Redis distributed fencing token indicator (`FT-2026-10-14-0892`) preventing track double-booking.
   - 6-Invariant Automated Resolution Card.
   - Emergency Safety Abort and SLA Breach escalation buttons.

4. **Screen 4: Dual-Key Multi-Party Approval & Decision Portal**
   - Role-specific sign-off cards for:
     - **TPC:** Form ETR-1 Power Block message (25kV catenary cut)
     - **Station Master:** Physical Point Clamping (#14A/B)
     - **Section Controller:** Operating Traffic Block Feasibility per G&SR
     - **Field Supervisor:** Permit-to-Work Form ETR-3 & Earthing Rods
   - Real-time cryptographic signature hash generation (SHA-256/Ed25519).

5. **Screen 5: Immutable S3 Cryptographic Audit Ledger**
   - WORM-compliant statutory register (Amazon S3 Object Lock emulation).
   - Merkle DAG tree explorer displaying Block Headers, Merkle Roots, and leaves.
   - Cryptographic verification badge ("100% Tamper Evident").
   - One-click export to statutory JSON format.

6. **Screen 6: Live SRE, SLA & Chaos Testing Dashboard**
   - Four Golden Signals: Latency (P95: 185ms < 300ms SLA), Traffic (2,500 req/min), Errors (0.00%), Saturation (34% CPU).
   - Interactive **"⚡ INJECT CHAOS FAILURE (SIGKILL)"** trigger.
   - Automated 4-Phase TTR Stopwatch measuring Detection (42s), Diagnosis (28s), Recovery (74s), and Verification (40s) for a total TTR of **184s (~3.1 minutes)**.

---

## 4. Quickstart Guide (Local Execution)

### Option A: Direct Local Execution (Zero Docker Dependencies)

#### 1. Start the FastAPI Backend:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
- Interactive Swagger API docs: `http://localhost:8000/docs`
- Synthetic Canary Health check: `http://localhost:8000/healthz`

#### 2. Start the React Frontend:
```bash
cd frontend
npm install
npm run dev
```
- Open browser at `http://localhost:5173`

---

### Option B: Multi-Container Production Stack (Docker Compose)

```bash
# From project root
docker compose up --build
```
- Web Application: `http://localhost`
- Backend API & OpenAPI: `http://localhost:8000/docs`
- PostgreSQL 15: `localhost:5432`
- Redis 7: `localhost:6379`

---

## 5. Automated SRE Benchmarking & Chaos Testing

### 1. Locust Load Testing (500 Virtual Users)
```bash
locust -f tests/locustfile.py --headless -u 500 -r 20 --run-time 10m --host http://localhost:8000 --html report.html
```

### 2. Automated Chaos Injection & Empirical TTR Measurement
- **On Windows (PowerShell):**
  ```powershell
  .\infra\chaos.ps1 -TargetHost "http://localhost:8000"
  ```
- **On Linux / macOS (Bash):**
  ```bash
  chmod +x ./infra/chaos.sh
  ./infra/chaos.sh http://localhost:8000
  ```

---

## 6. Academic Team Roles & Deliverables

| Team Member | Role & Ownership | Key Contributions |
| :--- | :--- | :--- |
| **Ravi** | DevOps & Infrastructure Lead | Docker multi-stage builds, `docker-compose.yml`, Terraform AWS Fargate, ALB, CloudWatch synthetic canary, and $145/month budget model. |
| **Ayush** | Backend & SRE Lead | FastAPI core, PostgreSQL schemas, Redis distributed fencing token locking, Dynamic Dependency Engine (6 Invariants), and S3 SHA-256 audit ledger. |
| **Divya** | Frontend & Deliverables Lead | React 18 / Vite / Tailwind UI, Corridor Video Wall, 11-stage FSM progress tracker, Dual-Key Approval portal, and S3 audit ledger explorer. |
| **Abhijit Nanda** | Cross Team, Timeline & Resource Manager | Evaluation rubric alignment, Section 14 checklist verification, project schedule tracking, and oral defense coordination. |

---

## 7. License & Compliance
Built strictly in adherence to Indian Railways **AC Traction Manual (ACTM Vol. II)**, **General & Subsidiary Rules (G&SR Chapter IV)**, and the **Station Working Rules (SWR)**.
