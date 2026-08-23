import json
import pytest
from conftest import mock_evaluation_journey


@pytest.fixture
def cohort_with_4_facilities(deployed_board, direct_vm, operator_address, valid_incident_params, valid_facility_factory):
    direct_vm.sender = operator_address
    # Create incident with slot_count = 2
    deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        valid_incident_params["region_label"],
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        2,  # slot_count = 2
        valid_incident_params["assignment_timeout_seconds"],
        valid_incident_params["policy_text"],
        valid_incident_params["policy_version"],
    )

    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")
    f4 = valid_facility_factory(4, use_class="WAREHOUSE", occupancy_band="LOW")

    for f in [f1, f2, f3, f4]:
        deployed_board.register_facility(
            1,
            f["facility_id"],
            f["location_bucket"],
            f["use_class"],
            f["age_band"],
            f["occupancy_band"],
            f["evidence_url"],
            f["expected_evidence_digest"],
        )

    deployed_board.lock_cohort(1)
    return deployed_board


def test_finalize_allocation_success(cohort_with_4_facilities, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 13: Finalizing allocation deterministically sorts and assigns slots and waitlist positions."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")
    f4 = valid_facility_factory(4, use_class="WAREHOUSE", occupancy_band="LOW")

    # Evaluate f1 -> IMMEDIATE_REVIEW (95)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=95,
        eligible=True,
    )
    cohort_with_4_facilities.evaluate_facility(1, 1)

    # Evaluate f2 -> PRIORITY_QUEUE (75)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f2["evidence_url"],
        facility_body=f2["evidence_body"],
        decision="PRIORITY_QUEUE",
        priority_score=75,
        eligible=True,
    )
    cohort_with_4_facilities.evaluate_facility(1, 2)

    # Evaluate f3 -> MONITOR (45)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f3["evidence_url"],
        facility_body=f3["evidence_body"],
        decision="MONITOR",
        priority_score=45,
        eligible=True,
    )
    cohort_with_4_facilities.evaluate_facility(1, 3)

    # Evaluate f4 -> OUT_OF_SCOPE (10)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f4["evidence_url"],
        facility_body=f4["evidence_body"],
        decision="OUT_OF_SCOPE",
        priority_score=10,
        eligible=False,
    )
    cohort_with_4_facilities.evaluate_facility(1, 4)

    # Finalize allocation
    cohort_with_4_facilities.finalize_allocation(1)

    inc = json.loads(cohort_with_4_facilities.get_incident(1))
    assert inc["status"] == "ALLOCATED"
    assert inc["allocated_count"] == 2

    # Verify queue (slot_count=2, so top 2 eligible facilities)
    queue_data = json.loads(cohort_with_4_facilities.get_queue(1, 0, 10))
    assert queue_data["total_queue_count"] == 2
    assert queue_data["queue"][0]["facility_id"] == "FAC-001"
    assert queue_data["queue"][0]["queue_position"] == 1
    assert queue_data["queue"][0]["decision"] == "IMMEDIATE_REVIEW"
    assert queue_data["queue"][1]["facility_id"] == "FAC-002"
    assert queue_data["queue"][1]["queue_position"] == 2
    assert queue_data["queue"][1]["decision"] == "PRIORITY_QUEUE"

    # Verify waitlist (f3 is 3rd eligible)
    waitlist_data = json.loads(cohort_with_4_facilities.get_waitlist(1, 0, 10))
    assert waitlist_data["total_waitlist_count"] == 1
    assert waitlist_data["waitlist"][0]["facility_id"] == "FAC-003"
    assert waitlist_data["waitlist"][0]["waitlist_position"] == 1

    # Verify f4 has queue_position=0, waitlist_position=0
    f4_data = json.loads(cohort_with_4_facilities.get_facility(1, 4))
    assert f4_data["queue_position"] == 0
    assert f4_data["waitlist_position"] == 0


