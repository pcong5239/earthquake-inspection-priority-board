# Earthquake Inspection Priority Board

An evidence-bound GenLayer Studionet board that prioritizes post-earthquake facility inspections without publishing exact facility coordinates.

## Verified links

- Live app: [https://earthquake-inspection-priority-boar.vercel.app](https://earthquake-inspection-priority-boar.vercel.app)
- Studionet contract: [`0x1032C6e107863b4798B519929e7565e33DAd5cA1`](https://explorer-studio.genlayer.com/address/0x1032C6e107863b4798B519929e7565e33DAd5cA1)
- Deployment and transaction evidence: [`docs/VERIFICATION.md`](docs/VERIFICATION.md)

## Trust problem

Emergency operators need a defensible inspection order, but a facility claimant can overstate urgency, alter a linked page, or expose sensitive location data. A single server can also silently change scoring or reorder the queue. This project binds each incident to a USGS source, each facility to public evidence and a coarse approved location bucket, and every consequential result to on-chain state.

## Why GenLayer is essential

The contract uses GenLayer nondeterminism to render the USGS event page and facility evidence, verify their committed SHA-256 digests, and ask an LLM to classify inspection priority under the incident policy. Validators independently refetch and re-evaluate the evidence. Only a consensus-safe normalized result can affect the deterministic queue; unavailable, changed, conflicting, or malformed evidence fails closed as `UNRESOLVED`.

## How it works

1. The operator creates an incident with a USGS URL, expected digest, policy, coarse location buckets, capacity, and assignment timeout.
2. The operator registers facilities using a public identifier, coarse bucket, risk bands, evidence URL, and expected digest—never exact coordinates.
3. The cohort is locked. Each facility receives at most two full-consensus evaluation attempts.
4. The contract sorts eligible results by score and facility ID, then assigns queue and waitlist positions deterministically.
5. The operator offers a queued assignment to an inspector. The inspector may acknowledge before the deadline; anyone may reclaim an expired offer and trigger the first waitlisted promotion.
6. The operator closes an allocated incident only when no active offer remains.

The UI exposes public viewing, operator actions, and assigned-inspector actions. MetaMask, OKX Wallet, and Rabby are discovered through EIP-6963 and shown in an explicit selector. Reload always returns to a disconnected state.

## Architecture

- `contracts/earthquake_inspection_priority_board.py`: authoritative actors, incident/facility/history state, consensus evaluation, allocation, assignments, and upgrade authorization.
- `frontend/`: React/Vite interface, EIP-6963 wallet isolation, Studionet client, bounded reads, transaction lifecycle, authoritative readback, and accessible dialogs.
- `tests/direct/`: strict Direct Mode contract behavior and consensus-safety regressions.
- `frontend/src/__tests__/`: ABI, guards, wallet, transaction, readback, and component tests.

USGS and facility pages are untrusted evidence inputs. Contract storage is the source of truth for workflow phase, verdict, queue, waitlist, assignment, and history. The frontend never substitutes local state for a finalized contract readback.

## Intelligent Contract

Actors are the deployer/operator, assigned inspectors, public keeper callers, and the Root Slot upgrader. Incidents transition `DRAFT → COHORT_LOCKED → EVALUATING → ALLOCATED → CLOSED`. Facilities transition from registration and lock through a decided or fail-closed unresolved result. Assignment state is `NONE`, `OFFERED`, `ACKNOWLEDGED`, or `EXPIRED`.

The contract exposes 14 views and 10 writes. Its validator path requires exact consequential-field agreement, exact observed digests, and permits bounded score variation only inside the same decision band. Score bands are 80–100 immediate review, 55–79 priority queue, 25–54 monitor, and 0–24 out of scope.

## Transaction lifecycle

For every write, the frontend validates configuration and chain `61999`, requests a signature from the selected provider instance, submits the transaction, waits through consensus, and requires `FINALIZED` plus a successful execution result. It then polls an authoritative contract view until the expected state is observed. Rejection, timeout, execution failure, and readback mismatch remain explicit terminal errors; `ACCEPTED` alone is never presented as success.

## Run locally

Prerequisites: Node.js 22+, npm, Python 3.12+, and the pinned packages in `requirements-dev.txt`.

```powershell
git clone https://github.com/pcong5239/earthquake-inspection-priority-board.git
Set-Location earthquake-inspection-priority-board
Copy-Item frontend/.env.example frontend/.env.local
Set-Location frontend
npm ci
npm run dev
```

`frontend/.env.example` contains the verified Studionet contract address. No secret is required. Open the local URL printed by Vite and use a supported wallet configured for Studionet.

## Tests and verification

```powershell
pytest tests/direct -q --cache-clear
Set-Location frontend
npm ci
npm run typecheck
npm run test -- --run
npm run build
npm audit --omit=dev
```

Verified results: 75 Direct Mode tests passed; 45 frontend tests in 6 files passed; TypeScript typecheck and production build passed; production dependency audit found 0 vulnerabilities. Vite reports a non-blocking main-chunk size warning. The package intentionally has no lint script, so no lint result is claimed.

## Deployment

The release contract was deployed from the exact reviewed source on Studionet (`61999`) in Normal/Full Consensus mode. `genlayer-js getContractCode` reproduces the approved source hash. The deployer is also the operator and sole Root Slot upgrader. An isolated same-source public `upgrade(bytes)` rehearsal reached finality and execution success without state or code drift. Full hashes, transactions, readbacks, and the failed encoding attempt are retained in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

The production frontend is deployed under the `pcong` Vercel team and reads the verified release contract through `VITE_CONTRACT_ADDRESS`. Its canonical production alias is linked above.

## Security and trust boundaries

- Event URLs must use HTTPS and the exact `earthquake.usgs.gov` host.
- Evidence digests are lowercase SHA-256 values and duplicate facility IDs/digests are rejected.
- Location buckets reject coordinate keywords and decimal-coordinate patterns.
- Fetched pages are treated as untrusted evidence, never prompt instructions.
- Evidence failure cannot create an eligible queue position.
- Operator, inspector, keeper, and upgrader permissions are enforced independently.
- Read pagination, capacities, retry counts, text lengths, and assignment deadlines are bounded.
- The selected EIP-6963 provider is retained for account request, chain switch, and client creation; no wallet RPC is made before selection.

## Known limitations

- Web evidence can change or become unavailable; digest mismatch deliberately yields `UNRESOLVED` and requires a new incident/evidence commitment for a fresh claim.
- Coarse location buckets protect against exact-coordinate publication but do not make all facility metadata anonymous.
- The release contract's demonstrated live path is the fail-closed evidence branch; score-band boundaries, queue/waitlist ordering, assignment lifecycle, and authorization are covered by Direct Mode tests.
- Upgrade authority depends on continued access to the recorded Studio account. If that account or Studionet state is lost, recovery may require a replacement deployment and complete re-verification.
