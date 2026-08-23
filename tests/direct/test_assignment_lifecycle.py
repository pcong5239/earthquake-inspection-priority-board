import json
import sys
from contextlib import contextmanager
import pytest
from conftest import mock_evaluation_journey, to_hex_addr


@contextmanager
def mock_contract_time(board, timestamp: int):
    mod = sys.modules[type(board).__module__]
    orig = mod.EarthquakeInspectionPriorityBoard._get_current_time
    mod.EarthquakeInspectionPriorityBoard._get_current_time = lambda self: mod.u64(timestamp)
    try:
        yield
    finally:
        mod.EarthquakeInspectionPriorityBoard._get_current_time = orig


@pytest.fixture
def allocated_incident_board(deployed_board, direct_vm, operator_address, valid_incident_params, valid_facility_factory):
    direct_vm.sender = operator_address

    # Create incident with slot_count = 2, assignment_timeout_seconds = 3600
    deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        valid_incident_params["region_label"],
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        2,  # slot_count = 2
        3600,  # assignment_timeout_seconds = 3600
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

    # Evaluate f1 -> 95, f2 -> 75, f3 -> 45, f4 -> 30 (all 4 eligible, so f1/f2 get slots, f3/f4 waitlisted)
    for idx, (fac, score, dec) in enumerate(
        [
            (f1, 95, "IMMEDIATE_REVIEW"),
            (f2, 75, "PRIORITY_QUEUE"),
            (f3, 45, "MONITOR"),
            (f4, 30, "MONITOR"),
        ],
        start=1,
    ):
        mock_evaluation_journey(
            direct_vm,
            event_url=valid_incident_params["event_url"],
            event_body=valid_incident_params["event_body"],
            facility_url=fac["evidence_url"],
            facility_body=fac["evidence_body"],
            decision=dec,
            priority_score=score,
            eligible=True,
        )
        deployed_board.evaluate_facility(1, idx)

    deployed_board.finalize_allocation(1)
    return deployed_board


