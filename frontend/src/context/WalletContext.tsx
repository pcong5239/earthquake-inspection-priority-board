import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  SupportedWalletBrand,
  EIP1193Provider,
  WalletState,
  WalletOption,
} from '../types/wallet';
import {
  STUDIONET_CHAIN_ID,
  STUDIONET_CHAIN_ID_HEX,
  STUDIONET_RPC_URL,
  STUDIONET_CURRENCY,
  STUDIONET_EXPLORER_BASE,
  isValidAddress,
} from '../config/chain';

interface WalletContextValue {
  walletState: WalletState;
  discoveredWallets: WalletOption[];
  isChooserOpen: boolean;
  isConnecting: boolean;
  connectError: string | null;
  openChooser: () => void;
  closeChooser: () => void;
  connectWallet: (option: WalletOption) => Promise<void>;
  disconnectWallet: () => void;
  switchChain: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const BRAND_RDNS_MAP: Record<string, SupportedWalletBrand> = {
  'io.metamask': 'metamask',
  'com.okex.wallet': 'okx',
  'io.rabby': 'rabby',
};

const BRAND_NAMES: Record<SupportedWalletBrand, string> = {
  metamask: 'MetaMask',
  okx: 'OKX Wallet',
  rabby: 'Rabby Wallet',
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    brand: null,
    provider: null,
    chainId: null,
    isStudionet: false,
  });

  const [discoveredWallets, setDiscoveredWallets] = useState<WalletOption[]>([]);
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const seenUuidsRef = useRef<Set<string>>(new Set());
  const seenProvidersRef = useRef<Set<EIP1193Provider>>(new Set());
  const activeListenersRef = useRef<{
    provider: EIP1193Provider;
    onAccountsChanged: (accounts: unknown) => void;
    onChainChanged: (chainId: unknown) => void;
  } | null>(null);

  // EIP-6963 Discovery listener
  useEffect(() => {
    const handleAnnouncement = (event: Event) => {
      const customEvent = event as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }>;
      if (!customEvent.detail || !customEvent.detail.info || !customEvent.detail.provider) {
        return;
      }

      const { info, provider } = customEvent.detail;
      const brand = BRAND_RDNS_MAP[info.rdns];
      if (!brand) {
        // Unknown or unsupported brand
        return;
      }

      if (seenUuidsRef.current.has(info.uuid) || seenProvidersRef.current.has(provider)) {
        return;
      }

      seenUuidsRef.current.add(info.uuid);
      seenProvidersRef.current.add(provider);

      setDiscoveredWallets((prev) => {
        // Filter out any legacy fallback if real EIP-6963 provider arrived
        const filtered = prev.filter((w) => !w.id.startsWith('fallback-'));
        return [
          ...filtered,
          {
            id: info.uuid,
            name: info.name || BRAND_NAMES[brand],
            brand,
            icon: info.icon,
            provider,
          },
        ];
      });
    };

    window.addEventListener('eip6963:announceProvider', handleAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Check bounded legacy fallback if nothing announced after short interval
    const fallbackTimer = setTimeout(() => {
      if (seenProvidersRef.current.size === 0 && typeof window !== 'undefined') {
        const anyWindow = window as any;
        const legacyProvider = anyWindow.ethereum as EIP1193Provider | undefined;
        if (legacyProvider && typeof legacyProvider.request === 'function') {
          let detectedBrand: SupportedWalletBrand | null = null;
          if (legacyProvider.isRabby) detectedBrand = 'rabby';
          else if (legacyProvider.isOkxWallet || legacyProvider.isOKExWallet) detectedBrand = 'okx';
          else if (legacyProvider.isMetaMask) detectedBrand = 'metamask';

          if (detectedBrand && !seenProvidersRef.current.has(legacyProvider)) {
            seenProvidersRef.current.add(legacyProvider);
            setDiscoveredWallets([
              {
                id: `fallback-${detectedBrand}`,
                name: BRAND_NAMES[detectedBrand],
                brand: detectedBrand,
                icon: '',
                provider: legacyProvider,
              },
            ]);
          }
        }
      }
    }, 200);

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const cleanupActiveListeners = useCallback(() => {
    if (activeListenersRef.current) {
      const { provider, onAccountsChanged, onChainChanged } = activeListenersRef.current;
      if (typeof provider.removeListener === 'function') {
        provider.removeListener('accountsChanged', onAccountsChanged);
        provider.removeListener('chainChanged', onChainChanged);
      }
      activeListenersRef.current = null;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    cleanupActiveListeners();
    setWalletState({
      isConnected: false,
      address: null,
      brand: null,
      provider: null,
      chainId: null,
      isStudionet: false,
    });
    setConnectError(null);
  }, [cleanupActiveListeners]);

  const switchChainOnProvider = useCallback(async (provider: EIP1193Provider): Promise<boolean> => {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // 4902 indicates that the chain has not been added to the wallet
      if (switchError?.code === 4902 || switchError?.message?.includes('4902') || switchError?.data?.originalError?.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: STUDIONET_CHAIN_ID_HEX,
                chainName: 'GenLayer Studionet',
                rpcUrls: [STUDIONET_RPC_URL],
                nativeCurrency: {
                  name: STUDIONET_CURRENCY,
                  symbol: STUDIONET_CURRENCY,
                  decimals: 18,
                },
                blockExplorerUrls: [STUDIONET_EXPLORER_BASE],
              },
            ],
          });
          // Retry switch once
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
          });
          return true;
        } catch (addError: any) {
          setConnectError(`Failed to add Studionet to wallet: ${addError?.message || String(addError)}`);
          return false;
        }
      }
      setConnectError(`Failed to switch to Studionet (Chain ID 61999): ${switchError?.message || String(switchError)}`);
      return false;
    }
  }, []);

  const connectWallet = useCallback(
    async (option: WalletOption) => {
      setIsConnecting(true);
      setConnectError(null);

      const targetProvider = option.provider;

      try {
        const accountsRaw = await targetProvider.request({
          method: 'eth_requestAccounts',
        });

        if (!Array.isArray(accountsRaw) || accountsRaw.length === 0) {
          throw new Error('No accounts authorized or returned by wallet.');
        }

        const rawAddress = accountsRaw[0];
        if (!isValidAddress(rawAddress)) {
          throw new Error(`Invalid address returned: ${String(rawAddress)}`);
        }

        const normalizedAddress = rawAddress.toLowerCase();

        // Check Chain ID
        const chainIdRaw = (await targetProvider.request({
          method: 'eth_chainId',
        })) as string;

        let currentChainId = chainIdRaw;
        let isStudio =
          String(chainIdRaw).toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase() ||
          parseInt(String(chainIdRaw), 16) === STUDIONET_CHAIN_ID ||
          String(chainIdRaw) === String(STUDIONET_CHAIN_ID);

        if (!isStudio) {
          const switched = await switchChainOnProvider(targetProvider);
          if (switched) {
            const newChainId = (await targetProvider.request({
              method: 'eth_chainId',
            })) as string;
            currentChainId = newChainId;
            isStudio =
              String(newChainId).toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase() ||
              parseInt(String(newChainId), 16) === STUDIONET_CHAIN_ID ||
              String(newChainId) === String(STUDIONET_CHAIN_ID);
          }
        }

        if (!isStudio) {
          throw new Error('Wallet must be on GenLayer Studionet (Chain ID 61999) before connecting.');
        }

        // Setup session and event listeners
        cleanupActiveListeners();

        const onAccountsChanged = (accounts: unknown) => {
          if (!Array.isArray(accounts) || accounts.length === 0) {
            disconnectWallet();
          } else {
            const nextAddr = accounts[0];
            if (isValidAddress(nextAddr)) {
              setWalletState((prev) => ({
                ...prev,
                address: nextAddr.toLowerCase(),
              }));
            } else {
              disconnectWallet();
            }
          }
        };

        const onChainChanged = (chainId: unknown) => {
          const cIdStr = String(chainId);
          const isNowStudio =
            cIdStr.toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase() ||
            parseInt(cIdStr, 16) === STUDIONET_CHAIN_ID ||
            cIdStr === String(STUDIONET_CHAIN_ID);

          setWalletState((prev) => ({
            ...prev,
            chainId: cIdStr,
            isStudionet: isNowStudio,
          }));
        };

        if (typeof targetProvider.on === 'function') {
          targetProvider.on('accountsChanged', onAccountsChanged);
          targetProvider.on('chainChanged', onChainChanged);
        }

        activeListenersRef.current = {
          provider: targetProvider,
          onAccountsChanged,
          onChainChanged,
        };

        setWalletState({
          isConnected: true,
          address: normalizedAddress,
          brand: option.brand,
          provider: targetProvider,
          chainId: currentChainId,
          isStudionet: isStudio,
        });

        setIsChooserOpen(false);
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
          setConnectError('Connection request was rejected in the wallet.');
        } else {
          setConnectError(msg);
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [cleanupActiveListeners, disconnectWallet, switchChainOnProvider]
  );

  const switchChain = useCallback(async (): Promise<boolean> => {
    if (!walletState.provider) return false;
    const ok = await switchChainOnProvider(walletState.provider);
    if (ok) {
      try {
        const postChainId = (await walletState.provider.request({
          method: 'eth_chainId',
        })) as string;
        const isNowStudio =
          String(postChainId).toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase() ||
          parseInt(String(postChainId), 16) === STUDIONET_CHAIN_ID ||
          String(postChainId) === String(STUDIONET_CHAIN_ID);

        setWalletState((prev) => ({
          ...prev,
          isStudionet: isNowStudio,
          chainId: postChainId,
        }));
        return isNowStudio;
      } catch {
        setWalletState((prev) => ({
          ...prev,
          isStudionet: false,
        }));
        return false;
      }
    }
    return false;
  }, [walletState.provider, switchChainOnProvider]);

  const openChooser = useCallback(() => {
    setConnectError(null);
    setIsChooserOpen(true);
  }, []);

  const closeChooser = useCallback(() => {
    if (!isConnecting) {
      setIsChooserOpen(false);
      setConnectError(null);
    }
  }, [isConnecting]);

  return (
    <WalletContext.Provider
      value={{
        walletState,
        discoveredWallets,
        isChooserOpen,
        isConnecting,
        connectError,
        openChooser,
        closeChooser,
        connectWallet,
        disconnectWallet,
        switchChain,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
