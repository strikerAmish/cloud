# RailSync: Field Mobile Architecture & Comprehensive Resource Guide (`resources.md`)

> **Document Classification:** System Design, Mobile Architecture & Resource Specification  
> **Target Subsystem:** RailSync Field Mobile Application (Android / PWA) & Dual-Interface Interaction Model  
> **Domain:** Indian Railways Critical Infrastructure (Traction Power, Permanent Way, Signalling & Operating)

---

## 1. Executive Feasibility Analysis: Is an Android Field Interface Possible?

### **Yes, 100% Feasible and Architecturally Recommended.**

In fact, the **RailSync Master System Design** (referenced in `docs/SYSTEM_DESIGN_DEEP_DIVE.md` and the Section 14 evaluation rubric) explicitly specifies a **Two-Interface Architecture**:

```
+-----------------------------------------------------------------------------------+
|                              RAILSYNC CLOUD LAYER                                 |
|          AWS ECS Fargate Microservices • Amazon RDS • ElastiCache Redis           |
+-----------------------------------------------------------------------------------+
                                   ▲                             ▲
                    mTLS / WebSocket REST          HTTPS / WebSocket REST
                                   │                             │
    ┌──────────────────────────────┴──────┐       ┌──────────────┴─────────────────────┐
    │       INTERFACE 1: DESKTOP / WEB    │       │     INTERFACE 2: ANDROID MOBILE     │
    │      (AUTHORITY & DECISION DESK)    │       │      (FIELD STAFF & REQUISITION)    │
    │  • Station Master (Patna / Danapur) │       │  • SSE (Senior Section Engineer)   │
    │  • Traction Power Controller (TPC)  │       │  • P-Way Gang Supervisors          │
    │  • Section Traffic Controller (DOM) │       │  • S&T Field Maintainers           │
    │  • Safety Directors (DRM / CRS)     │       │  • OHE Ladder & Tower Wagon Crews  │
    └─────────────────────────────────────┘       └────────────────────────────────────┘
```

### Why a Dedicated Android Interface is Essential:
1. **Frontline Friction Elimination:** Field supervisors (SSEs and Junior Engineers) operate along open railway tracks, ballast banks, and high-voltage catenary gantries where carrying laptops is hazardous and impractical.
2. **Hardware Sensor Leverage:** Native Android APIs directly provide high-accuracy GPS geolocation, camera sensor access with tamper-evident EXIF injection, and biometric authentication for digital signing.
3. **Cellular Partition Resilience (Offline-First):** Railway tracks pass through remote geographical cuttings where 4G/5G signals drop. A mobile application with an encrypted local SQLite store queues requisitions and photos offline, synchronizing automatically via Transactional Outbox when cellular handshake returns.

---

## 2. The Two-Interface Operational Model

| Dimension | **Interface 1: Authority & Decision Portal (Web)** | **Interface 2: Field Mobile App (Android)** |
| :--- | :--- | :--- |
| **Primary Users** | Station Master (SM), Traction Power Controller (TPC), Section Controller (Operating). | Senior Section Engineers (SSE - P-Way, OHE, S&T), Gang Supervisors, Tower Wagon In-Charge. |
| **Form Factor** | Desktop / Workstation Multi-Monitor Video Wall (Chrome / Edge). | Ruggedized Android Smartphones / Industrial Handhelds (IP68). |
| **Core Functions** | Multi-party dual-key sign-off, conflict resolution, G&SR interlocking checks, S3 WORM audit ledger review, live SRE telemetry. | Site arrival check-in, geotagged photo evidence upload, block requisition memos, department tagging, live chat queries with SM. |
| **CAP Stance** | **Strict CP:** Fails closed if consensus or physical interlocks cannot be validated. | **Hybrid CP / AP:** Informational draft/chat tasks run AP (offline queued); final safety handoffs run strict CP. |
| **Input Modality** | Keyboard, mouse, cryptographic hardware security keys (FIDO2 / mTLS tokens). | Touchscreen, camera snapshot, voice memos, GPS location stamp. |

---

## 3. Comprehensive Feature Set for Interface 2 (Android Field App)

### Feature 1: Geotagged Camera & Field Photo Verification
* **Automated Chainage Stamp:** When the supervisor takes a photo of track damage, tamping units, or catenary earthing discharge rods, the app captures:
  * Precise GPS Coordinates (Latitude, Longitude, Altitude, Accuracy radius in meters).
  * Calculated Railway Kilometrage Chainage (e.g., `KM 548/12 - 548/20`).
  * UTC Timestamp from Network Time Protocol (NTP) to prevent device clock manipulation.
  * Device UID and SIM IMSI identifier.
