# Studionet and Vercel verification evidence

Verification date: 2026-08-23 (Asia/Saigon)

## Exact source and deployment binding

- PRE_DEPLOY-approved source commit: `de3c5dffa28946da932bb4d40f163ea4f14ea79e`
- PRE_DEPLOY-approved tree: `989a149c5eb5cea0d778ca96d5af729301c9cb76`
- Contract source SHA-256: `123BE3E52F2773DC7A3CC5A45EBF6764C42E84114A480C57777586CFBD5FE8DD`
- Contract source size: 68,995 bytes / 68,993 decoded characters
- Contract: `0x1032C6e107863b4798B519929e7565e33DAd5cA1`
- Operator: `0x5D598f10a428fB2039edbC3aCE83351650B286E0`
- Sole Root Slot upgrader: `0x34b92E6553eaCA11A00A9d86d75d8a7881779D78`
- Explorer: https://explorer-studio.genlayer.com/address/0x1032C6e107863b4798B519929e7565e33DAd5cA1
- Studio execution mode: Normal (Full Consensus)

The exact approved source was installed by the authorized Root Slot account. A post-upgrade `genlayer-js@1.1.8 getContractCode` read returned 68,993 characters and SHA-256 `123be3e52f2773dc7a3cc5a45ebf6764c42e84114a480c57777586cfbd5fe8dd`, matching the reviewed source.

## Complete transaction ledger

Each transaction hash was independently queried. Successful rows require `FINALIZED / MAJORITY_AGREE / leader SUCCESS`; expected-error rows require finality and authoritative unchanged-state reconciliation.

| Order | Case | Transaction or submission | Actual outcome |
| ---: | --- | --- | --- |
| 1 | Historical source upgrade | https://explorer-studio.genlayer.com/tx/0xae27ec9371307dadecde1b413e9c0e9b3c961cbba33de586cfa3a59b3c7a95a1 | Superseded; retained for audit only |
| 2 | Wrong old-source upgrade | https://explorer-studio.genlayer.com/tx/0x05ceaa69ccc3e64798ac80e0f3b8126711a8aa16b5c99bc6ce9500c554933f19 | Superseded; not release proof |
| 3 | Failed operator-transfer attempt | https://explorer-studio.genlayer.com/tx/0x18d2bc85f4510207184d40df49afaf6e2bb86011112d0ae1a7561f541faf03a8 | Finalized error; operator unchanged |
| 4 | Failed operator-transfer attempt | https://explorer-studio.genlayer.com/tx/0xa4ad1594d066731444f0ae3862130942be027d90e374135120749b9d4ffa19a1 | Finalized error; operator unchanged |
| 5 | Operator transfer | https://explorer-studio.genlayer.com/tx/0x1e389772cf22fd92998a8c8dbee45f51041955f7fab194c12b5e8f9dd362a5af | FINALIZED / MAJORITY_AGREE / SUCCESS; operator became OKX account |
| 6 | Prior exact-source upgrade | https://explorer-studio.genlayer.com/tx/0x038adc19dca1b51413509baed8d372c5dc6f08366333a674c606fbf46085958d | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 7 | Incident create with malformed bucket transport | https://explorer-studio.genlayer.com/tx/0xe7729e26317a66d2e158a7abe8d72f9e54d90686ef8ff9852bffe557fd61489d | FINALIZED / MAJORITY_AGREE / ERROR; no state change |
| 8 | Incident create | https://explorer-studio.genlayer.com/tx/0xa1ce295dea5d32ff32fe30b2b589c230807af88dc1c1945c6e042d614f558482 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 9 | Register Alpha | https://explorer-studio.genlayer.com/tx/0x51e504546111f7e1cbf08d44b5c74280d20962c00bd2c2c66ed538f80a361ad1 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 10 | Register Bravo | https://explorer-studio.genlayer.com/tx/0x244ad80348eced3bfbaac80512d9679d21cc4249de6a113b39b2085cc5f61001 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 11 | Lock cohort | https://explorer-studio.genlayer.com/tx/0x81e7455bdb300c06cf5cee5d392529a74ffe2bd18f44f6dd332612cac4dca710 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 12 | Alpha evaluation exposing raw-vs-rendered digest defect | https://explorer-studio.genlayer.com/tx/0x74d42d575e9dfb0aa631530c3c2025018b2f20cee7fae5fd2548c903bb5318ec | FINALIZED / MAJORITY_AGREE / SUCCESS; business result safely `UNRESOLVED/MISMATCH`, attempt 1 |
| 13 | Redundant upgrade submitted before editor replacement | https://explorer-studio.genlayer.com/tx/0xf52746b6665ec724f5fa962c11cfad544454610f23e07e037c216d3cb3e3b43d | FINALIZED / MAJORITY_AGREE / upgrade success; not release proof |
| 14 | Exact approved-source upgrade | https://explorer-studio.genlayer.com/tx/0x89017acc81e029764f56775c61b6ce58d9585ffa9751a8f86024e15d5a485393 | FINALIZED / MAJORITY_AGREE / upgrade success; code hash parity verified |
| 15 | Alpha retry transport submission | No transaction hash returned | RPC `SUBMISSION_FAILED`; reconciled Alpha remained at attempt 1 before retry |
| 16 | Alpha evaluation retry | https://explorer-studio.genlayer.com/tx/0x03dfe30e1c89b22f0f84c925b9e2a18f18298b03a8c160311aa051e61fec2114 | FINALIZED / MAJORITY_AGREE / SUCCESS; score 97, `IMMEDIATE_REVIEW`, `VERIFIED` |
| 17 | Bravo evaluation | https://explorer-studio.genlayer.com/tx/0xa8f39100d81181efcde26f91754f6b4d63eea0020f784377e4d39bc99ada4fd2 | FINALIZED / MAJORITY_AGREE / SUCCESS; score 85, `IMMEDIATE_REVIEW`, `VERIFIED` |
| 18 | Finalize allocation | https://explorer-studio.genlayer.com/tx/0x56d7eb8e4238d20d70c88adeff07e12348a47c9be22a18775207a58312a37624 | FINALIZED / MAJORITY_AGREE / SUCCESS; Alpha queue 1, Bravo waitlist 1 |
| 19 | Offer Alpha | https://explorer-studio.genlayer.com/tx/0x1efe4cb70b1da89d12dae3a346147ae9236df33cc50f59d346d2b8fa62946121 | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 20 | Reclaim expired Alpha and promote Bravo | https://explorer-studio.genlayer.com/tx/0x9505950540743cf6d95dfb3b522ea9e0668d2a78ec876becc838695d40cb4dc0 | FINALIZED / MAJORITY_AGREE / SUCCESS; Alpha expired, Bravo queue 1 |
| 21 | Offer Bravo | https://explorer-studio.genlayer.com/tx/0x86cba3ee767ea03f483cec7affab51be767134fa6b2459f97966f3cbca09bd3a | FINALIZED / MAJORITY_AGREE / SUCCESS |
| 22 | Acknowledge Bravo | https://explorer-studio.genlayer.com/tx/0xbe7b4c7ff7afd8ff04592efcdb3acec79ae5c4c39b19ac918937f85d7a85583e | FINALIZED / MAJORITY_AGREE / SUCCESS; acknowledged exactly at deadline |
| 23 | Close incident | https://explorer-studio.genlayer.com/tx/0x32be97fc93e92c181f5e8ea6ec93e1f1e7e63554ac856e8cb6fccbdcde95095a | FINALIZED / MAJORITY_AGREE / SUCCESS |

