import ast
import json
from pathlib import Path
from conftest import to_hex_addr, CONTRACT_PATH


def test_initialization_defaults(deployed_board, operator_address):
    """Test 1: Constructor initializes operator, version 1, zero incident count, and root upgrader."""
    assert to_hex_addr(deployed_board.get_operator()) == to_hex_addr(operator_address)
    assert deployed_board.get_version() == 1
    assert deployed_board.get_incident_count() == 0

    info_json = deployed_board.get_contract_info()
    info = json.loads(info_json)
    assert info["version"] == 1
    assert to_hex_addr(info["operator"]) == to_hex_addr(operator_address)
    assert info["incident_count"] == 0
    assert any(to_hex_addr(u) == to_hex_addr(operator_address) for u in info["upgraders"])

    caps_json = deployed_board.get_caps()
    caps = json.loads(caps_json)
    assert caps["max_incidents"] == 16
    assert caps["max_facilities_per_incident"] == 24
    assert caps["max_history_per_incident"] == 192
    assert caps["max_facility_retries"] == 2
    assert caps["score_bands"]["IMMEDIATE_REVIEW"] == [80, 100]


def test_upgradability_authorized_path(deployed_board, direct_vm, operator_address):
    """Test 16: Upgradability allows registered upgrader to replace code and preserves state."""
    direct_vm.sender = operator_address

    new_code_payload = b"# Upgraded contract code payload v2"
    deployed_board.upgrade(new_code_payload)

    # State remains intact
    assert deployed_board.get_version() == 1
    assert to_hex_addr(deployed_board.get_operator()) == to_hex_addr(operator_address)


def test_upgradability_unauthorized_rejected(deployed_board, direct_vm, unauthorized_user):
    """Test 16: Upgradability rejects unauthorized caller."""
    direct_vm.sender = unauthorized_user

    with direct_vm.expect_revert("unauthorized: caller is not an upgrader"):
        deployed_board.upgrade(b"malicious code")


def test_upgradability_empty_code_rejected(deployed_board, direct_vm, operator_address):
    """Test 16: Upgradability rejects empty code bytes."""
    direct_vm.sender = operator_address

    with direct_vm.expect_revert("invalid code: new_code cannot be empty"):
        deployed_board.upgrade(b"")


def test_ast_source_structure_and_decorators():
    """Correction 2: AST regression verifying exactly one contract class, exactly one decorator per method, 10 writes, 14 views."""
    source = Path(CONTRACT_PATH).read_text(encoding="utf-8")
    tree = ast.parse(source)

    contract_classes = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            # Check base class
            for base in node.bases:
                base_str = ast.unparse(base)
                if base_str in ("gl.Contract", "Contract"):
                    contract_classes.append(node)

    assert len(contract_classes) == 1, f"Expected exactly 1 gl.Contract class, found {len(contract_classes)}"
    contract_node = contract_classes[0]
    assert contract_node.name == "EarthquakeInspectionPriorityBoard"

    public_writes = []
    public_views = []

    for item in contract_node.body:
        if isinstance(item, ast.FunctionDef):
            public_decs = []
            for dec in item.decorator_list:
                dec_str = ast.unparse(dec)
                if "gl.public" in dec_str or "public.write" in dec_str or "public.view" in dec_str:
                    public_decs.append(dec_str)

            # Assert at most 1 public decorator per function
            assert len(public_decs) <= 1, (
                f"Method {item.name} has duplicate public decorators: {public_decs}"
            )

            if len(public_decs) == 1:
                dec_name = public_decs[0]
                if "write" in dec_name:
                    public_writes.append(item.name)
                elif "view" in dec_name:
                    public_views.append(item.name)

            # Assert no float return annotations or float arguments
            if item.returns and "float" in ast.unparse(item.returns):
                assert False, f"Method {item.name} returns float which is forbidden"
            for arg in item.args.args:
                if arg.annotation and "float" in ast.unparse(arg.annotation):
                    assert False, f"Method {item.name} arg {arg.arg} has float type which is forbidden"

    expected_writes = [
        "create_incident",
        "register_facility",
        "lock_cohort",
        "evaluate_facility",
        "finalize_allocation",
        "offer_assignment",
        "acknowledge_assignment",
        "reclaim_expired_assignment",
        "close_incident",
        "upgrade",
    ]

    expected_views = [
        "get_version",
        "get_operator",
        "get_incident_count",
        "get_active_incidents",
        "get_caps",
        "get_contract_info",
        "get_incident",
        "get_facility_count",
        "get_facility",
        "get_facilities",
        "get_queue",
        "get_waitlist",
        "get_history_count",
        "get_history",
    ]

    assert sorted(public_writes) == sorted(expected_writes), (
        f"Public writes mismatch. Got {public_writes}, expected {expected_writes}"
    )
    assert len(public_writes) == 10

    assert sorted(public_views) == sorted(expected_views), (
        f"Public views mismatch. Got {public_views}, expected {expected_views}"
    )
    assert len(public_views) == 14

    assert len(public_writes) + len(public_views) == 24