* **Watermark Injection:** Automatically burns an indelible cryptographic watermark into the JPEG byte stream before upload.
* **Anti-Spoofing & Liveness Guard:** Android `FusedLocationProviderClient` verifies mock-location flags; photos cannot be uploaded from device gallery—only real-time camera viewfinder captures are accepted.

### Feature 2: Mobile Block Requisition & Impact Vector Selection
* **Single-Screen Requisition Form:**
  * Select Section (`Danapur – Patna Jn`, `Ara – Danapur`, `Buxar – Ara`, etc.).
  * Select Track ID (`UP MAIN`, `DN MAIN`, `LOOP 01`, `YARD 04`).
  * Chainage Geofence (`KM Start` to `KM End`).
  * Time Slot: Requested Start and Duration (hours/minutes).
* **Impact Vector Checkboxes (Touch-Friendly):**
  * `[x]` **25kV Traction Power Cut Required** (automatically routes requisition to TPC queue).
  * `[x]` **Absolute Traffic Block Required** (routes to Section Controller timetable engine).
  * `[x]` **Adjacent Track Caution / TSR 30 km/h** (routes to neighbouring station master).
  * `[x]` **Facing Point Padlocking / Clamping Required** (routes to Station Master).

### Feature 3: Inter-Department Tagging & Live Operational Query System
* **Department Tagging Matrix:**
  * Field crew can tag relevant departments: `@OHE`, `@CIVIL_P_WAY`, `@S_AND_T`, `@OPERATING`.
  * Multi-department joint work notification (e.g., P-Way track tamping requires S&T axle counter bonding check).
* **Real-Time Two-Way Clarification Desk:**
  * Instant messaging thread linked specifically to the `OperationalEvent` UUID.
  * Field staff can query Station Master: *"Padlocking on Point 14B complete? Tower Wagon ready at Signal 12."*
  * Station Master can respond with one-tap statutory canned codes (e.g., `CODE_SM_04: REVERSE ROUTE LOCKED`).
  * Full chat transcript is SHA-256 hashed and committed to the statutory audit ledger.

### Feature 4: Digital Permit-to-Work (Form ETR-3 & Form 3-PTW)
* Once Dual-Key approval is granted by TPC and Station Master, the Android screen displays a **Golden Verified Digital Permit Badge**.
* Displays:
  * Monotonic Fencing Token ID (`FT-2026-10-14-0892`).
  * Authorized Window: `23:30Z – 02:00Z (150 mins remaining)`.
  * Digital QR code for on-site inspection by Safety Directorate / RPF patrol.
  * One-tap **"Commence Work on Track"** and **"Work Completed & Personnel Evacuated"** buttons.

---

## 4. Mobile Architecture & Tech Stack Evaluation

| Technology | Recommendation | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **React Native (TypeScript)** *(Top Recommendation)* | ⭐ **Strongly Recommended** | • Reuses existing TypeScript types (`types.ts`) and API client (`api.ts`).<br>• Fast development cycle with Expo Camera & Location.<br>• Identical UI design system (Tailwind NativeWind). | Requires React Native runtime engine. |
| **Android Progressive Web App (PWA)** | ⭐ **Fastest Zero-Install Option** | • Zero app store distribution friction.<br>• Works immediately on any Android browser via "Add to Home Screen".<br>• Service Worker handles offline caching & background sync. | Cannot bypass background OS battery optimizations as aggressively as native. |
| **Kotlin Native (Jetpack Compose)** | Enterprise Grade | • Deepest hardware integration (custom camera pipeline, background BLE beacons).<br>• Hardened security container for Indian Railways CRIS enterprise MDM. | Requires separate Android codebase maintenance. |
| **Flutter (Dart)** | Viable Alternative | • Smooth 60fps animations.<br>• Built-in SQLite and camera plugins. | Duplicate domain model definitions (Dart vs TypeScript). |

---

## 5. API Endpoints Required for Mobile Client

The backend (`backend/routers/events.py` and `backend/main.py`) already provides the RESTful contracts. The mobile application consumes:

### A. Requisition & Query Endpoints
* **`POST /api/v1/events`** — Submit new field block requisition memo.
* **`GET /api/v1/events`** — Retrieve all corridor events filtered by mobile user's division.
* **`GET /api/v1/events/{id}`** — Detailed view of event state, fencing token, and permits.
* **`POST /api/v1/events/{id}/activate`** — Site supervisor marks crew active on track.
* **`POST /api/v1/events/{id}/complete`** — Field crew marks work done and safety rods removed.

