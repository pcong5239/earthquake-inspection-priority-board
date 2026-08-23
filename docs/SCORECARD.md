# GenLayer submission category and scorecard

Category: `PROJECT`

Validity gate: `PASS`

The submission contains a real GenLayer Intelligent Contract, consensus-critical web-evidence evaluation, a frontend connected to the submitted Studionet deployment, reproducible source and tests, and public release evidence. Blocking workflow gates remain controlling regardless of these scores.

## GenLayer fit: 4/5

Evidence: GenLayer validators independently fetch the exact committed USGS and facility response bytes, verify SHA-256 digests, rerun the policy classification, and constrain consequential agreement before deterministic allocation. The live transaction ledger proves both fail-closed mismatch handling and successful consensus evaluation through deterministic allocation on Studionet.

Inspected evidence: `contracts/earthquake_inspection_priority_board.py`; Direct Mode consensus tests; release transactions and readbacks in `docs/VERIFICATION.md`; release contract and Explorer.

Weakness: the evidence sources are purpose-built public test fixtures for a coordination demonstration, not official structural-safety determinations.

## Contract quality: 4/5

Evidence: the contract implements bounded incident, facility, evaluation, allocation, assignment, reclaim, closure, history, pagination, operator transfer, and Root Slot upgrade state machines. Validator checks independently refetch evidence, bind exact consequential fields and observed digests, reject cross-band drift, and limit retries. Eighty-three Direct Mode tests and the finalized live matrix cover positive and negative paths.

Inspected evidence: contract source; 83 Direct Mode tests; `genvm-lint`; complete transaction ledger; authoritative readbacks; exact deployed-code hash parity.

Weakness: Studionet is a development network whose shared validator/RPC capacity can delay otherwise valid operations.

## Engineering: 4/5

Evidence: isolated pinned project, public reproducible repository, strict runtime guards, serialized transient-retrying RPC reads, fail-closed metadata availability, live-shape transaction finality/execution/readback reconciliation, 83 contract tests, 56 frontend tests, passing typecheck/build, zero production dependency vulnerabilities, and exact deployed-source hash parity.

Inspected evidence: public Git tree; Git/Vercel deployment logs; test and build output; `requirements-dev.txt`; `package-lock.json`; `vercel.json`; `docs/VERIFICATION.md`.

Weakness: the production JavaScript entry chunk is approximately 837 kB minified and triggers Vite's non-blocking chunk-size warning.

## Frontend / UX: 4/5

Evidence: the production seismic operations dashboard exposes authoritative contract reads, role-gated actions, queue/waitlist and history surfaces, accessible dialogs, explicit transaction phases, MetaMask/OKX/Rabby EIP-6963 discovery, exact-provider binding, wrong-network handling, and disconnected-on-reload behavior. Live Chrome testing with OKX completed incident creation, two facility registrations and evaluations, allocation, offer, expiry/reclaim/promotion, re-offer, deadline acknowledgment, and closure. Every successful transaction was independently verified as `FINALIZED / MAJORITY_AGREE / SUCCESS` with authoritative readback.

Inspected evidence: production Vercel application; frontend source and tests; Chrome live E2E; contract/Explorer links.

Weakness: persistent upstream Studionet unavailability can still surface the honest fail-closed retry screen; the client cannot guarantee capacity when the shared development RPC has none.

## Overall evidence-based assessment

This is a strong end-to-end GenLayer project with a consensus-critical decision, substantive contract state machine, reproducible engineering evidence, and a usable live frontend. It deliberately avoids structural-safety or emergency-response claims and fails closed when evidence or authoritative contract state cannot be verified.

Submission recommendation: `READY`, subject to mandatory dual `POST_GITHUB_VERCEL_FINAL` approval for this exact revision and evidence package.
