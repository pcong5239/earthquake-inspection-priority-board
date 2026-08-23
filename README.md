# Earthquake Inspection Priority Board

GenLayer Studionet application for evidence-bound post-earthquake facility inspection prioritization.

## Live contract

- Network: Studionet (`61999`)
- Contract: `0x1032C6e107863b4798B519929e7565e33DAd5cA1`
- Explorer: https://explorer-studio.genlayer.com/address/0x1032C6e107863b4798B519929e7565e33DAd5cA1
- Deployment and live verification: `docs/VERIFICATION.md`

## Local verification

```powershell
pytest tests/direct -q --cache-clear
Set-Location frontend
npm ci
npm run typecheck
npm run test -- --run
npm run build
npm audit --omit=dev
```

Copy `frontend/.env.example` to `frontend/.env.local` for local use. The frontend deliberately starts disconnected after every reload and discovers MetaMask, OKX Wallet, and Rabby through EIP-6963 before making wallet RPC requests.