## Authoritative final readback

- Contract: `version=2`; operator is the OKX account above; `get_active_incidents=[]`.
- Incident 4: `status=CLOSED`, `facility_count=2`, `allocated_count=1`, `history_count=14`.
- Alpha: score 97, `IMMEDIATE_REVIEW`, `VERIFIED`, attempts 2, assignment `EXPIRED`, queue 0, waitlist 0.
- Bravo: score 85, `IMMEDIATE_REVIEW`, `VERIFIED`, attempts 1, assignment `ACKNOWLEDGED`, queue 1, waitlist 0, inspector is the OKX account.
- Queue: Bravo only at slot 1; `acknowledged_at=deadline=1787500768`, proving the inclusive deadline boundary.
- Waitlist: empty.

The successful incident used USGS event `us6000jllz`, committed raw-response digest `13361ad7cd54e6df126be8aa82030e7bf823e2175a7502c1aee0e687e2925baa`, one slot, and a 60-second assignment timeout. Facility evidence digests were `fde600ce11b152e73b0a6f2cb6a92d4ecbdcb1f7dfeea1348c53ce8b859f90f8` (Alpha) and `5f31e509e537af61ae4b2dc181058703dc1349acd8c7206bb4f5c0458c49fa65` (Bravo).

## Browser and wallet E2E

- Production alias: https://earthquake-inspection-priority-boar.vercel.app
- Browser: user-owned Chrome session; selected provider: OKX Wallet through its exact EIP-6963 entry.
- MetaMask and OKX were both discoverable in the selector; the application does not restrict judges to OKX. Rabby support is enforced by the same exact-provider implementation and automated regression suite.
- The connected OKX account exercised the complete operator, public keeper, and assigned-inspector lifecycle recorded above.
- Transaction UI required finality, consensus, successful execution, and authoritative readback before success.
- Reload returned the application to `Connect Wallet` while public contract reads remained available.

## Local reproducibility

- `genvm-lint`: PASS, validation PASS, 25 methods.
- Direct Mode: 83/83 tests passed.
- Frontend: strict typecheck PASS; 56/56 tests in 6 files PASS; production build PASS.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `pip check`: no broken requirements.
- `git diff --check`: PASS.

## Release gates

- Anonymous `PRE_DEPLOY`: **APPROVED** for source commit `de3c5dffa28946da932bb4d40f163ea4f14ea79e`.
- Anonymous `POST_DEPLOY_TEST`: pending approval for the final evidence revision containing this ledger.
- Anonymous `POST_GITHUB_VERCEL_FINAL`: pending approval for that same final revision and public deployment.

The task is not complete until the two pending anonymous checkpoints and the primary AI approve the same exact final revision/evidence package.
