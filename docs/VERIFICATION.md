# Studionet verification evidence

Verification date: 2026-08-23 (Asia/Saigon)

## Revision and deployment binding

- PRE_DEPLOY-approved commit: `a64e3d74cde64259dc965662827e10bcc7518384`
- PRE_DEPLOY-approved tree: `902bff59be82a71b3e885d205623cff2f625e664`
- Contract source SHA-256: `7EC69DBBD15331952DA3B16929D8FE2F75DA0022FB39EF3791DDD84D8EFF65EB`
- Locked deployer/operator: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`
- Contract: `0x1032C6e107863b4798B519929e7565e33DAd5cA1`
- Explorer: https://explorer-studio.genlayer.com/address/0x1032C6e107863b4798B519929e7565e33DAd5cA1
- Studio execution mode: Normal (Full Consensus)

The exact approved `contracts/earthquake_inspection_priority_board.py` file was imported through Studio's file chooser. No constructor arguments were supplied.

## Transaction ledger

Every positive row below was independently queried with `genlayer-js@1.1.8` `getTransaction`. Required outcome was `statusName=FINALIZED`, `result_name=MAJORITY_AGREE`, and leader `execution_result=SUCCESS`.

| Case | Transaction | Outcome |
| --- | --- | --- |
| Deploy | https://explorer-studio.genlayer.com/tx/0xd2e97449bcee947d3f5505804e7b068be0ee36e6714fd179ca6d46d49a216d78 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Create incident | https://explorer-studio.genlayer.com/tx/0x66f0d786d46dd4fd6b99ac03410e77210d7b7a2b462d28d53f442cad2eda800c | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Register facility | https://explorer-studio.genlayer.com/tx/0xca8ff3e058c68b18333054b4caeed2a0ee7fde355fb97685e33dd5330d752cdd | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Duplicate facility negative test | https://explorer-studio.genlayer.com/tx/0x9ca3c1dc6e277837667e512e496c0127a991ad0f8a63710e66071e19ec50ed96 | FINALIZED / MAJORITY_AGREE / ERROR; state unchanged |
| Lock cohort | https://explorer-studio.genlayer.com/tx/0xfe0f187c2e98c677ed5bdc0785954fd4d84ab6dcdfe08bc9e52690fcc87b379c | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Evaluate facility, attempt 1 | https://explorer-studio.genlayer.com/tx/0x821b55da7a8ff838f2b5e77b2cae3e401b18fb2e72c25bace842cd02e833dec2 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Evaluate facility, attempt 2 | https://explorer-studio.genlayer.com/tx/0x2ebe093c0cfd7464db5133793dd94f642a39010f77cebb2be87161d80e633d0c | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Finalize allocation | https://explorer-studio.genlayer.com/tx/0xce6b6e191d44603da87b8db0cc767d66886ba1bac3f532ccf3ffdbcac403d2eb | FINALIZED / MAJORITY_AGREE / SUCCESS |
| Close incident | https://explorer-studio.genlayer.com/tx/0xeb77c31e83ce1bdc38f396e8dd9e9500b79f4f94ba73caabebbbc0488ffbbc3f | FINALIZED / MAJORITY_AGREE / SUCCESS |

## Isolated upgrade rehearsal

- Test deployment: `0x9c0805030D740741D3a0d9E34245E4dF114E4875`
- Deploy: https://explorer-studio.genlayer.com/tx/0x0afa2b5ba655a02c0b7f7a4f1faba9108121f3504a7c8cce25197614a28e577f — FINALIZED / MAJORITY_AGREE / SUCCESS
- Studio sidebar same-source replacement: https://explorer-studio.genlayer.com/tx/0x871bb63cfb2b19d86957fe0b5860c8b2cd05c8d51674030fc1614e250774e9c9 — FINALIZED / MAJORITY_AGREE; this system transaction does not expose a leader execution field and is not used as the contract-method execution proof.
- Failed public-method encoding attempt: https://explorer-studio.genlayer.com/tx/0xedc9324e8d63338edb8af9b4d6ad52569cbb63acde4481d3360ade62b56c7138 — FINALIZED / MAJORITY_AGREE / ERROR. Studio parsed the incorrect `0x<hex>` bytes representation as an integer; traceback was `TypeError: object of type 'int' has no len()`. Code remained unchanged.
- Successful public `upgrade(bytes)` rehearsal: https://explorer-studio.genlayer.com/tx/0x431037a72ebd265b94d3fae280f42348c8bf3d5fc91c0c68c8a7676a47c6f74f — FINALIZED / MAJORITY_AGREE / SUCCESS, empty stderr. The mechanically generated input used Studio's required `b#<hex>` bytes representation.
- Post-upgrade finalized readback: `incident_count=0`, `version=1`, operator and sole upgrader remain the locked Studio account.
- `genlayer-js getContractCode` SHA-256 for both the release contract and rehearsal contract after upgrade: `7EC69DBBD15331952DA3B16929D8FE2F75DA0022FB39EF3791DDD84D8EFF65EB` (67,348 bytes), exactly matching the approved source.

## Authoritative finalized readbacks

- Immediately after deployment: `incident_count=0`, `version=1`, operator and sole upgrader equal the locked deployer.
- After incident creation: `incident_count=1`.
- After the duplicate registration negative test: `facility_count=1`; no duplicate record was committed.
- After evaluation attempt 1: `decision=UNRESOLVED`, `evidence_status=MISMATCH`, `evaluation_attempts=1`.
- After evaluation attempt 2: `decision=UNRESOLVED`, `evidence_status=MISMATCH`, `evaluation_attempts=2`, `reason_codes=["EVENT_MISMATCH"]`, reason `USGS event content digest mismatch`.
- After allocation: incident `status=ALLOCATED`, `allocated_count=0`, facility `queue_position=0`, proving unresolved evidence cannot enter the queue.
- After closure: incident `status=CLOSED`, `history_count=7`.

The mismatched digests were intentional test fixtures. They exercise live USGS web rendering, leader/validator consensus, bounded retries, and fail-closed allocation without asserting an unverified real-world priority verdict.

## Remaining gates

- Anonymous reviewer `POST_DEPLOY_TEST`: **APPROVED** for evidence revision `919f82ab08a70a8595debad19f1d94a92aa24b1e`.
- Public GitHub repository: https://github.com/pcong5239/earthquake-inspection-priority-board
- Vercel production alias: https://earthquake-inspection-priority-boar.vercel.app
- The Vercel project is connected to this GitHub repository; the production alias is `READY` and configured with contract `0x1032C6e107863b4798B519929e7565e33DAd5cA1`.
- Final Vercel E2E performed by the user with an independent browser wallet, including MetaMask, OKX Wallet, and Rabby selection/disconnect-on-reload checks.
- Anonymous reviewer `POST_GITHUB_VERCEL_FINAL` approval for the same final revision and evidence package.
