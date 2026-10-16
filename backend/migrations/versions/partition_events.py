"""partition_operational_events_by_division_and_time

Revision ID: a7f8e91c2b3d
Revises: None
Create Date: 2026-10-15 22:30:00.000000

PostgreSQL 15 Declarative Range-List Partitioning Migration for RailSync.
Partitions monolithic `operational_events` table by:
  1. Top-tier: RANGE (created_at) - Quarterly temporal partitioning
  2. Sub-tier: LIST (division) - Indian Railways Administrative Division partitioning
Updates `event_stakeholders` and `statutory_permits` foreign key relationships to match
the partitioned composite primary key (id, division, created_at).
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7f8e91c2b3d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. Create the new partitioned master table
    # -------------------------------------------------------------
    op.execute("""
    CREATE TABLE operational_events_partitioned (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        division VARCHAR(50) NOT NULL,
        section VARCHAR(100) NOT NULL,
        track_id VARCHAR(50) NOT NULL,
        km_start NUMERIC(8, 3) NOT NULL,
        km_end NUMERIC(8, 3) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        requested_start TIMESTAMP WITH TIME ZONE NOT NULL,
        requested_end TIMESTAMP WITH TIME ZONE NOT NULL,
        fencing_token BIGINT,
        impact_vector JSONB NOT NULL,
        description TEXT NOT NULL,
        originator_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_operational_events_partitioned PRIMARY KEY (id, division, created_at)
    ) PARTITION BY RANGE (created_at);
    """)

    # -------------------------------------------------------------
    # 2. Declarative Range Partitions (Quarterly) with Sub-partitioning by LIST (division)
    # -------------------------------------------------------------
    op.execute("""
    -- 2026 Q1
    CREATE TABLE operational_events_2026_q1 PARTITION OF operational_events_partitioned
        FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-04-01 00:00:00+00')
        PARTITION BY LIST (division);

    -- 2026 Q2
    CREATE TABLE operational_events_2026_q2 PARTITION OF operational_events_partitioned
        FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-07-01 00:00:00+00')
        PARTITION BY LIST (division);

    -- 2026 Q3
    CREATE TABLE operational_events_2026_q3 PARTITION OF operational_events_partitioned
        FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-10-01 00:00:00+00')
        PARTITION BY LIST (division);

    -- 2026 Q4 (Active operating quarter)
    CREATE TABLE operational_events_2026_q4 PARTITION OF operational_events_partitioned
        FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00')
        PARTITION BY LIST (division);

    -- Historical and Future Catch-all Overflow
    CREATE TABLE operational_events_overflow PARTITION OF operational_events_partitioned
        DEFAULT PARTITION BY LIST (division);
    """)

    # -------------------------------------------------------------
    # 3. Sub-partitions: List Partitioning by Division (Leaf tables)
    # -------------------------------------------------------------
    op.execute("""
    -- 2026 Q4 Division Partitions
    CREATE TABLE operational_events_2026_q4_ngp PARTITION OF operational_events_2026_q4
        FOR VALUES IN ('NGP', 'CR_NGP');

    CREATE TABLE operational_events_2026_q4_bct PARTITION OF operational_events_2026_q4
        FOR VALUES IN ('BCT', 'WR_BCT', 'MMCT');

    CREATE TABLE operational_events_2026_q4_dli PARTITION OF operational_events_2026_q4
        FOR VALUES IN ('DLI', 'NR_DLI');

    CREATE TABLE operational_events_2026_q4_default PARTITION OF operational_events_2026_q4
        DEFAULT;

    -- Overflow Division Partitions
    CREATE TABLE operational_events_overflow_ngp PARTITION OF operational_events_overflow
        FOR VALUES IN ('NGP', 'CR_NGP');

    CREATE TABLE operational_events_overflow_default PARTITION OF operational_events_overflow
        DEFAULT;
    """)

    # -------------------------------------------------------------
    # 4. Indexes across partitioned trees for Sub-10ms Route Queries
    # -------------------------------------------------------------
    op.execute("""
    CREATE INDEX idx_part_events_section ON operational_events_partitioned(section, track_id);
    CREATE INDEX idx_part_events_km ON operational_events_partitioned(km_start, km_end);
    CREATE INDEX idx_part_events_status ON operational_events_partitioned(status);
    CREATE INDEX idx_part_events_fencing ON operational_events_partitioned(fencing_token) WHERE fencing_token IS NOT NULL;
    """)

    # -------------------------------------------------------------
    # 5. Data Migration from legacy monolithic table (if table exists)
    # -------------------------------------------------------------
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_events') THEN
            -- Backfill legacy records into partitioned structure
            INSERT INTO operational_events_partitioned (
                id, division, section, track_id, km_start, km_end, status,
                requested_start, requested_end, fencing_token, impact_vector,
                description, originator_id, created_at, updated_at
            )
            SELECT
                id, division, section, track_id, km_start, km_end, status,
                requested_start, requested_end, fencing_token, impact_vector,
                description, originator_id, created_at, updated_at
            FROM operational_events
            ON CONFLICT DO NOTHING;
        END IF;
    END $$;
    """)

    # -------------------------------------------------------------
    # 6. Foreign Key Alignment for event_stakeholders & statutory_permits
    # In PostgreSQL declarative partitioning, foreign keys referencing partitioned tables
    # must include all columns of the partitioned primary key.
    # -------------------------------------------------------------
    op.execute("""
    DO $$
    BEGIN
        -- Update event_stakeholders
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_stakeholders') THEN
            ALTER TABLE event_stakeholders 
                ADD COLUMN IF NOT EXISTS event_division VARCHAR(50),
                ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMP WITH TIME ZONE;

            -- Populate backfill columns
            UPDATE event_stakeholders s
            SET event_division = p.division, event_created_at = p.created_at
            FROM operational_events_partitioned p
            WHERE s.event_id = p.id AND (s.event_division IS NULL OR s.event_created_at IS NULL);

            -- Default fallback for any dangling test records
            UPDATE event_stakeholders
            SET event_division = 'NGP', event_created_at = CURRENT_TIMESTAMP
            WHERE event_division IS NULL;

            ALTER TABLE event_stakeholders
                ALTER COLUMN event_division SET NOT NULL,
                ALTER COLUMN event_created_at SET NOT NULL;

            -- Drop old FK if exists
            ALTER TABLE event_stakeholders DROP CONSTRAINT IF EXISTS event_stakeholders_event_id_fkey;

            -- Add partition-aware composite foreign key
            ALTER TABLE event_stakeholders
                ADD CONSTRAINT fk_stakeholder_partitioned_event
                FOREIGN KEY (event_id, event_division, event_created_at)
                REFERENCES operational_events_partitioned(id, division, created_at)
                ON DELETE CASCADE;
        END IF;

        -- Update statutory_permits
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'statutory_permits') THEN
            ALTER TABLE statutory_permits 
                ADD COLUMN IF NOT EXISTS event_division VARCHAR(50),
                ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMP WITH TIME ZONE;

            UPDATE statutory_permits sp
            SET event_division = p.division, event_created_at = p.created_at
            FROM operational_events_partitioned p
            WHERE sp.event_id = p.id AND (sp.event_division IS NULL OR sp.event_created_at IS NULL);

            UPDATE statutory_permits
            SET event_division = 'NGP', event_created_at = CURRENT_TIMESTAMP
            WHERE event_division IS NULL;

            ALTER TABLE statutory_permits
                ALTER COLUMN event_division SET NOT NULL,
                ALTER COLUMN event_created_at SET NOT NULL;

            ALTER TABLE statutory_permits DROP CONSTRAINT IF EXISTS statutory_permits_event_id_fkey;

            ALTER TABLE statutory_permits
                ADD CONSTRAINT fk_permits_partitioned_event
                FOREIGN KEY (event_id, event_division, event_created_at)
                REFERENCES operational_events_partitioned(id, division, created_at)
                ON DELETE CASCADE;
        END IF;
    END $$;
    """)

    # -------------------------------------------------------------
    # 7. Atomic Table Swap
    # -------------------------------------------------------------
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_events') THEN
            ALTER TABLE operational_events RENAME TO operational_events_legacy_monolithic;
            ALTER TABLE operational_events_partitioned RENAME TO operational_events;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    # Rollback partition swap
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'operational_events_legacy_monolithic') THEN
            ALTER TABLE operational_events RENAME TO operational_events_partitioned;
            ALTER TABLE operational_events_legacy_monolithic RENAME TO operational_events;

            -- Revert foreign key constraints back to single id
            ALTER TABLE event_stakeholders DROP CONSTRAINT IF EXISTS fk_stakeholder_partitioned_event;
            ALTER TABLE event_stakeholders ADD CONSTRAINT event_stakeholders_event_id_fkey
                FOREIGN KEY (event_id) REFERENCES operational_events(id) ON DELETE CASCADE;

            ALTER TABLE statutory_permits DROP CONSTRAINT IF EXISTS fk_permits_partitioned_event;
            ALTER TABLE statutory_permits ADD CONSTRAINT statutory_permits_event_id_fkey
                FOREIGN KEY (event_id) REFERENCES operational_events(id) ON DELETE CASCADE;

            DROP TABLE IF EXISTS operational_events_partitioned CASCADE;
        END IF;
    END $$;
    """)