### B. Mobile-Specific Extensions (Camera & Query Thread)
* **`POST /api/v1/events/{id}/attachments`**
  * **Payload:** `multipart/form-data` with JPEG image file, `lat`, `lng`, `accuracy_m`, `km_chainage`, `supervisor_id`.
  * **Processing:** Backend verifies image SHA-256, stores image to Amazon S3, appends metadata to PostgreSQL `operational_events.field_photo`.
* **`POST /api/v1/events/{id}/queries`**
  * **Payload:** `{ "sender_role": "FIELD_SUPERVISOR", "tagged_depts": ["OPERATING", "OHE"], "message": "..." }`
  * **Processing:** Broadcasts instantaneously to Station Master's TopHeader via WebSocket `/ws/corridor`.
* **`GET /api/v1/events/{id}/queries`**
  * **Returns:** Full chronological question-and-answer ledger between field team and station master.

---

## 6. Database Schema Extensions for Mobile Support

To store field photos and inter-departmental chat threads persistently, the following tables extend `backend/schema.sql`:

```sql
-- 1. Mobile Geotagged Field Attachments
CREATE TABLE IF NOT EXISTS field_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
    photo_url VARCHAR(512) NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    km_chainage VARCHAR(32) NOT NULL,
    uploaded_by VARCHAR(64) NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    watermark_verified BOOLEAN DEFAULT TRUE
);

-- 2. Inter-Departmental Real-Time Operational Queries & Responses
CREATE TABLE IF NOT EXISTS operational_queries (
    query_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(64) NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) NOT NULL,
    sender_role VARCHAR(32) NOT NULL,
    tagged_departments JSONB NOT NULL DEFAULT '[]',
    query_text TEXT NOT NULL,
    response_text TEXT,
    responded_by VARCHAR(64),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ANSWERED', 'RESOLVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_attachments_event ON field_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_queries_event ON operational_queries(event_id);
```

---

## 7. Wireframe & User Flow for the Android App

```
+-------------------------------------------------------+
|  [≡] RailSync Field Crew        Danapur (DNR)   [98%] |
|  Signed in as: SSE / OHE (Patna Section)              |
+-------------------------------------------------------+
|  +-------------------------------------------------+  |
|  | [📷 Take GeoTagged Inspection Photo]           |  |
|  | Chainage: KM 548/14 UP MAIN  • Lat 25.602, 85.12 |  |
|  +-------------------------------------------------+  |
|                                                       |
|  ACTIVE REQUISITIONS IN YOUR JURISDICTION:            |
|  +-------------------------------------------------+  |
|  | EVT-2026-10-16-001  • Stage 4 (Awaiting SM)     |  |
|  | Track: Up Main (KM 548 - 554)                   |  |
|  | 25kV Catenary Power Trip • Form ETR-1 Signed    |  |
|  |                                                 |  |
|  | [@ Tag Depts]  [💬 Chat with SM]  [View Permit] |  |
|  +-------------------------------------------------+  |
|                                                       |
|  +-------------------------------------------------+  |
|  | [➕ DRAFT NEW BLOCK REQUISITION MEMO]          |  |
|  +-------------------------------------------------+  |
|                                                       |
|  [⚡ Network: 4G Connected | SQLite Sync: 0 pending]  |
+-------------------------------------------------------+
```

### Typical Field Crew User Flow:
1. **Site Arrival:** Supervisor arrives at Danapur KM 548; launches RailSync Field App.
2. **Photo Evidence:** Taps *"Take Geotagged Photo"*; points camera at the OHE contact wire or track fault. The app captures GPS, chainage, and watermarks the image.
3. **Draft Requisition:** Fills the memo, selects `25kV Power Trip` and `Traffic Block`, tags `@OPERATING` and `@OHE`.
4. **Instant Transmission:** Requisition hits the backend, triggering WebSocket notifications on Station Master and TPC desktop screens.
5. **Clarification Thread:** Station Master queries via portal: *"Are tower wagons positioned in sidings?"* Supervisor responds from Android app: *"Yes, Tower Wagon 04 secured on Loop Line 2."*
6. **Permit Issuance:** Once Dual-Key sign-off is finished, supervisor's phone vibrates with the digital Form ETR-3 and Fencing Token.
7. **Safe Restoration:** When maintenance finishes, supervisor takes an "After" photo showing earthing rods removed, taps **"Clear Block & Safety Certification"**, and state synchronizes across the division.

---