def test_offer_assignment_success(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Test 14: Operator successfully offers assignment to an eligible queued facility."""
    direct_vm.sender = operator_address

    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    fac1 = json.loads(allocated_incident_board.get_facility(1, 1))
    assert fac1["assignment_status"] == "OFFERED"
    assert to_hex_addr(fac1["assigned_inspector"]) == to_hex_addr(inspector_alice)
    assert fac1["offered_at"] > 0
    assert fac1["assignment_deadline"] == fac1["offered_at"] + 3600
    assert fac1["acknowledged_at"] == 0

    # Verify history event
    hist_data = json.loads(allocated_incident_board.get_history(1, 0, 100))
    offer_event = [h for h in hist_data["history"] if h["event_type"] == "ASSIGNMENT_OFFERED"][0]
    assert offer_event["facility_record_id"] == 1
    assert to_hex_addr(offer_event["actor"]) == to_hex_addr(operator_address)
    assert to_hex_addr(offer_event["details"]["inspector"]) == to_hex_addr(inspector_alice)
    assert offer_event["details"]["queue_position"] == 1


def test_offer_assignment_unauthorized(allocated_incident_board, direct_vm, unauthorized_user, inspector_alice):
    """Test 14: Non-operator caller cannot offer assignment."""
    direct_vm.sender = unauthorized_user

    with direct_vm.expect_revert("unauthorized: caller is not operator"):
        allocated_incident_board.offer_assignment(1, 1, inspector_alice)


def test_offer_assignment_not_in_queue_rejected(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Test 14: Offering assignment to a facility not in the active allocation queue is rejected."""
    direct_vm.sender = operator_address

    # Facility 3 is waitlisted (queue_position == 0)
    with direct_vm.expect_revert("facility is not currently allocated in the inspection queue"):
        allocated_incident_board.offer_assignment(1, 3, inspector_alice)


def test_offer_assignment_duplicate_on_facility_rejected(allocated_incident_board, direct_vm, operator_address, inspector_alice, inspector_bob):
    """Test 14: Offering assignment to an already OFFERED facility is rejected."""
    direct_vm.sender = operator_address

    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    with direct_vm.expect_revert("facility assignment already in state 'OFFERED'"):
        allocated_incident_board.offer_assignment(1, 1, inspector_bob)


def test_offer_assignment_inspector_already_holds_offer(allocated_incident_board, direct_vm, operator_address, inspector_alice, inspector_bob):
    """Test 14: Inspector cannot hold multiple concurrent active offers in the same incident."""
    direct_vm.sender = operator_address

    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Attempting to assign second slot to Alice fails
    with direct_vm.expect_revert("inspector already holds an active offer in this incident"):
        allocated_incident_board.offer_assignment(1, 2, inspector_alice)

    # But offering second slot to Bob succeeds
    allocated_incident_board.offer_assignment(1, 2, inspector_bob)
    fac2 = json.loads(allocated_incident_board.get_facility(1, 2))
    assert fac2["assignment_status"] == "OFFERED"
    assert to_hex_addr(fac2["assigned_inspector"]) == to_hex_addr(inspector_bob)


def test_offer_assignment_zero_address_rejected(allocated_incident_board, direct_vm, operator_address):
    """Test 14: Offering assignment to zero address is rejected."""
    direct_vm.sender = operator_address
    zero_addr = b"\x00" * 20

    with direct_vm.expect_revert("invalid inspector address: zero address forbidden"):
        allocated_incident_board.offer_assignment(1, 1, zero_addr)


def test_acknowledge_assignment_success(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Test 15: Assigned inspector successfully acknowledges the assignment before deadline."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Alice acknowledges
    direct_vm.sender = inspector_alice
    allocated_incident_board.acknowledge_assignment(1, 1)

    fac1 = json.loads(allocated_incident_board.get_facility(1, 1))
    assert fac1["assignment_status"] == "ACKNOWLEDGED"
    assert fac1["acknowledged_at"] > 0

    # History verification
    hist_data = json.loads(allocated_incident_board.get_history(1, 0, 100))
    ack_event = [h for h in hist_data["history"] if h["event_type"] == "ASSIGNMENT_ACKNOWLEDGED"][0]
    assert ack_event["facility_record_id"] == 1
    assert to_hex_addr(ack_event["actor"]) == to_hex_addr(inspector_alice)
    assert to_hex_addr(ack_event["details"]["inspector"]) == to_hex_addr(inspector_alice)


def test_acknowledge_assignment_unauthorized_caller(allocated_incident_board, direct_vm, operator_address, inspector_alice, inspector_bob):
    """Test 15: Non-assigned inspector cannot acknowledge the offer."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Bob attempts to acknowledge Alice's assignment
    direct_vm.sender = inspector_bob
    with direct_vm.expect_revert("unauthorized: caller is not the assigned inspector"):
        allocated_incident_board.acknowledge_assignment(1, 1)


def test_acknowledge_assignment_replay_rejected(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Test 15: Acknowledging an already acknowledged assignment is rejected."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    direct_vm.sender = inspector_alice
    allocated_incident_board.acknowledge_assignment(1, 1)

    with direct_vm.expect_revert("facility has no active offer to acknowledge"):
        allocated_incident_board.acknowledge_assignment(1, 1)


def test_deadline_boundaries_before_at_after(
    allocated_incident_board, direct_vm, operator_address, inspector_alice, unauthorized_user
):
    """Correction 6: Proves deadline comparisons at before, exactly at, and after the transaction timestamp boundary.

    Locked rule:
    - Acknowledgement at exactly the deadline is allowed (now == deadline)
    - Reclaim at exactly the deadline is NOT allowed (now == deadline)
    - After deadline (now > deadline), acknowledgement fails and reclaim succeeds
    - Before deadline (now < deadline), acknowledgement succeeds and reclaim fails
    """
    direct_vm.sender = operator_address
    now_ts = 1787455000

    # 1. Offer assignment at now_ts (timeout = 3600s -> deadline = now_ts + 3600)
    with mock_contract_time(allocated_incident_board, now_ts):
        allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    fac1 = json.loads(allocated_incident_board.get_facility(1, 1))
    deadline = fac1["assignment_deadline"]
    assert deadline == now_ts + 3600

    # Case A: Before deadline (now < deadline)
    # Reclaim fails
    direct_vm.sender = unauthorized_user
    with mock_contract_time(allocated_incident_board, deadline - 1):
        with direct_vm.expect_revert("assignment offer has not expired yet"):
            allocated_incident_board.reclaim_expired_assignment(1, 1)

    # Case B: Exactly at deadline (now == deadline)
    # Reclaim at exactly deadline is NOT allowed
    with mock_contract_time(allocated_incident_board, deadline):
        with direct_vm.expect_revert("assignment offer has not expired yet"):
            allocated_incident_board.reclaim_expired_assignment(1, 1)

    # Acknowledgement at exactly deadline IS allowed
    direct_vm.sender = inspector_alice
    with mock_contract_time(allocated_incident_board, deadline):
        allocated_incident_board.acknowledge_assignment(1, 1)

    fac1_after_ack = json.loads(allocated_incident_board.get_facility(1, 1))
    assert fac1_after_ack["assignment_status"] == "ACKNOWLEDGED"

    # Case C: After deadline (now > deadline) tested on slot 2
    direct_vm.sender = operator_address
    with mock_contract_time(allocated_incident_board, now_ts):
        allocated_incident_board.offer_assignment(1, 2, inspector_alice)

    fac2 = json.loads(allocated_incident_board.get_facility(1, 2))
    deadline_2 = fac2["assignment_deadline"]

    # After deadline (now == deadline_2 + 1):
    # Acknowledge fails
    direct_vm.sender = inspector_alice
    with mock_contract_time(allocated_incident_board, deadline_2 + 1):
        with direct_vm.expect_revert("assignment offer has expired and cannot be acknowledged"):
            allocated_incident_board.acknowledge_assignment(1, 2)

    # Reclaim succeeds
    direct_vm.sender = unauthorized_user
    with mock_contract_time(allocated_incident_board, deadline_2 + 1):
        allocated_incident_board.reclaim_expired_assignment(1, 2)

    fac2_after_reclaim = json.loads(allocated_incident_board.get_facility(1, 2))
    assert fac2_after_reclaim["assignment_status"] == "EXPIRED"


def test_reclaim_expired_assignment_and_waitlist_promotion(
    allocated_incident_board, direct_vm, operator_address, inspector_alice, unauthorized_user
):
    """Test 16: Expired assignment is reclaimed and exactly-once promotes waitlist position 1."""
    direct_vm.sender = operator_address
    now_ts = 1787455000

    with mock_contract_time(allocated_incident_board, now_ts):
        allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Fast forward past deadline
    expired_ts = now_ts + 3601

    # Anyone (e.g. unauthorized_user / public keeper) can trigger reclaim
    direct_vm.sender = unauthorized_user

    with mock_contract_time(allocated_incident_board, expired_ts):
        allocated_incident_board.reclaim_expired_assignment(1, 1)

    # 1. Facility 1 is now EXPIRED and queue_position is 0
    fac1 = json.loads(allocated_incident_board.get_facility(1, 1))
    assert fac1["assignment_status"] == "EXPIRED"
    assert fac1["queue_position"] == 0

    # 2. Facility 3 (previously waitlist_position 1) is PROMOTED to slot 1
    fac3 = json.loads(allocated_incident_board.get_facility(1, 3))
    assert fac3["queue_position"] == 1
    assert fac3["waitlist_position"] == 0
    assert fac3["assignment_status"] == "NONE"

    # 3. Facility 4 (previously waitlist_position 2) is shifted down to waitlist_position 1
    fac4 = json.loads(allocated_incident_board.get_facility(1, 4))
    assert fac4["waitlist_position"] == 1

    # 4. History contains ASSIGNMENT_EXPIRED and WAITLIST_PROMOTED
    hist_data = json.loads(allocated_incident_board.get_history(1, 0, 100))
    hist_types = [h["event_type"] for h in hist_data["history"]]
    assert "ASSIGNMENT_EXPIRED" in hist_types
    assert "WAITLIST_PROMOTED" in hist_types

    promoted_event = [h for h in hist_data["history"] if h["event_type"] == "WAITLIST_PROMOTED"][0]
    assert promoted_event["facility_record_id"] == 3
    assert promoted_event["details"]["promoted_to_slot"] == 1
    assert promoted_event["details"]["facility_id"] == "FAC-003"


def test_reclaim_before_expiration_rejected(allocated_incident_board, direct_vm, operator_address, inspector_alice, unauthorized_user):
    """Test 16: Reclaiming an assignment before its deadline is rejected."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    direct_vm.sender = unauthorized_user
    with direct_vm.expect_revert("assignment offer has not expired yet"):
        allocated_incident_board.reclaim_expired_assignment(1, 1)


def test_reclaim_no_active_offer_rejected(allocated_incident_board, direct_vm, unauthorized_user):
    """Test 16: Reclaiming a facility with no active offer is rejected."""
    direct_vm.sender = unauthorized_user

    # Facility 2 has assignment_status == 'NONE'
    with direct_vm.expect_revert("facility does not have an active offer to reclaim"):
        allocated_incident_board.reclaim_expired_assignment(1, 2)


def test_close_incident_success(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Correction 3: Operator successfully closes incident in ALLOCATED phase without pending offers."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Acknowledge the offer so assignment_status is terminal (ACKNOWLEDGED)
    direct_vm.sender = inspector_alice
    allocated_incident_board.acknowledge_assignment(1, 1)

    # Operator closes incident
    direct_vm.sender = operator_address
    allocated_incident_board.close_incident(1)

    inc = json.loads(allocated_incident_board.get_incident(1))
    assert inc["status"] == "CLOSED"

    # get_active_incidents no longer includes 1
    active_incidents = json.loads(allocated_incident_board.get_active_incidents())
    assert 1 not in active_incidents

    # History record emitted
    hist_data = json.loads(allocated_incident_board.get_history(1, 0, 100))
    close_event = [h for h in hist_data["history"] if h["event_type"] == "INCIDENT_CLOSED"][0]
    assert close_event["facility_record_id"] == 0
    assert to_hex_addr(close_event["actor"]) == to_hex_addr(operator_address)
    assert close_event["details"]["event_id"] == inc["event_id"]
    assert close_event["details"]["closed_at"] > 0


def test_close_incident_unauthorized(allocated_incident_board, direct_vm, unauthorized_user):
    """Correction 3: Non-operator caller cannot close incident."""
    direct_vm.sender = unauthorized_user

    with direct_vm.expect_revert("unauthorized: caller is not operator"):
        allocated_incident_board.close_incident(1)


def test_close_incident_wrong_phase_rejected(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Correction 3: Closing an incident not in ALLOCATED phase (e.g. DRAFT) is rejected."""
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

    with direct_vm.expect_revert("incident is not in ALLOCATED phase"):
        deployed_board.close_incident(1)


def test_close_incident_active_offer_pending_blocked(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Correction 3: Cannot close incident while any facility has an active OFFERED assignment."""
    direct_vm.sender = operator_address
    allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Try closing while offer is pending
    with direct_vm.expect_revert("cannot close incident while active assignment offers are pending"):
        allocated_incident_board.close_incident(1)


def test_close_incident_replay_rejected(allocated_incident_board, direct_vm, operator_address):
    """Correction 3: Closing an already closed incident is rejected."""
    direct_vm.sender = operator_address
    allocated_incident_board.close_incident(1)

    with direct_vm.expect_revert("incident is already CLOSED"):
        allocated_incident_board.close_incident(1)


def test_append_history_fail_closed_at_capacity(allocated_incident_board, direct_vm, operator_address, inspector_alice):
    """Correction 4: History capacity limit (192 entries) fails closed and reverts without mutating business state."""
    direct_vm.sender = operator_address

    # Simulate incident history_count reaching MAX_HISTORY_PER_INCIDENT (192)
    mod = sys.modules[type(allocated_incident_board).__module__]
    inc = allocated_incident_board.incidents[1]
    inc.history_count = mod.u32(192)
    allocated_incident_board.incidents[1] = inc

    # Attempting offer_assignment fails-closed
    with direct_vm.expect_revert("incident history capacity reached (max 192 entries)"):
        allocated_incident_board.offer_assignment(1, 1, inspector_alice)

    # Verify facility 1 assignment status remained NONE (unmutated)
    fac1 = json.loads(allocated_incident_board.get_facility(1, 1))
    assert fac1["assignment_status"] == "NONE"


def test_public_views_and_history_provenance(allocated_incident_board, operator_address):
    """Test 17 & 18: Public views, pagination, and history provenance."""
    # 1. get_contract_info & get_caps
    info = json.loads(allocated_incident_board.get_contract_info())
    assert info["version"] == 1
    assert info["incident_count"] == 1
    assert to_hex_addr(info["operator"]) == to_hex_addr(operator_address)

    caps = json.loads(allocated_incident_board.get_caps())
    assert caps["max_incidents"] == 16
    assert caps["max_facilities_per_incident"] == 24
    assert caps["max_history_per_incident"] == 192
    assert caps["score_bands"]["IMMEDIATE_REVIEW"] == [80, 100]

    # 2. get_active_incidents
    active = json.loads(allocated_incident_board.get_active_incidents())
    assert active == [1]

    # 3. get_facilities pagination
    paged_facs_1 = json.loads(allocated_incident_board.get_facilities(1, 0, 2))
    assert paged_facs_1["total_count"] == 4
    assert len(paged_facs_1["facilities"]) == 2
    assert paged_facs_1["facilities"][0]["facility_id"] == "FAC-001"
    assert paged_facs_1["facilities"][1]["facility_id"] == "FAC-002"

    paged_facs_2 = json.loads(allocated_incident_board.get_facilities(1, 2, 2))
    assert len(paged_facs_2["facilities"]) == 2
    assert paged_facs_2["facilities"][0]["facility_id"] == "FAC-003"
    assert paged_facs_2["facilities"][1]["facility_id"] == "FAC-004"

    # 4. get_queue pagination
    queue = json.loads(allocated_incident_board.get_queue(1, 0, 10))
    assert queue["total_queue_count"] == 2
    assert len(queue["queue"]) == 2
    assert queue["queue"][0]["queue_position"] == 1
    assert queue["queue"][1]["queue_position"] == 2

    # 5. get_waitlist pagination
    waitlist = json.loads(allocated_incident_board.get_waitlist(1, 0, 10))
    assert waitlist["total_waitlist_count"] == 2
    assert len(waitlist["waitlist"]) == 2
    assert waitlist["waitlist"][0]["waitlist_position"] == 1
    assert waitlist["waitlist"][1]["waitlist_position"] == 2

    # 6. get_history pagination and provenance
    total_hist_count = allocated_incident_board.get_history_count(1)
    assert total_hist_count >= 6  # CREATED + 4 REGISTERED + LOCKED + 4 EVALUATED + ALLOCATED

    hist_p1 = json.loads(allocated_incident_board.get_history(1, 0, 3))
    assert hist_p1["total_history_count"] == total_hist_count
    assert len(hist_p1["history"]) == 3
    assert hist_p1["history"][0]["sequence"] == 1
    assert hist_p1["history"][0]["event_type"] == "INCIDENT_CREATED"
    assert hist_p1["history"][1]["sequence"] == 2
    assert hist_p1["history"][1]["event_type"] == "FACILITY_REGISTERED"
