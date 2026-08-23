export type SupportedWalletBrand = 'metamask' | 'okx' | 'rabby';

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isRabby?: boolean;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
  brand: SupportedWalletBrand;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  brand: SupportedWalletBrand | null;
  provider: EIP1193Provider | null;
  chainId: string | null;
  isStudionet: boolean;
}

export interface WalletOption {
  id: string;
  name: string;
  brand: SupportedWalletBrand;
  icon: string;
  provider: EIP1193Provider;
}
