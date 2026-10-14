# RailSync: End-to-End Enterprise System Design Deep Dive

This document provides a comprehensive technical blueprint of RailSync's distributed systems architecture, resiliency mechanics, concurrency control, and decentralized edge-cloud mesh.

---

## 1. High-Level Architecture (HLD) & Low-Level Component Design (LLD)

```
+---------------------------------------------------------------------------------------------------+
|                                           CLIENT TIER                                             |
|  +-------------------------------------+                +--------------------------------------+  |
|  |    React 18 Control Video Wall      |                |    React Native Field Client App     |  |
|  |    (TypeScript / Tailwind / Vite)   |                |    (Encrypted SQLite Offline Cache)  |  |
|  +------------------+------------------+                +------------------+-------------------+  |
+---------------------|------------------------------------------------------|----------------------+
                      | HTTPS / WSS (TLS 1.3)                                | HTTPS (mTLS)
+---------------------v------------------------------------------------------v----------------------+
|                                    GATEWAY & INGESTION TIER                                       |
|  +---------------------------------------------------------------------------------------------+  |
|  | Amazon Route 53 (Latency Routing) -> AWS WAF (DDoS / OWASP Filtering)                       |  |
|  | AWS Application Load Balancer (ALB) -> mTLS Client Authentication & Path Routing            |  |
|  +----------------------------------------------+----------------------------------------------+  |
+-------------------------------------------------|-------------------------------------------------+
                                                  | Reverse Proxy / Load Balancing
+-------------------------------------------------v-------------------------------------------------+
|                               MICROSERVICES ENGINE (AWS ECS FARGATE)                              |
|  +------------------------+  +------------------------+  +-------------------------------------+  |
|  |   Event Ingestion API  |  |  Dependency DAG Engine |  |    Dual-Key Approval Authority      |  |
|  |  - Pydantic Validation |  |  - 6 Invariant Matrix  |  |    - Digital Signatures             |  |
|  |  - Geofence Resolution |  |  - Conflict Detector   |  |    - G&SR SOP Enforcement           |  |
|  +-----------+------------+  +-----------+------------+  +------------------+------------------+  |
|              |                           |                                  |                     |
|  +-----------v---------------------------v----------------------------------v------------------+  |
|  |  Transactional Outbox Publisher (Atomic Local Outbox Table -> Debezium CDC -> Redis Mesh)   |  |
+--+---------------------------------------+-----------------------------------------------------+--+
                                           |
         +---------------------------------+---------------------------------+
         | Writes & CDC Events                                               | Pub/Sub Broadcast
+--------v----------------------------------+             +------------------v----------------------+
|    ACID CORE (AMAZON RDS POSTGRESQL)      |             |  IN-MEMORY EVENT MESH (ELASTICACHE REDIS)|
|  +-------------------------------------+  |             |  +-----------------------------------+  |
|  | Primary DB (Multi-AZ Multi-Master)  |  |             |  | Pub/Sub Engine (<5ms Fan-out)     |  |
|  | - OperationalEvents Table           |  |             |  | - Channel: corridor:ngp:wda       |  |
|  | - Transactional Outbox Table        |  |             |  | Distributed Lock Manager (Redlock)|  |
|  | - Stakeholders & Authority Matrix   |  |             |  | - Monotonic Fencing Tokens        |  |
|  +------------------+------------------+  |             |  +-----------------------------------+  |
+---------------------|---------------------+             +-----------------------------------------+
                      | Streaming WAL
+---------------------v---------------------+             +-----------------------------------------+
|   IMMUTABLE AUDIT STORE (AMAZON S3)       |             |          OBSERVABILITY STACK            |
|  +-------------------------------------+  |             |  +-----------------------------------+  |
|  | S3 Object Lock (WORM Legal Hold)    |  |             |  | OpenTelemetry Tracing Agents      |  |
|  | SHA-256 Hash-Chained Audit Ledger   |  |             |  | CloudWatch Canary Synthetic Probes|  |
|  +-------------------------------------+  |             |  | Prometheus & Grafana Corridor SRE |  |
+-------------------------------------------+             +-----------------------------------------+
```

---

## 2. Distributed Systems Patterns

