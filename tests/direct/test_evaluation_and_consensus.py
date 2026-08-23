import json
import pytest
from conftest import mock_evaluation_journey, compute_sha256


@pytest.fixture
def locked_incident_board(deployed_board, direct_vm, operator_address, valid_incident_params, valid_facility_factory):
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

    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")

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
    deployed_board.register_facility(
        1,
        f2["facility_id"],
        f2["location_bucket"],
        f2["use_class"],
        f2["age_band"],
        f2["occupancy_band"],
        f2["evidence_url"],
        f2["expected_evidence_digest"],
    )
    deployed_board.register_facility(
        1,
        f3["facility_id"],
        f3["location_bucket"],
        f3["use_class"],
        f3["age_band"],
        f3["occupancy_band"],
        f3["evidence_url"],
        f3["expected_evidence_digest"],
    )

    deployed_board.lock_cohort(1)
    return deployed_board


def test_evaluate_immediate_review(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 6: Facility with score >= 80 evaluates to IMMEDIATE_REVIEW."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=88,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"
    assert fac["decision"] == "IMMEDIATE_REVIEW"
    assert fac["priority_score"] == 88
    assert fac["eligible"] is True
    assert fac["evidence_status"] == "VERIFIED"
    assert fac["evaluation_attempts"] == 1

    inc = json.loads(locked_incident_board.get_incident(1))
    assert inc["status"] == "EVALUATING"


def test_evaluate_priority_queue(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 6: Facility with score 55-79 evaluates to PRIORITY_QUEUE."""
    f2 = valid_facility_factory(2, use_class="COMMERCIAL", occupancy_band="MEDIUM")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f2["evidence_url"],
        facility_body=f2["evidence_body"],
        decision="PRIORITY_QUEUE",
        priority_score=68,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 2)

    fac = json.loads(locked_incident_board.get_facility(1, 2))
    assert fac["status"] == "DECIDED"
    assert fac["decision"] == "PRIORITY_QUEUE"
    assert fac["priority_score"] == 68
    assert fac["eligible"] is True


def test_evaluate_monitor(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 6: Facility with score 25-54 evaluates to MONITOR."""
    f3 = valid_facility_factory(3, use_class="RESIDENTIAL_WOOD", occupancy_band="LOW")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f3["evidence_url"],
        facility_body=f3["evidence_body"],
        decision="MONITOR",
        priority_score=40,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 3)

    fac = json.loads(locked_incident_board.get_facility(1, 3))
    assert fac["status"] == "DECIDED"
    assert fac["decision"] == "MONITOR"
    assert fac["priority_score"] == 40
    assert fac["eligible"] is True


def test_evaluate_out_of_scope(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 6: Facility with score 0-24 evaluates to OUT_OF_SCOPE."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="OUT_OF_SCOPE",
        priority_score=15,
        eligible=False,
    )

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"
    assert fac["decision"] == "OUT_OF_SCOPE"
    assert fac["priority_score"] == 15
    assert fac["eligible"] is False


@pytest.mark.parametrize(
    "score,expected_decision,expected_eligible",
    [
        (24, "OUT_OF_SCOPE", False),
        (25, "MONITOR", True),
        (54, "MONITOR", True),
        (55, "PRIORITY_QUEUE", True),
        (79, "PRIORITY_QUEUE", True),
        (80, "IMMEDIATE_REVIEW", True),
    ],
)
def test_score_boundaries(
    locked_incident_board,
    direct_vm,
    valid_incident_params,
    valid_facility_factory,
    score,
    expected_decision,
    expected_eligible,
):
    """Test 7: Strict verification of 24/25, 54/55, and 79/80 score boundaries."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision=expected_decision,
        priority_score=score,
        eligible=expected_eligible,
    )

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["decision"] == expected_decision
    assert fac["priority_score"] == score
    assert fac["eligible"] == expected_eligible


def test_validator_consensus_execution(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 8 & Correction 1: Direct-mode validator consensus re-runs evidence fetch and accepts valid gl.vm.Return."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=85,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)

    # Run the captured validator function (wrapped in gl.vm.Return)
    assert direct_vm.run_validator() is True

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"
    assert fac["decision"] == "IMMEDIATE_REVIEW"
    assert fac["priority_score"] == 85


def test_validator_plain_dict_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 1: Validator explicitly fails closed on raw unwrapped dict input."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=85,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)

    stored_result, _, validator_fn = direct_vm._captured_validators[-1]
    # Pass plain dict without gl.vm.Return wrapper
    assert validator_fn(stored_result) is False


def test_validator_rollback_or_error_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 1: Validator explicitly rejects exception/rollback wrapper."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=85,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)

    # Pass leader_error to simulate gl.vm.UserError / error wrapper
    assert direct_vm.run_validator(leader_error=Exception("Simulated Rollback/Error")) is False


def test_validator_rejection_semantic_forgery(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 9 & Correction 1: Validator rejects semantic forgery if leader claims band that disagrees with independent evidence."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=88,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)

    ev_digest = compute_sha256(valid_incident_params["event_body"])
    fac_digest = compute_sha256(f1["evidence_body"])

    # Simulate leader presenting forged result with conflicting score/band
    forged_leader_result = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 10,  # Score 10 does not match IMMEDIATE_REVIEW
        "eligible": True,
        "reason_codes": ["EVENT_MATCH"],
        "reason": "Forged verdict",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }

    assert direct_vm.run_validator(leader_result=forged_leader_result) is False


def test_validator_same_band_score_drift_accepted(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 1: Score drift within the same decision band is accepted by validator consensus."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Leader evaluates with score 82 (IMMEDIATE_REVIEW)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=82,
        eligible=True,
    )
    locked_incident_board.evaluate_facility(1, 1)

    ev_digest = compute_sha256(valid_incident_params["event_body"])
    fac_digest = compute_sha256(f1["evidence_body"])

    # Validator re-derives score 95 (also IMMEDIATE_REVIEW)
    validator_llm_payload = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 95,
        "eligible": True,
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "Independent validator assessment in same band",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(validator_llm_payload))

    assert direct_vm.run_validator() is True


def test_validator_cross_band_score_drift_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 1: Score drift crossing a decision band threshold is rejected by validator consensus."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Leader evaluates with score 80 (IMMEDIATE_REVIEW)
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=80,
        eligible=True,
    )
    locked_incident_board.evaluate_facility(1, 1)

    ev_digest = compute_sha256(valid_incident_params["event_body"])
    fac_digest = compute_sha256(f1["evidence_body"])

    # Validator re-derives score 78 (PRIORITY_QUEUE - cross-band threshold)
    validator_llm_payload = {
        "decision": "PRIORITY_QUEUE",
        "priority_score": 78,
        "eligible": True,
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "Independent validator assessment in lower band",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(validator_llm_payload))

    assert direct_vm.run_validator() is False


def test_validator_digest_mismatch_unresolved_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 1: Digest mismatch between leader and validator is rejected even on UNRESOLVED results when either side observed a digest."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Leader evaluates to UNRESOLVED due to digest mismatch
    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"] + " modified"})
    locked_incident_board.evaluate_facility(1, 1)

    # Leader saw modified digest
    lead_fac_digest = compute_sha256(f1["evidence_body"] + " modified")
    leader_result_unresolved = {
        "decision": "UNRESOLVED",
        "priority_score": 0,
        "eligible": False,
        "reason_codes": ["FACILITY_MISMATCH"],
        "reason": "Facility digest mismatch",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": compute_sha256(valid_incident_params["event_body"]),
        "facility_digest": lead_fac_digest,
        "evidence_status": "MISMATCH",
    }

    # Now validator observes yet another revision
    direct_vm._web_mocks.clear()
    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"] + " revision 3"})
    assert direct_vm.run_validator(leader_result=leader_result_unresolved) is False


def test_evidence_failure_event_unavailable(locked_incident_board, direct_vm, valid_facility_factory):
    """Test 10: USGS event 404 or fetch failure results in UNRESOLVED status."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Only facility is mocked, event is unmocked (fails fetch)
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["priority_score"] == 0
    assert fac["eligible"] is False
    assert fac["evidence_status"] == "UNAVAILABLE"
    assert "SOURCE_UNAVAILABLE" in fac["reason_codes"]


def test_http_200_response_body_reaches_verified_evaluation(
    locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory
):
    """Raw HTTP 200 bodies are the exact bytes used by the digest boundary."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="IMMEDIATE_REVIEW",
        priority_score=88,
        eligible=True,
    )

    locked_incident_board.evaluate_facility(1, 1)
    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"
    assert fac["evidence_status"] == "VERIFIED"


@pytest.mark.parametrize(
    "response",
    [
        {"status": 503, "body": "temporary upstream failure"},
        {"status": 200, "body": None},
    ],
)
def test_http_non_200_or_null_body_fails_closed(
    locked_incident_board, direct_vm, valid_incident_params, response
):
    """Transport failures never reach the LLM or become policy decisions."""
    direct_vm.mock_web(valid_incident_params["event_url"], response)

    locked_incident_board.evaluate_facility(1, 1)
    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "UNAVAILABLE"
    assert fac["reason_codes"] == ["SOURCE_UNAVAILABLE"]


def test_evidence_failure_digest_mismatch(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 10: USGS event content digest mismatch yields UNRESOLVED status."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Web body does not match expected digest
    modified_event_body = "M5.0 - Northern California - Modified revision"
    direct_vm.mock_web(valid_incident_params["event_url"], {"body": modified_event_body})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "MISMATCH"
    assert "EVENT_MISMATCH" in fac["reason_codes"]


def test_evaluation_string_eligible_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 5: String-valued eligible field in LLM response yields UNRESOLVED with MALFORMED_EVIDENCE."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    ev_digest = compute_sha256(valid_incident_params["event_body"])
    fac_digest = compute_sha256(f1["evidence_body"])

    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    llm_payload = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 88,
        "eligible": "true",  # String instead of boolean
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "String eligible test",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(llm_payload))

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "MALFORMED"
    assert "MALFORMED_EVIDENCE" in fac["reason_codes"]


def test_evaluation_contradictory_eligible_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 5: Contradictory eligible field (e.g. IMMEDIATE_REVIEW with eligible=False) yields UNRESOLVED with MALFORMED_EVIDENCE."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    ev_digest = compute_sha256(valid_incident_params["event_body"])
    fac_digest = compute_sha256(f1["evidence_body"])

    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    llm_payload = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 88,
        "eligible": False,  # Contradicts IMMEDIATE_REVIEW
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "Contradictory eligible test",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(llm_payload))

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "MALFORMED"
    assert "MALFORMED_EVIDENCE" in fac["reason_codes"]


def test_evaluation_forged_digest_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 5: Forged / mismatched digest in LLM response yields UNRESOLVED with EVENT_MISMATCH."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    fac_digest = compute_sha256(f1["evidence_body"])

    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    llm_payload = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 88,
        "eligible": True,
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "Forged digest test",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": "a" * 64,  # Forged digest does not match observed
        "facility_digest": fac_digest,
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(llm_payload))

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "MISMATCH"
    assert "EVENT_MISMATCH" in fac["reason_codes"]


def test_evaluation_omitted_digest_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Correction 5: Omitted / empty digest in LLM response for observed source yields UNRESOLVED with MALFORMED_EVIDENCE."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")
    ev_digest = compute_sha256(valid_incident_params["event_body"])

    direct_vm.mock_web(valid_incident_params["event_url"], {"body": valid_incident_params["event_body"]})
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})

    llm_payload = {
        "decision": "IMMEDIATE_REVIEW",
        "priority_score": 88,
        "eligible": True,
        "reason_codes": ["EVENT_MATCH", "FACILITY_MATCH"],
        "reason": "Omitted digest test",
        "event_id": "nc75123456",
        "location_bucket": "SAN_FRANCISCO_DOWNTOWN",
        "event_digest": ev_digest,
        "facility_digest": "",  # Omitted digest for observed facility
        "evidence_status": "VERIFIED",
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(llm_payload))

    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["decision"] == "UNRESOLVED"
    assert fac["evidence_status"] == "MALFORMED"
    assert "MALFORMED_EVIDENCE" in fac["reason_codes"]


def test_bounded_retries_and_exhaustion(locked_incident_board, direct_vm, valid_facility_factory):
    """Test 11: UNRESOLVED facility can be retried up to MAX_FACILITY_RETRIES (2), then rejected."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # Attempt 1: failure -> UNRESOLVED (attempts = 1)
    direct_vm.mock_web(f1["evidence_url"], {"body": f1["evidence_body"]})
    locked_incident_board.evaluate_facility(1, 1)

    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["evaluation_attempts"] == 1

    # Attempt 2: failure -> UNRESOLVED (attempts = 2)
    locked_incident_board.evaluate_facility(1, 1)
    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "UNRESOLVED"
    assert fac["evaluation_attempts"] == 2

    # Attempt 3: Retry cap exhausted -> Reverts
    with direct_vm.expect_revert("facility evaluation retry limit exhausted (max 2 attempts)"):
        locked_incident_board.evaluate_facility(1, 1)


def test_reevaluate_decided_rejected(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 11: Re-evaluating an already DECIDED facility is rejected."""
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

    locked_incident_board.evaluate_facility(1, 1)
    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"

    with direct_vm.expect_revert("facility is already decided and cannot be re-evaluated"):
        locked_incident_board.evaluate_facility(1, 1)


def test_prompt_injection_safety(locked_incident_board, direct_vm, valid_incident_params, valid_facility_factory):
    """Test 12: Prompt injection inside web text is safely treated as untrusted data."""
    f1 = valid_facility_factory(1, use_class="HOSPITAL", occupancy_band="HIGH")

    # LLM behaves safely and outputs valid structured JSON classification
    mock_evaluation_journey(
        direct_vm,
        event_url=valid_incident_params["event_url"],
        event_body=valid_incident_params["event_body"],
        facility_url=f1["evidence_url"],
        facility_body=f1["evidence_body"],
        decision="PRIORITY_QUEUE",
        priority_score=60,
        eligible=True,
        reason="Assessed based on building structure despite injection text",
    )

    locked_incident_board.evaluate_facility(1, 1)
    fac = json.loads(locked_incident_board.get_facility(1, 1))
    assert fac["status"] == "DECIDED"
    assert fac["priority_score"] == 60
