import pytest
import hashlib
import json
from pathlib import Path
from gltest.direct.loader import create_address, deploy_contract

CONTRACT_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "earthquake_inspection_priority_board.py"


def compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest().lower()


def to_hex_addr(addr) -> str:
    if isinstance(addr, bytes):
        return "0x" + addr.hex().lower()
    if hasattr(addr, "as_hex"):
        return addr.as_hex.lower()
    if isinstance(addr, str):
        if addr.startswith("0x") or addr.startswith("0X"):
            return addr.lower()
        return "0x" + addr.lower()
    return str(addr).lower()


@pytest.fixture
def hex_addr():
    return to_hex_addr


@pytest.fixture(autouse=True)
def enable_pickling_checks(direct_vm):
    direct_vm.check_pickling = True
    return direct_vm


@pytest.fixture
def operator_address():
    return create_address("operator")


@pytest.fixture
def inspector_alice():
    return create_address("alice_inspector")


@pytest.fixture
def inspector_bob():
    return create_address("bob_inspector")


@pytest.fixture
def unauthorized_user():
    return create_address("charlie_unauthorized")


@pytest.fixture
def valid_incident_params():
    event_url = "https://earthquake.usgs.gov/earthquakes/eventpage/nc75123456/executive"
    event_body = "M6.8 - Northern California - 2026-08-23 04:15:00 UTC - Depth 12.4km - Shakemap VI"
    event_digest = compute_sha256(event_body)
    return {
        "event_id": "nc75123456",
        "event_url": event_url,
        "expected_event_digest": event_digest,
        "event_body": event_body,
        "region_label": "Northern California Bay Area",
        "allowed_location_buckets_json": json.dumps(
            ["SAN_FRANCISCO_DOWNTOWN", "NORTH_BAY_ZONE_1", "EAST_BAY_CORE", "SOUTH_BAY_INDUSTRIAL"],
            separators=(",", ":"),
        ),
        "event_occurred_at": 1787455000,
        "max_event_age_seconds": 86400,
        "slot_count": 3,
        "assignment_timeout_seconds": 3600,
        "policy_text": "Prioritize high-occupancy vulnerable facilities in high shaking zones.",
        "policy_version": 1,
    }


@pytest.fixture
def valid_facility_factory():
    def _create(
        fac_num: int = 1,
        bucket: str = "SAN_FRANCISCO_DOWNTOWN",
        use_class: str = "HOSPITAL",
        age_band: str = "PRE_1975",
        occupancy_band: str = "HIGH",
    ):
        fac_id = f"FAC-{fac_num:03d}"
        fac_url = f"https://city-inspection.example.gov/records/{fac_id}"
        fac_body = f"Facility Record {fac_id}: Location={bucket}, Class={use_class}, Age={age_band}, Occupancy={occupancy_band}"
        fac_digest = compute_sha256(fac_body)
        return {
            "facility_id": fac_id,
            "location_bucket": bucket,
            "use_class": use_class,
            "age_band": age_band,
            "occupancy_band": occupancy_band,
            "evidence_url": fac_url,
            "expected_evidence_digest": fac_digest,
            "evidence_body": fac_body,
        }

    return _create


@pytest.fixture
def deployed_board(direct_vm, operator_address):
    direct_vm.sender = operator_address
    board = deploy_contract(CONTRACT_PATH, direct_vm)
    return board


def mock_evaluation_journey(
    direct_vm,
    event_url: str,
    event_body: str,
    facility_url: str,
    facility_body: str,
    decision: str = "IMMEDIATE_REVIEW",
    priority_score: int = 88,
    eligible: bool = True,
    reason_codes: list | None = None,
    reason: str = "Severe shaking impact on high occupancy critical facility",
    event_id: str = "nc75123456",
    location_bucket: str = "SAN_FRANCISCO_DOWNTOWN",
    evidence_status: str = "VERIFIED",
):
    codes = reason_codes if reason_codes is not None else [
        "EVENT_MATCH", "FACILITY_MATCH", "IN_REGION", "HIGH_OCCUPANCY", "VULNERABLE_USE"
    ]

    ev_digest = compute_sha256(event_body)
    fac_digest = compute_sha256(facility_body)

    # Web mocks
    direct_vm.mock_web(event_url, {"body": event_body})
    direct_vm.mock_web(facility_url, {"body": facility_body})

    # LLM mock
    llm_payload = {
        "decision": decision,
        "priority_score": priority_score,
        "eligible": eligible,
        "reason_codes": codes,
        "reason": reason,
        "event_id": event_id,
        "location_bucket": location_bucket,
        "event_digest": ev_digest,
        "facility_digest": fac_digest,
        "evidence_status": evidence_status,
    }
    direct_vm._llm_mocks.clear()
    direct_vm.mock_llm(".*", json.dumps(llm_payload))
