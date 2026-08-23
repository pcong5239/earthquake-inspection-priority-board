import json
from conftest import mock_evaluation_journey


def test_create_incident_success(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 2: Valid incident creation initializes state to DRAFT and emits history."""
    direct_vm.sender = operator_address

    inc_id = deployed_board.create_incident(
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

    assert inc_id == 1
    assert deployed_board.get_incident_count() == 1

    summary_json = deployed_board.get_incident(1)
    summary = json.loads(summary_json)
    assert summary["incident_id"] == 1
    assert summary["status"] == "DRAFT"
    assert summary["event_id"] == valid_incident_params["event_id"]
    assert summary["event_url"] == valid_incident_params["event_url"]
    assert summary["expected_event_digest"] == valid_incident_params["expected_event_digest"]
    assert summary["region_label"] == valid_incident_params["region_label"]
    assert summary["slot_count"] == valid_incident_params["slot_count"]
    assert summary["assignment_timeout_seconds"] == valid_incident_params["assignment_timeout_seconds"]
    assert summary["policy_version"] == valid_incident_params["policy_version"]
    assert summary["facility_count"] == 0

    history_json = deployed_board.get_history(1, 0, 10)
    history = json.loads(history_json)
    assert history["total_history_count"] == 1
    assert history["history"][0]["event_type"] == "INCIDENT_CREATED"
    assert history["history"][0]["details"]["event_id"] == valid_incident_params["event_id"]


def test_create_incident_unauthorized(deployed_board, direct_vm, unauthorized_user, valid_incident_params):
    """Test 2: Non-operator cannot create incident."""
    direct_vm.sender = unauthorized_user

    with direct_vm.expect_revert("unauthorized: caller is not operator"):
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


def test_create_incident_url_validation_host_bypass(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 3: Enforces allowlisted earthquake.usgs.gov domain and rejects bypass attempts."""
    direct_vm.sender = operator_address

    # Non-HTTPS
    with direct_vm.expect_revert("invalid url: must use https scheme"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            "http://earthquake.usgs.gov/earthquakes/eventpage/nc123",
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

    # Subdomain spoofing / attacker domain
    invalid_hosts = [
        "https://earthquake.usgs.gov.attacker.com/event",
        "https://usgs.gov/earthquakes/event",
        "https://malicious-usgs.org/event",
        "https://not-earthquake.usgs.gov/event",
    ]
    for bad_url in invalid_hosts:
        with direct_vm.expect_revert("invalid url host: expected exact host 'earthquake.usgs.gov'"):
            deployed_board.create_incident(
                valid_incident_params["event_id"],
                bad_url,
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


def test_create_incident_digest_validation(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 3: Validates lowercase 64-hex SHA-256 digest format."""
    direct_vm.sender = operator_address

    # Wrong length
    for bad_digest in ["not-a-hash", "a" * 63, "a" * 65]:
        with direct_vm.expect_revert("invalid digest: must be exact 64-character hex string"):
            deployed_board.create_incident(
                valid_incident_params["event_id"],
                valid_incident_params["event_url"],
                bad_digest,
                valid_incident_params["region_label"],
                valid_incident_params["allowed_location_buckets_json"],
                valid_incident_params["event_occurred_at"],
                valid_incident_params["max_event_age_seconds"],
                valid_incident_params["slot_count"],
                valid_incident_params["assignment_timeout_seconds"],
                valid_incident_params["policy_text"],
                valid_incident_params["policy_version"],
            )

    # Uppercase or non-hex
    for bad_digest in ["A" * 64, "g" * 64]:
        with direct_vm.expect_revert("invalid digest: must contain only lowercase hex characters"):
            deployed_board.create_incident(
                valid_incident_params["event_id"],
                valid_incident_params["event_url"],
                bad_digest,
                valid_incident_params["region_label"],
                valid_incident_params["allowed_location_buckets_json"],
                valid_incident_params["event_occurred_at"],
                valid_incident_params["max_event_age_seconds"],
                valid_incident_params["slot_count"],
                valid_incident_params["assignment_timeout_seconds"],
                valid_incident_params["policy_text"],
                valid_incident_params["policy_version"],
            )


def test_create_incident_slot_count_and_age_bounds(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 2: Validates slot count and age/timeout boundaries."""
    direct_vm.sender = operator_address

    # slot_count = 0
    with direct_vm.expect_revert("slot_count must be between 1 and 24"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            0,
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    # slot_count > 24
    with direct_vm.expect_revert("slot_count must be between 1 and 24"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            25,
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    # max_event_age_seconds == 0
    with direct_vm.expect_revert("max_event_age_seconds must be between 1 and 31536000"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            0,
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    # assignment_timeout_seconds < 60
    with direct_vm.expect_revert("assignment_timeout_seconds must be between 60 and 604800 seconds"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            59,
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )


def test_create_incident_location_buckets_validation(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 2: Validates JSON structure of allowed location buckets."""
    direct_vm.sender = operator_address

    # Invalid JSON string
    with direct_vm.expect_revert("allowed_location_buckets_json must be valid JSON array"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            "not-json-array",
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    # JSON not an array
    with direct_vm.expect_revert("allowed_location_buckets_json must be valid JSON array"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            json.dumps({"bucket": "ZONE_1"}),
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    # Empty array
    with direct_vm.expect_revert("allowed_location_buckets_json must be valid JSON array"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            valid_incident_params["region_label"],
            json.dumps([]),
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )


def test_create_incident_duplicate_event_id_rejection(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 2: Rejects duplicate active incident for the same event_id."""
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

    with direct_vm.expect_revert(f"duplicate active incident for event_id: {valid_incident_params['event_id']}"):
        deployed_board.create_incident(
            valid_incident_params["event_id"],
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            "Second Region",
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )


def test_create_incident_same_event_id_allowed_after_closure(
    deployed_board, direct_vm, operator_address, valid_incident_params, valid_facility_factory
):
    """Correction 3: Allows creating a new incident with the same event_id after the prior incident is CLOSED."""
    direct_vm.sender = operator_address

    # 1. Create first incident
    inc1_id = deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        valid_incident_params["region_label"],
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        1,
        valid_incident_params["assignment_timeout_seconds"],
        valid_incident_params["policy_text"],
        valid_incident_params["policy_version"],
    )
    assert inc1_id == 1

    # 2. Progress incident 1 to ALLOCATED and CLOSE it
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    deployed_board.register_facility(
        1,
        f1["facility_id"],
        f1["location_bucket"],
        f1["use_class"],
        f1["age_band"],
        f1["occupancy_band"],
        f1["evidence_url"],
        f1["expected_evidence_digest"],
    )
    deployed_board.lock_cohort(1)
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
    deployed_board.evaluate_facility(1, 1)
    deployed_board.finalize_allocation(1)
    deployed_board.close_incident(1)

    # Verify incident 1 is CLOSED
    inc1 = json.loads(deployed_board.get_incident(1))
    assert inc1["status"] == "CLOSED"

    # 3. Create second incident with the same event_id -> succeeds
    inc2_id = deployed_board.create_incident(
        valid_incident_params["event_id"],
        valid_incident_params["event_url"],
        valid_incident_params["expected_event_digest"],
        "Second Region for Same Event",
        valid_incident_params["allowed_location_buckets_json"],
        valid_incident_params["event_occurred_at"],
        valid_incident_params["max_event_age_seconds"],
        2,
        valid_incident_params["assignment_timeout_seconds"],
        valid_incident_params["policy_text"],
        valid_incident_params["policy_version"],
    )
    assert inc2_id == 2
    assert deployed_board.get_incident_count() == 2

    # Active incidents includes 2, but not 1
    active_incidents = json.loads(deployed_board.get_active_incidents())
    assert active_incidents == [2]


def test_create_incident_capacity_limit(deployed_board, direct_vm, operator_address, valid_incident_params):
    """Test 2: Rejects incident creation when MAX_INCIDENTS (16) is reached."""
    direct_vm.sender = operator_address

    for i in range(1, 17):
        deployed_board.create_incident(
            f"event_{i:03d}",
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            f"Region {i}",
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )

    assert deployed_board.get_incident_count() == 16

    with direct_vm.expect_revert("incident capacity reached (max 16 incidents)"):
        deployed_board.create_incident(
            "event_017",
            valid_incident_params["event_url"],
            valid_incident_params["expected_event_digest"],
            "Region 17",
            valid_incident_params["allowed_location_buckets_json"],
            valid_incident_params["event_occurred_at"],
            valid_incident_params["max_event_age_seconds"],
            valid_incident_params["slot_count"],
            valid_incident_params["assignment_timeout_seconds"],
            valid_incident_params["policy_text"],
            valid_incident_params["policy_version"],
        )