### 2.1 Transactional Outbox Pattern with Change Data Capture (CDC)
- **Problem (Dual-Write Hazard):** Updating a relational database and publishing to a message broker in two separate network steps creates inconsistency if one step fails.
- **Solution:** When an event state transition occurs, RailSync writes the mutated `OperationalEvent` entity and an `OutboxEvent` record into PostgreSQL within the same atomic ACID transaction.
- **CDC Streaming:** A Debezium CDC engine tails the PostgreSQL Write-Ahead Log (WAL) and streams committed rows to Redis Pub/Sub with guaranteed at-least-once delivery.

### 2.2 Command Query Responsibility Segregation (CQRS)
- **Command Model (Writes):** State mutations (requisitions, sign-offs, completions) execute exclusively through command handlers writing to PostgreSQL with strict row-level locks.
- **Query Model (Reads):** Video walls, station master consoles, and mobile clients read from pre-materialized in-memory projections in Redis with sub-5ms latency, protecting the relational core from query exhaustion.

### 2.3 Distributed Locking with Monotonically Incrementing Fencing Tokens
- **Danger:** Conflicting block grants on overlapping track kilometers (e.g. KM 142.10–143.04).
- **Protocol:**
  1. Acquire distributed lock in Redis keyed by track segment hash `lock:track:{section}:{track_id}`.
  2. Redis atomically increments a 64-bit integer fencing token (`INCR railsync:fencing_token_counter`).
  3. When persisting to PostgreSQL, the database validates `WHERE fencing_token > last_fencing_token`. Stale or delayed workers with older tokens abort immediately.

---

## 3. Resiliency Engineering & Circuit Breakers

### 3.1 Idempotency Engine
- To prevent duplicate block requisitions during mobile network retries, mutating requests require an `Idempotency-Key` UUID header.
- Redis evaluates the key using atomic `SETNX` with a 120-second TTL. If already present, cached responses are returned immediately without re-executing backend workflows.

### 3.2 Circuit Breaker Architecture
- Downstream CRIS COA/FOIS APIs are wrapped in circuit breakers:
  - **CLOSED:** Normal request flow. Failures tracked over 30-second rolling windows.
  - **OPEN:** If failure rate exceeds 50% or P95 latency exceeds 2,000ms over 20 requests, requests fail immediately to dead-letter queues.
  - **HALF-OPEN:** After 60-second cooldown, probes test downstream recovery.

---

## 4. CAP Theorem & Consistency Trade-Off Analysis

| System Dimension | Safety-Critical Core (Strict CP Stance) | Telemetry & Video Wall (AP Stance) |
| :--- | :--- | :--- |
| **Workloads** | Block Requisitions, Dual-Key Approvals, ETR Permits, Interlocking | Corridor Video Walls, Ambient Awareness Alerts, Historical Analytics |
| **Consistency Model** | Strict Linearizable Consistency (ACID transactions, row locks, fencing tokens) | Eventual Consistency (sub-5ms propagation lag across Redis replicas) |
| **Partition Behavior** | **FAILS CLOSED:** If network connectivity is lost, block granting is blocked. Offline approvals prohibited. | **FAILS OPEN:** Dashboards continue rendering cached corridor state with prominent lag counters. |
| **Data Stores** | Amazon RDS PostgreSQL 15 Multi-AZ | Amazon ElastiCache Redis 7 Cluster |

---

## 5. Decentralized & Distributed Edge-Cloud Architecture

### 5.1 Autonomous Divisional Edge Nodes (DEN)
- Autonomous Divisional Edge Nodes deployed at Divisional HQs (e.g., Nagpur HQ) and Station Edge Gateways (SEG) at major junctions (Wardha, Sevagram).
- **100% Offline Islanding:** If WAN connection to AWS Mumbai is cut, Station Masters and Section Controllers continue coordinating locally without disruption.
- **Raft Consensus for Track Locking:** Quorum (3 of 5) redundant appliances in the division control office prevent split-brain track reservations during blackouts.

### 5.2 Consortium Merkle DAG Ledger & CRDTs
- **Consortium Nodes:** Operated independently by Railway Board, CRIS Central, Zonal HQ, and Commission of Railway Safety (CRS).
- **Merkle DAG:** Every block references the previous block's SHA-256 hash. Multi-signature consensus proof (Ed25519) guarantees non-repudiation across departments.
- **CRDTs:** Field informational updates (photo evidence, notes) use Observed-Remove Sets (OR-Sets) and Last-Write-Wins (LWW) to merge deterministically upon reconnection.
