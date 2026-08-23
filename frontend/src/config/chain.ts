import { studionet } from 'genlayer-js/chains';

export const STUDIONET_CHAIN = studionet;
export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER_BASE = 'https://explorer-studio.genlayer.com';
export const STUDIONET_CURRENCY = 'GEN';

export function isValidAddress(address: unknown): address is `0x${string}` {
  if (typeof address !== 'string') return false;
  const clean = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) return false;
  if (/^0x0{40}$/.test(clean)) return false;
  return true;
}

export function getContractAddress(): `0x${string}` | null {
  const envAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
  if (isValidAddress(envAddress)) {
    // Studionet currently resolves intelligent-contract addresses case-sensitively.
    // Preserve the deployed checksum form; lowercasing makes valid contracts unreadable.
    return envAddress.trim() as `0x${string}`;
  }
  return null;
}

export function getExplorerTxUrl(hash: string): string {
  return `${STUDIONET_EXPLORER_BASE}/tx/${hash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${STUDIONET_EXPLORER_BASE}/address/${address}`;
}
