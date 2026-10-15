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

    # Seed baseline event if database is empty
    cursor.execute("SELECT COUNT(*) as cnt FROM operational_events")
    count = cursor.fetchone()["cnt"]

    if count == 0:
        seed_baseline_event(cursor)
        conn.commit()

    conn.close()


def seed_baseline_event(cursor):
    sample_id = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
    now = datetime.now(timezone.utc)
    req_start = (now + timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    req_end = (now + timedelta(hours=4)).isoformat().replace("+00:00", "Z")

    impact_vector = {
        "catenary_25kv_power_trip": True,
        "absolute_traffic_block": True,
        "speed_restriction_kmh": 30,
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
        sample_id,
        "NGP",
        "Wardha-Sevagram",
        "UP_MAIN",
        142.10,
        143.04,
        "AWAITING_APPROVAL",
        req_start,
        req_end,
        892,
        json.dumps(impact_vector),
        "OHE Catenary Inspection & Contact Wire Replacement (ACTM Vol II Sec 20615)",
        "SSE_OHE_WDA_04",
        now.isoformat().replace("+00:00", "Z"),
        now.isoformat().replace("+00:00", "Z")
    ))

    # Seed Stakeholders
    stakeholders = [
        (str(uuid.uuid4()), sample_id, "OHE", "TPC", "TPC_NGP_01", "APPROVED", "8f3ca9b12a4d81e997ed25519tpcngp01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), sample_id, "OPERATING", "SECTION_CONTROLLER", "CTRL_SEC_WDA_02", "PENDING", None, None, None),
        (str(uuid.uuid4()), sample_id, "OPERATING", "STATION_MASTER", "SM_WDA_JCT", "APPROVED", "b12a4d81e997ed25519smwardha01", now.isoformat().replace("+00:00", "Z"), None),
        (str(uuid.uuid4()), sample_id, "OHE", "FIELD_SUPERVISOR", "SSE_OHE_WDA_04", "PENDING", None, None, None)
    ]
    cursor.executemany("""
    INSERT INTO event_stakeholders (
        id, event_id, department, role, officer_id, approval_status, signature_hash, signed_at, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, stakeholders)

    # Seed Permits
    cursor.execute("""
    INSERT INTO statutory_permits (
        id, event_id, permit_type, earthing_discharged, power_tripped, points_clamped, issued_at, officer_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(uuid.uuid4()),
        sample_id,
        "ETR_1",
        0,
        1,
        1,
        now.isoformat().replace("+00:00", "Z"),
        "TPC_NGP_01",
        "25kV Catenary Power Block Granted from Feeding Post FP-04 to FP-06"
    ))

    # Seed Transactional Outbox entry
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


# Initialize the database immediately
init_db()
