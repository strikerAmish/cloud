-- ============================================================================
-- RailSync: Real-Time Inter-Departmental Railway Operations Coordination Platform
-- Amazon RDS PostgreSQL 15 Multi-AZ Production DDL Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: operational_events
CREATE TABLE IF NOT EXISTS operational_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division VARCHAR(50) NOT NULL,
    section VARCHAR(100) NOT NULL,
    track_id VARCHAR(50) NOT NULL,
    km_start NUMERIC(8, 3) NOT NULL,
    km_end NUMERIC(8, 3) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    requested_start TIMESTAMP WITH TIME ZONE NOT NULL,
    requested_end TIMESTAMP WITH TIME ZONE NOT NULL,
    fencing_token BIGINT UNIQUE,
    impact_vector JSONB NOT NULL,
    description TEXT NOT NULL,
    originator_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: event_stakeholders
CREATE TABLE IF NOT EXISTS event_stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    officer_id VARCHAR(50) NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    signature_hash VARCHAR(64),
    signed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);

-- Table: statutory_permits
CREATE TABLE IF NOT EXISTS statutory_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
    permit_type VARCHAR(30) NOT NULL, -- ETR_1, ETR_3, RECONNECTION, POINT_CLAMP_MEMO
    earthing_discharged BOOLEAN DEFAULT FALSE,
    power_tripped BOOLEAN DEFAULT FALSE,
    points_clamped BOOLEAN DEFAULT FALSE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    officer_id VARCHAR(50) NOT NULL,
    notes TEXT
);

-- Table: transactional_outbox (Atomic Local Outbox -> Debezium CDC -> Redis Mesh)
CREATE TABLE IF NOT EXISTS transactional_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES operational_events(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMMITTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Sub-10ms Route Queries and Geofence Bounds
CREATE INDEX IF NOT EXISTS idx_operational_events_section ON operational_events(section, track_id);
CREATE INDEX IF NOT EXISTS idx_operational_events_km ON operational_events(km_start, km_end);
CREATE INDEX IF NOT EXISTS idx_operational_events_status ON operational_events(status);
CREATE INDEX IF NOT EXISTS idx_stakeholders_event_id ON event_stakeholders(event_id);
CREATE INDEX IF NOT EXISTS idx_permits_event_id ON statutory_permits(event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON transactional_outbox(status);
