"""
RailSync - Database Persistence & Transactional Outbox Engine
Implements PostgreSQL 15 DDL Schemas with ACID local persistence and transactional outbox.
Seeds initial railway corridor and operational events.
"""

import sqlite3
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path


DB_FILE = Path(__file__).parent / "railsync.db"


def get_db_connection():
    conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Table: operational_events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS operational_events (
        id TEXT PRIMARY KEY,
        division VARCHAR(50) NOT NULL,
        section VARCHAR(100) NOT NULL,
        track_id VARCHAR(50) NOT NULL,
        km_start REAL NOT NULL,
        km_end REAL NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        requested_start TEXT NOT NULL,
        requested_end TEXT NOT NULL,
        fencing_token INTEGER UNIQUE,
        impact_vector TEXT NOT NULL,
        description TEXT NOT NULL,
        originator_id VARCHAR(50) NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Table: event_stakeholders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS event_stakeholders (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
        department VARCHAR(50) NOT NULL,
        role VARCHAR(50) NOT NULL,
        officer_id VARCHAR(50) NOT NULL,
        approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        signature_hash VARCHAR(64),
        signed_at TEXT,
        rejection_reason TEXT
    );
    """)

    # 3. Table: statutory_permits
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS statutory_permits (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
        permit_type VARCHAR(30) NOT NULL,
        earthing_discharged BOOLEAN DEFAULT 0,
        power_tripped BOOLEAN DEFAULT 0,
        points_clamped BOOLEAN DEFAULT 0,
        issued_at TEXT DEFAULT CURRENT_TIMESTAMP,
        officer_id VARCHAR(50) NOT NULL,
        notes TEXT
    );
    """)

    # 4. Table: transactional_outbox (Atomic Local Outbox -> CDC -> Redis Mesh)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactional_outbox (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        payload TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'COMMITTED',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Table: idempotency_cache
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS idempotency_cache (
        idempotency_key TEXT PRIMARY KEY,
        response_payload TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # Purge legacy corridor data if present so database matches frontend
    cursor.execute("SELECT COUNT(*) as cnt FROM operational_events WHERE division = 'NGP' OR section LIKE '%Wardha%'")
    old_cnt = cursor.fetchone()["cnt"]
    if old_cnt > 0:
        cursor.execute("DELETE FROM statutory_permits")
        cursor.execute("DELETE FROM event_stakeholders")
        cursor.execute("DELETE FROM operational_events")
        cursor.execute("DELETE FROM transactional_outbox")
        conn.commit()

    # Seed baseline events if database is empty
    cursor.execute("SELECT COUNT(*) as cnt FROM operational_events")
    count = cursor.fetchone()["cnt"]

    if count == 0:
        seed_baseline_event(cursor)
        conn.commit()

    conn.close()


def seed_baseline_event(cursor):
    now = datetime.now(timezone.utc)
    req_start = (now + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    req_end = (now + timedelta(hours=4)).isoformat().replace("+00:00", "Z")

    # -------------------------------------------------------------
    # Event 1: Danapur–Patna Junction (Stage 4 / Awaiting Approval)
    # -------------------------------------------------------------
    sample_id = "EVT-ENG-2026-00132"
    impact_vector = {
        "catenary_25kv_power_trip": False,
        "absolute_traffic_block": True,
        "speed_restriction_kmh": 30,
        "feeding_posts": [],
        "points_clamping_required": True,
        "track_bonding_notice": False
    }

    cursor.execute("""
    INSERT INTO operational_events (
        id, division, section, track_id, km_start, km_end, status,
        requested_start, requested_end, fencing_token, impact_vector,
        description, originator_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        sample_id,
        "DNR",
        "Danapur–Patna Junction",
        "UP_MAIN",
        156.40,
        158.20,
        "AWAITING_APPROVAL",
        req_start,
        req_end,
        901,
        json.dumps(impact_vector),
        "Continuous Rail Ultrasonic Flaw Detection (USFD) & Heavy Ballast Tamping",
        "SSE_PWAY_DNR_03",
        now.isoformat().replace("+00:00", "Z"),
        now.isoformat().replace("+00:00", "Z")
    ))

    cursor.executemany("""
    INSERT INTO event_stakeholders (
        id, event_id, department, role, officer_id, approval_status, signature_hash, signed_at, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (str(uuid.uuid4()), sample_id, "CIVIL_P_WAY", "FIELD_SUPERVISOR", "SSE_PWAY_DNR_03", "APPROVED", "9f2c81e997ed25519pwaydnr01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), sample_id, "OPERATING", "SECTION_CONTROLLER", "CTRL_SEC_DNR_02", "PENDING", None, None, None),
        (str(uuid.uuid4()), sample_id, "OPERATING", "STATION_MASTER", "SM_PNBE_01", "APPROVED", "3e1b7194853641ef85smpnbe01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), sample_id, "OHE", "TPC", "TPC_DDU_01", "APPROVED", "1d4ed81e997ed25519tpcddu01", now.isoformat().replace("+00:00", "Z"), None)
    ])

    cursor.execute("""
    INSERT INTO statutory_permits (
        id, event_id, permit_type, earthing_discharged, power_tripped, points_clamped, issued_at, officer_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()),
        sample_id,
        "POINT_CLAMP_MEMO",
        0,
        0,
        1,
        now.isoformat().replace("+00:00", "Z"),
        "SM_PNBE_01",
        "Points padlocked mechanically against Up Main crossover toward Patna Junction"
    ))

    cursor.execute("""
    INSERT INTO transactional_outbox (
        id, event_id, event_type, payload, status
    ) VALUES (?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()),
        sample_id,
        "OPERATIONAL_EVENT_CREATED",
        json.dumps({"event_id": sample_id, "stage": "AWAITING_APPROVAL", "track": "UP_MAIN"}),
        "COMMITTED"
    ))

    # -------------------------------------------------------------
    # Event 2: Danapur–Patna Junction (Stage 6 / Active on Track with Form3-PTW)
    # -------------------------------------------------------------
    event2_id = "EVT-OHE-2026-00301"
    impact2 = {
        "catenary_25kv_power_trip": True,
        "absolute_traffic_block": True,
        "speed_restriction_kmh": 20,
        "feeding_posts": ["FP-04", "FP-06"],
        "points_clamping_required": True,
        "track_bonding_notice": True
    }
    cursor.execute("""
    INSERT INTO operational_events (
        id, division, section, track_id, km_start, km_end, status,
        requested_start, requested_end, fencing_token, impact_vector,
        description, originator_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event2_id,
        "DNR",
        "Danapur–Patna Junction",
        "UP_MAIN",
        544.10,
        545.80,
        "ACTIVE_IN_PROGRESS",
        req_start,
        req_end,
        893,
        json.dumps(impact2),
        "25kV Catenary Contact Wire Replacement & Isolator Maintenance (ACTM 20615)",
        "SSE_OHE_DNR_04",
        now.isoformat().replace("+00:00", "Z"),
        now.isoformat().replace("+00:00", "Z")
    ))

    cursor.executemany("""
    INSERT INTO event_stakeholders (
        id, event_id, department, role, officer_id, approval_status, signature_hash, signed_at, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (str(uuid.uuid4()), event2_id, "OHE", "FIELD_SUPERVISOR", "SSE_OHE_DNR_04", "APPROVED", "sig893sseohednr04", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event2_id, "OHE", "TPC", "TPC_DDU_01", "APPROVED", "sig893tpcddu01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event2_id, "OPERATING", "STATION_MASTER", "SM_PNBE_01", "APPROVED", "sig893smpnbe01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event2_id, "OPERATING", "SECTION_CONTROLLER", "CTRL_SEC_DNR_02", "APPROVED", "sig893ctrldnr02", now.isoformat().replace("+00:00", "Z"), None)
    ])

    cursor.executemany("""
    INSERT INTO statutory_permits (
        id, event_id, permit_type, earthing_discharged, power_tripped, points_clamped, issued_at, officer_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (str(uuid.uuid4()), event2_id, "ETR_1", 0, 1, 0, now.isoformat().replace("+00:00", "Z"), "TPC_DDU_01", "Form ETR-1: 25kV Catenary Power Block Granted"),
        (str(uuid.uuid4()), event2_id, "FORM3_PTW", 1, 0, 0, now.isoformat().replace("+00:00", "Z"), "SSE_OHE_DNR_04", "Form3-PTW: Earth discharge rods attached. Work authorized on track."),
        (str(uuid.uuid4()), event2_id, "POINT_CLAMP_MEMO", 0, 0, 1, now.isoformat().replace("+00:00", "Z"), "SM_PNBE_01", "Points clamped and locked against Up Main at Patna Jn")
    ])

    # -------------------------------------------------------------
    # Event 3: Ara Junction–Danapur (Stage 5 / Approved Block)
    # -------------------------------------------------------------
    event3_id = "EVT-SIG-2026-00214"
    impact3 = {
        "catenary_25kv_power_trip": False,
        "absolute_traffic_block": True,
        "speed_restriction_kmh": 15,
        "feeding_posts": [],
        "points_clamping_required": True,
        "track_bonding_notice": False
    }
    cursor.execute("""
    INSERT INTO operational_events (
        id, division, section, track_id, km_start, km_end, status,
        requested_start, requested_end, fencing_token, impact_vector,
        description, originator_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event3_id,
        "DNR",
        "Ara Junction–Danapur",
        "UP_MAIN",
        590.20,
        591.50,
        "APPROVED",
        req_start,
        req_end,
        894,
        json.dumps(impact3),
        "Electronic Interlocking & Point Machine Overhaul (SWR Sec 8.4)",
        "SSE_SIG_ARA_01",
        now.isoformat().replace("+00:00", "Z"),
        now.isoformat().replace("+00:00", "Z")
    ))

    cursor.executemany("""
    INSERT INTO event_stakeholders (
        id, event_id, department, role, officer_id, approval_status, signature_hash, signed_at, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (str(uuid.uuid4()), event3_id, "S_AND_T", "FIELD_SUPERVISOR", "SSE_SIG_ARA_01", "APPROVED", "sig894ssesigara01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event3_id, "OPERATING", "SECTION_CONTROLLER", "CTRL_SEC_DNR_02", "APPROVED", "sig894ctrldnr02", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event3_id, "OPERATING", "STATION_MASTER", "SM_ARA_01", "APPROVED", "sig894smara01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), event3_id, "OHE", "TPC", "TPC_DDU_01", "APPROVED", "sig894tpcddu01", now.isoformat().replace("+00:00", "Z"), None)
    ])

    cursor.execute("""
    INSERT INTO statutory_permits (
        id, event_id, permit_type, earthing_discharged, power_tripped, points_clamped, issued_at, officer_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()),
        event3_id,
        "POINT_CLAMP_MEMO",
        0,
        0,
        1,
        now.isoformat().replace("+00:00", "Z"),
        "SM_ARA_01",
        "Mechanical point clamp applied and padlocked at Ara Jn"
    ))


# Initialize the database immediately
init_db()
