import json
import pytest


@pytest.fixture
def created_incident_board(deployed_board, direct_vm, operator_address, valid_incident_params):
    direct_vm.sender = operator_address
    deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        valid_incident_params["region_label"],
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        valid_incident_params["slot_count"],
        valid_incident_params["assignment_timeout_seconds"],
        valid_incident_params["policy_text"],
        valid_incident_params["policy_version"],
    )
    return deployed_board


def test_register_facility_success(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 4: Registering valid facilities updates count, stores records, and emits history."""
    direct_vm.sender = operator_address
    f1 = valid_facility_factory(1)
    f2 = valid_facility_factory(2)

    rec1 = created_incident_board.register_facility(
        1,
        f1["facility_id"],
        f1["location_bucket"],
        f1["use_class"],
        f1["age_band"],
        f1["occupancy_band"],
        f1["evidence_url"],
        f1["expected_evidence_digest"],
    )
    assert rec1 == 1

    rec2 = created_incident_board.register_facility(
        1,
        f2["facility_id"],
        f2["location_bucket"],
        f2["use_class"],
        f2["age_band"],
        f2["occupancy_band"],
        f2["evidence_url"],
        f2["expected_evidence_digest"],
    )
    assert rec2 == 2

    assert created_incident_board.get_facility_count(1) == 2

    fac1_json = created_incident_board.get_facility(1, 1)
    fac1 = json.loads(fac1_json)
    assert fac1["record_id"] == 1
    assert fac1["facility_id"] == f1["facility_id"]
    assert fac1["location_bucket"] == f1["location_bucket"]
    assert fac1["status"] == "REGISTERED"
    assert fac1["decision"] == "NONE"
    assert fac1["priority_score"] == 0
    assert fac1["eligible"] is False

    facs_json = created_incident_board.get_facilities(1, 0, 10)
    facs = json.loads(facs_json)
    assert facs["total_count"] == 2
    assert len(facs["facilities"]) == 2
    assert facs["facilities"][0]["facility_id"] == f1["facility_id"]
    assert facs["facilities"][1]["facility_id"] == f2["facility_id"]


def test_register_facility_unauthorized(created_incident_board, direct_vm, unauthorized_user, valid_facility_factory):
    """Test 4: Non-operator cannot register facility."""
    direct_vm.sender = unauthorized_user
    f = valid_facility_factory(1)

    with direct_vm.expect_revert("unauthorized: caller is not operator"):
        created_incident_board.register_facility(
            1,
            f["facility_id"],
            f["location_bucket"],
            f["use_class"],
            f["age_band"],
            f["occupancy_band"],
            f["evidence_url"],
            f["expected_evidence_digest"],
        )


def test_register_facility_duplicate_facility_id(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 4: Rejects duplicate facility ID in the same incident."""
    direct_vm.sender = operator_address
    f1 = valid_facility_factory(1)
    f1_dup = valid_facility_factory(1)
    f1_dup["expected_evidence_digest"] = "1" * 64

    created_incident_board.register_facility(
        1,
        f1["facility_id"],
        f1["location_bucket"],
        f1["use_class"],
        f1["age_band"],
        f1["occupancy_band"],
        f1["evidence_url"],
        f1["expected_evidence_digest"],
    )

    with direct_vm.expect_revert("duplicate facility ID in incident"):
        created_incident_board.register_facility(
            1,
            f1_dup["facility_id"],
            f1_dup["location_bucket"],
            f1_dup["use_class"],
            f1_dup["age_band"],
            f1_dup["occupancy_band"],
            f1_dup["evidence_url"],
            f1_dup["expected_evidence_digest"],
        )


def test_register_facility_duplicate_digest(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 4: Rejects duplicate expected evidence digest in the same incident."""
    direct_vm.sender = operator_address
    f1 = valid_facility_factory(1)
    f2_same_digest = valid_facility_factory(2)
    f2_same_digest["expected_evidence_digest"] = f1["expected_evidence_digest"]

    created_incident_board.register_facility(
        1,
        f1["facility_id"],
        f1["location_bucket"],
        f1["use_class"],
        f1["age_band"],
        f1["occupancy_band"],
        f1["evidence_url"],
        f1["expected_evidence_digest"],
    )

    with direct_vm.expect_revert("duplicate evidence digest in incident"):
        created_incident_board.register_facility(
            1,
            f2_same_digest["facility_id"],
            f2_same_digest["location_bucket"],
            f2_same_digest["use_class"],
            f2_same_digest["age_band"],
            f2_same_digest["occupancy_band"],
            f2_same_digest["evidence_url"],
            f2_same_digest["expected_evidence_digest"],
        )


def test_register_facility_invalid_location_bucket(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 4: Rejects location bucket not in incident allowed buckets."""
    direct_vm.sender = operator_address
    f = valid_facility_factory(1)

    with direct_vm.expect_revert("location bucket 'UNAUTHORIZED_ZONE' is not in incident allowed location buckets"):
        created_incident_board.register_facility(
            1,
            f["facility_id"],
            "UNAUTHORIZED_ZONE",
            f["use_class"],
            f["age_band"],
            f["occupancy_band"],
            f["evidence_url"],
            f["expected_evidence_digest"],
        )


def test_register_facility_capacity_limit(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 4: Rejects registration when MAX_FACILITIES_PER_INCIDENT (24) is reached."""
    direct_vm.sender = operator_address

    for i in range(1, 25):
        f = valid_facility_factory(i)
        created_incident_board.register_facility(
            1,
            f["facility_id"],
            f["location_bucket"],
            f["use_class"],
            f["age_band"],
            f["occupancy_band"],
            f["evidence_url"],
            f["expected_evidence_digest"],
        )

    assert created_incident_board.get_facility_count(1) == 24

    f25 = valid_facility_factory(25)
    with direct_vm.expect_revert("facility capacity reached for incident (max 24 facilities)"):
        created_incident_board.register_facility(
            1,
            f25["facility_id"],
            f25["location_bucket"],
            f25["use_class"],
            f25["age_band"],
            f25["occupancy_band"],
            f25["evidence_url"],
            f25["expected_evidence_digest"],
        )


def test_lock_cohort_success(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 5: Locking cohort transitions incident to COHORT_LOCKED and facilities to LOCKED."""
    direct_vm.sender = operator_address
    f1 = valid_facility_factory(1)
    f2 = valid_facility_factory(2)

    created_incident_board.register_facility(
        1,
        f1["facility_id"],
        f1["location_bucket"],
        f1["use_class"],
        f1["age_band"],
        f1["occupancy_band"],
        f1["evidence_url"],
        f1["expected_evidence_digest"],
    )
    created_incident_board.register_facility(
        1,
        f2["facility_id"],
        f2["location_bucket"],
        f2["use_class"],
        f2["age_band"],
        f2["occupancy_band"],
        f2["evidence_url"],
        f2["expected_evidence_digest"],
    )

    created_incident_board.lock_cohort(1)

    inc = json.loads(created_incident_board.get_incident(1))
    assert inc["status"] == "COHORT_LOCKED"
    assert inc["locked_at"] > 0

    fac1 = json.loads(created_incident_board.get_facility(1, 1))
    fac2 = json.loads(created_incident_board.get_facility(1, 2))
    assert fac1["status"] == "LOCKED"
    assert fac2["status"] == "LOCKED"

    # Facility registration blocked after lock
    f3 = valid_facility_factory(3)
    with direct_vm.expect_revert("cannot register facility: incident cohort is not in DRAFT phase"):
        created_incident_board.register_facility(
            1,
            f3["facility_id"],
            f3["location_bucket"],
            f3["use_class"],
            f3["age_band"],
            f3["occupancy_band"],
            f3["evidence_url"],
            f3["expected_evidence_digest"],
        )


def test_lock_cohort_empty_rejected(created_incident_board, direct_vm, operator_address):
    """Test 5: Rejects locking cohort with 0 registered facilities."""
    direct_vm.sender = operator_address

    with direct_vm.expect_revert("cannot lock cohort: no facilities registered"):
        created_incident_board.lock_cohort(1)


def test_lock_cohort_unauthorized(created_incident_board, direct_vm, unauthorized_user, valid_facility_factory, operator_address):
    """Test 5: Non-operator cannot lock cohort."""
    direct_vm.sender = operator_address
    f = valid_facility_factory(1)
    created_incident_board.register_facility(
        1,
        f["facility_id"],
        f["location_bucket"],
        f["use_class"],
        f["age_band"],
        f["occupancy_band"],
        f["evidence_url"],
        f["expected_evidence_digest"],
    )

    direct_vm.sender = unauthorized_user
    with direct_vm.expect_revert("unauthorized: caller is not operator"):
        created_incident_board.lock_cohort(1)


def test_lock_cohort_already_locked_rejected(created_incident_board, direct_vm, operator_address, valid_facility_factory):
    """Test 5: Rejects locking already locked cohort."""
    direct_vm.sender = operator_address
    f = valid_facility_factory(1)
    created_incident_board.register_facility(
        1,
        f["facility_id"],
        f["location_bucket"],
        f["use_class"],
        f["age_band"],
        f["occupancy_band"],
        f["evidence_url"],
        f["expected_evidence_digest"],
    )
    created_incident_board.lock_cohort(1)

    with direct_vm.expect_revert("cohort already locked or not in DRAFT phase"):
        created_incident_board.lock_cohort(1)