## 8. Summary of Key Developer Resources & Boilerplates

### Relevant Project Files Already in Repository:
1. **API Client & Networking:** [`frontend/src/api.ts`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/frontend/src/api.ts) — handles traceparent propagation and REST calls.
2. **Domain Type Definitions:** [`frontend/src/types.ts`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/frontend/src/types.ts) — reusable across mobile.
3. **Database DDL:** [`backend/schema.sql`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/backend/schema.sql) — primary schema definitions.
4. **System Architecture Deep Dive:** [`docs/SYSTEM_DESIGN_DEEP_DIVE.md`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/docs/SYSTEM_DESIGN_DEEP_DIVE.md) — Section on Mobile Offline Resilience and CAP boundaries.
5. **Evaluation Rubric Reference:** [`docs/SECTION_14_EVALUATION_RUBRIC.md`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/docs/SECTION_14_EVALUATION_RUBRIC.md) — Rubric mapping for mobile edge architecture.

### Recommended Implementation Steps:
1. **Step 1:** Build an Android PWA or React Native mobile screen under `frontend/src/components/mobile/`.
2. **Step 2:** Mount HTML5 Geolocation API (`navigator.geolocation.watchPosition`) and Camera Input (`<input type="file" accept="image/*" capture="environment">`).
3. **Step 3:** Connect to `/ws/corridor` for real-time push alerts to the mobile screen.
4. **Step 4:** Leverage local `IndexedDB` or SQLite for offline requisition caching.

---

## 9. Statutory Safety Restriction Protocols & Incident Mitigation Matrix for Ongoing Works

### 9.1 Overview & Indian Railways Regulatory Mandate
When track maintenance or engineering work transitions to `ACTIVE_IN_PROGRESS` (FSM Stage 5/6), Indian Railways General & Subsidiary Rules (G&SR), the Indian Railways Permanent Way Manual (IRPWM), and the AC Traction Manual (ACTM Vol II) mandate strict, multi-layered statutory restrictions. 

In RailSync, clicking the **Track Possession Active** or **Safety Restrictions Banner** triggers an exhaustive, real-time **Statutory Safety Restriction & Mitigation Protocol Report (Form 3-PTW)**. This report dynamically derives restrictions based on the selected event's `impact_vector`, `permits`, `invariants`, and `department`.

---

### 9.2 Four-Pillar Statutory Safety Restriction Framework

```
+--------------------------------------------------------------------------------------------------+
|                     RAILSYNC FOUR-PILLAR STATUTORY SAFETY RESTRICTION ENVELOPE                    |
+---------------------------------+----------------------------------------------------------------+
| 1. Interlocking & Point Clamps   | • Facing points clamped with mechanical screw clamps & padlocked|
|    (G&SR 15.06 / SWR 8.4)       | • Point keys deposited in Station Master custody box            |
|                                 | • Reversing routes electronically blocked via Central Interlock|
+---------------------------------+----------------------------------------------------------------+
| 2. Traction Power Isolation     | • 25kV AC catenary circuit breaker tripped at Feeding Post (FP)|
|    (ACTM Vol II / Form ETR-1)   | • SCADA remote lock applied with auto-reclosure disabled       |
|                                 | • 2x Discharge Earthing Rods clamped to rails & contact wire   |
+---------------------------------+----------------------------------------------------------------+
| 3. Traffic Movement Protection  | • Absolute line block entered in Train Register Book (T/351)   |
|    (G&SR 15.09 / Caution Orders)| • Banner flags posted at 600m; 3 detonators placed at 1200m     |
|                                 | • Adjacent line Temporary Speed Restriction (TSR 20/30 km/h)   |
+---------------------------------+----------------------------------------------------------------+
| 4. Men & Machinery Envelope     | • Track machine (e.g., CSM-952) secured within fouling marks   |
|    (IRPWM Para 808 / PPE Audit) | • Lookout men posted with klaxon horns & hand hazard flags     |
|                                 | • Biometric/Geo-fence quorum verified for maintenance gang      |
+---------------------------------+----------------------------------------------------------------+
```

---

### 9.3 Department-Specific Safety Restriction Mapping for Ongoing Works

The ongoing works in the Danapur–Patna corridor trigger specific restriction profiles:

| Work ID | Department & Activity | Primary Safety Measures Applied | Statutory Restrictions Imposed |
| :--- | :--- | :--- | :--- |
| **`EVT-ENG-2026-00109`** | **Civil P-Way**<br>CSM-952 Track Tamping Machine Live Profiling (KM 154–156) | • Point #14A clamped & padlocked<br>• Banner flags posted at 600m & 1200m<br>• Machine clearance gauge monitored | • **Absolute Block:** Up Main blocked to all traffic<br>• **Adjacent Line TSR:** 20 km/h on Down Main<br>• **OHE Buffer:** 2.0m clearance from live 25kV wire |
| **`EVT-OHE-2026-00104`** | **Traction / OHE**<br>Emergency Catenary Contact Wire Splicing (KM 141.2–142.0) | • 25kV Power Cut at FP-04 (Form ETR-1)<br>• Dual earthing discharge rods clamped 100m upstream/downstream<br>• Tower Wagon 04 positioned | • **Catenary Isolation:** 0.0 kV dead line<br>• **Traffic Block:** Complete line isolation<br>• **Adjacent Track TSR:** 30 km/h caution order |
| **`EVT-SIG-2026-00114`** | **Signal & Telecom (S&T)**<br>Digital Axle Counter Head Replacement (KM 118–119.5) | • Disconnection notice Form S&T-14 served<br>• Detector blade mechanical locking<br>• Shunt resistance verification | • **Signal Interlock:** Signals 12 & 14 locked at Danger<br>• **Movement Restriction:** Pilot movements on PLCT only<br>• **Speed Restriction:** 30 km/h through point zone |
| **`EVT-PWY-2026-00116`** | **Bridges & Civil**<br>Bridge #38 Ballast Wall Concrete Casting (KM 72.0–74.5) | • Pier scaffolding safety envelope checked<br>• Lookout men with whistles posted 500m both directions<br>• Approach crossover clamped | • **Speed Restriction:** TSR 30 km/h over bridge<br>• **Track Block:** Up line blocked during concrete pour<br>• **Vibration Isolation:** Heavy freight deferred |

---

### 9.4 Data Architecture for Interactive Safety Report

The interactive report modal consumes data from `OperationalEvent`:

```typescript
export interface StatutorySafetyReport {
  eventId: string;
  section: string;
  trackId: string;
  chainage: string;
  department: string;
  fsmStage: number;
  status: string;
  issuedAt: string;
  validUntil: string;
  custodianOfficer: string;
  
  // Restriction Pillars
  interlockingIsolation: {
    pointsClamped: boolean;
    pointNumbers: string[];
    padlockKeyId: string;
    routeLockStatus: string;
  };
  tractionPowerIsolation: {
    powerTripped: boolean;
    catenaryVoltageKv: number;
    feedingPosts: string[];
    earthingDischargeRods: number;
    permitForm: string; // Form ETR-1 / Form3-PTW
    scadaBreakerId: string;
  };
  trafficMovementRestrictions: {
    absoluteBlock: boolean;
    tsrSpeedKmh: number;
    adjacentLineRestriction: string;
    bannerFlagDistanceM: number;
    detonatorsPlaced: number;
    cautionOrderNoticeNumber: string;
  };
  siteProtectionEnvelope: {
    machineryDeployed: string;
    foulingMarkClearanceM: number;
    lookoutMenCount: number;
    gangCrewCount: number;
    emergencyHotline: string;
  };
  cryptographicSignatures: Array<{
    role: string;
    officerId: string;
    hash: string;
    timestamp: string;
  }>;
}
```

---

### 9.5 Interactive UI UX Design for the Safety Banner

1. **Interactive Trigger:**
   - The red top banner (`#corridor-awareness-banner`) in [`RightActionPane.tsx`](file:///c:/Users/toami/Desktop/Intro_Chemical%203007/frontend/src/components/RightActionPane.tsx) is clickable with hover elevation (`transform: translateY(-1px)`, subtle ring outline, pointer cursor).
   - An interactive badge is displayed: `🔍 Click for Statutory Safety & Restriction Protocol Report`.
   - The individual telemetry badges (`📍 Section`, `⚡ Catenary`, `🔒 Interlocking`, `🚆 Train Traffic`) also serve as deep-links into specific protocol sections.

2. **Modal Experience:**
   - Full-bleed statutory Form 3-PTW certificate layout with official Indian Railways emblem header styling.
   - Live status badges for each restriction pillar (Active Interlock, 25kV Dead Line, Speed Restriction, Detonator Layout).
   - Real-time chainage schematic showing where the machine is operating and where warning flags/detonators are posted.
   - Statutory Officer Sign-off Ledger with cryptographic SHA-256 hashes verifying compliance.
   - Action buttons: *"Print / Export Form 3-PTW Certificate"* and *"Station Master Emergency Hotline"*.