def test_finalize_allocation_oversubscription_and_tie_breaking(
    cohort_with_4_facilities, direct_vm, valid_incident_params, valid_facility_factory
):
    """Test 13: Oversubscribed cohort with identical score breaks ties using alphanumeric facility ID."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")
    f4 = valid_facility_factory(4, use_class="WAREHOUSE", occupancy_band="LOW")

    # All 4 facilities evaluate to IMMEDIATE_REVIEW with identical score of 90
    for idx, fac in enumerate([f1, f2, f3, f4], start=1):
        mock_evaluation_journey(
            direct_vm,
            event_url=valid_incident_params["event_url"],
            event_body=valid_incident_params["event_body"],
            facility_url=fac["evidence_url"],
            facility_body=fac["evidence_body"],
            decision="IMMEDIATE_REVIEW",
            priority_score=90,
            eligible=True,
        )
        cohort_with_4_facilities.evaluate_facility(1, idx)

    cohort_with_4_facilities.finalize_allocation(1)

    queue_data = json.loads(cohort_with_4_facilities.get_queue(1, 0, 10))
    assert queue_data["total_queue_count"] == 2
    # Tie-breaking by facility_id ascending: FAC-001, FAC-002
    assert queue_data["queue"][0]["facility_id"] == "FAC-001"
    assert queue_data["queue"][0]["queue_position"] == 1
    assert queue_data["queue"][1]["facility_id"] == "FAC-002"
    assert queue_data["queue"][1]["queue_position"] == 2

    waitlist_data = json.loads(cohort_with_4_facilities.get_waitlist(1, 0, 10))
    assert waitlist_data["total_waitlist_count"] == 2
    # Waitlist ordered: FAC-003, FAC-004
    assert waitlist_data["waitlist"][0]["facility_id"] == "FAC-003"
    assert waitlist_data["waitlist"][0]["waitlist_position"] == 1
    assert waitlist_data["waitlist"][1]["facility_id"] == "FAC-004"
    assert waitlist_data["waitlist"][1]["waitlist_position"] == 2


def test_finalize_allocation_pending_facility_rejected(
    cohort_with_4_facilities, direct_vm, valid_incident_params, valid_facility_factory
):
    """Test 13: Rejects finalize allocation if any facility is pending evaluation."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=90,
        eligible=True,
    )
    cohort_with_4_facilities.evaluate_facility(1, 1)

    # Facilities 2, 3, 4 remain LOCKED
    with direct_vm.expect_revert("cannot finalize allocation: facility 2 is pending evaluation"):
        cohort_with_4_facilities.finalize_allocation(1)


def test_finalize_allocation_retry_exhausted_allowed(
    cohort_with_4_facilities, direct_vm, valid_incident_params, valid_facility_factory
):
    """Test 13: Allows finalize allocation when unresolved facility has exhausted retries (terminal)."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")
    f4 = valid_facility_factory(4, use_class="WAREHOUSE", occupancy_band="LOW")

    # Evaluate f1, f2, f3 successfully with valid score-band pairings
    for idx, (fac, score) in enumerate([(f1, 95), (f2, 90), (f3, 85)], start=1):
        mock_evaluation_journey(
            direct_vm,
            event_url=valid_incident_params["event_url"],
            event_body=valid_incident_params["event_body"],
            facility_url=fac["evidence_url"],
            facility_body=fac["evidence_body"],
            decision="IMMEDIATE_REVIEW",
            priority_score=score,
            eligible=True,
        )
        cohort_with_4_facilities.evaluate_facility(1, idx)

    # Facility 4 fails twice -> UNRESOLVED with attempts=2 (exhausted)
    direct_vm._web_mocks.clear()
    direct_vm.mock_web(f4["evidence_url"], {"body": f4["evidence_body"]})  # event is unmocked
    cohort_with_4_facilities.evaluate_facility(1, 4)  # attempt 1
    cohort_with_4_facilities.evaluate_facility(1, 4)  # attempt 2

    # Now all facilities are terminal, finalize succeeds
    cohort_with_4_facilities.finalize_allocation(1)

    inc = json.loads(cohort_with_4_facilities.get_incident(1))
    assert inc["status"] == "ALLOCATED"


def test_finalize_allocation_wrong_phase(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 13: Rejects finalize allocation when incident is in DRAFT phase."""
    direct_vm.sender = operator_address
    deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        valid_incident_params["region_label"],
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        2,
        valid_incident_params["assignment_timeout_seconds"],
        valid_incident_params["policy_text"],
        valid_incident_params["policy_version"],
    )

    with direct_vm.expect_revert("incident is not in evaluation phase"):
        deployed_board.finalize_allocation(1)
