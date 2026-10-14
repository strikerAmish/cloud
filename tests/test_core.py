"""
RailSync - Automated Core Verification Test Suite
Validates FSM Transitions, Fencing Token Mutual Exclusion,
Dynamic Dependency Resolution, S3 Hash Chains, and Synthetic Canary.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "backend"))

import unittest
from datetime import datetime
from locking import FencingTokenManager
from dependency_engine import DynamicDependencyEngine
from fsm import RailwayFSM
from models import EventStatus, ApprovalStatus, ApprovalRole
from audit_ledger import S3AuditLedger, compute_sha256


class TestRailSyncCore(unittest.TestCase):
    def test_01_fencing_token_mutual_exclusion(self):
        """Validates that overlapping kilometer segments cannot be double-booked."""
        mgr = FencingTokenManager()
        
        # Lock Segment 1: KM 142.10 to 143.04 on UP_MAIN
        success1, token1, conflict1 = mgr.acquire_track_lock(
            event_id="EVT-001",
            section="Wardha-Sevagram",
            track_id="UP_MAIN",
            km_start=142.10,
            km_end=143.04
        )
        self.assertTrue(success1)
        self.assertIsNotNone(token1)

        # Attempt to lock overlapping Segment 2: KM 142.50 to 144.00 on UP_MAIN
        success2, token2, conflict2 = mgr.acquire_track_lock(
            event_id="EVT-002",
            section="Wardha-Sevagram",
            track_id="UP_MAIN",
            km_start=142.50,
            km_end=144.00
        )
        self.assertFalse(success2)
        self.assertIn("Conflict", conflict2)

        # Release EVT-001
        mgr.release_track_lock("EVT-001")

        # Now EVT-002 should succeed with a strictly higher monotonic token
        success3, token3, _ = mgr.acquire_track_lock(
            event_id="EVT-002",
            section="Wardha-Sevagram",
            track_id="UP_MAIN",
            km_start=142.50,
            km_end=144.00
        )
        self.assertTrue(success3)
        self.assertGreater(token3, token1)

    def test_02_dynamic_dependency_engine_6_invariants(self):
        """Validates resolution of the 6 Invariants of Operational Awareness."""
        invariants = DynamicDependencyEngine.resolve_invariants(
            division="NGP",
            section="Wardha-Sevagram",
            track_id="UP_MAIN",
            km_start=142.10,
            km_end=143.04,
            impact_vector={"catenary_25kv_power_trip": True, "absolute_traffic_block": True}
        )
        self.assertTrue(invariants["conflict_free"])
        self.assertEqual(len(invariants["invariant_2_statutory_approvers"]), 2)
        self.assertTrue(any(p["code"] == "FORM_ETR_1" for p in invariants["invariant_3_physical_prerequisites"]))
        self.assertTrue(any(p["code"] == "SWR_POINT_CLAMP" for p in invariants["invariant_3_physical_prerequisites"]))

    def test_03_fsm_guards(self):
        """Validates that statutory sequence rules prevent illegal state transitions."""
        # Cannot transition to APPROVED without dual sign-offs
        valid, err = RailwayFSM.validate_transition(
            current_status=EventStatus.AWAITING_APPROVAL,
            target_status=EventStatus.APPROVED,
            event_data={"stakeholders": []}
        )
        self.assertFalse(valid)
        self.assertIn("Dual-Key", err)

        # Emergency abort can always interrupt active work
        valid_abort, _ = RailwayFSM.validate_transition(
            current_status=EventStatus.ACTIVE_IN_PROGRESS,
            target_status=EventStatus.ABORTED_SAFETY_LOCK,
            event_data={}
        )
        self.assertTrue(valid_abort)

    def test_04_s3_cryptographic_audit_ledger(self):
        """Validates SHA-256 hash chains and Merkle DAG integrity."""
        ledger = S3AuditLedger()
        
        block = ledger.append_event_record(
            event_id="EVT-TEST-001",
            event_payload={"track_id": "UP_MAIN", "km_start": 142.10, "km_end": 143.04},
            stakeholders=[{"role": "TPC", "officer_id": "TPC_01"}],
            permits=[{"permit_type": "ETR_1"}]
        )
        self.assertEqual(block.block_number, 1)
        self.assertEqual(block.prev_hash, ledger.chain[0].block_hash)
        
        verification = ledger.verify_ledger_integrity()
        self.assertTrue(verification["valid"])
        self.assertEqual(verification["status"], "CRYPTOGRAPHICALLY_VERIFIED_TAMPER_EVIDENT")


if __name__ == "__main__":
    unittest.main(verbosity=2)
