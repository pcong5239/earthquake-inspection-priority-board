import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { WalletProvider, useWallet } from '../context/WalletContext';
import { WalletModal } from '../components/WalletModal';
import type { EIP1193Provider } from '../types/wallet';

const TestWalletConsumer = () => {
  const { walletState, openChooser, disconnectWallet, discoveredWallets, connectError } = useWallet();
  return (
    <div>
      <div data-testid="status">{walletState.isConnected ? 'CONNECTED' : 'DISCONNECTED'}</div>
      <div data-testid="address">{walletState.address || 'none'}</div>
      <div data-testid="brand">{walletState.brand || 'none'}</div>
      <div data-testid="network">{walletState.isStudionet ? 'STUDIONET' : 'WRONG'}</div>
      <div data-testid="connect-error">{connectError || 'none'}</div>
      <div data-testid="wallet-count">{discoveredWallets.length}</div>
      <button type="button" onClick={openChooser}>
        Open Chooser
      </button>
      <button type="button" onClick={disconnectWallet}>
        Disconnect
      </button>
    </div>
  );
};

describe('EIP-6963 Discovery and Exact-Object Wallet Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('discovers supported EIP-6963 providers and ignores unrecognized reverse-DNS IDs', async () => {
    render(
      <WalletProvider>
        <TestWalletConsumer />
        <WalletModal />
      </WalletProvider>
    );

    const mockMetaMaskProvider: EIP1193Provider = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockOkxProvider: EIP1193Provider = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockFakeProvider: EIP1193Provider = {
      request: vi.fn(),
    };

    // Announce MetaMask
    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-mm-1',
              name: 'MetaMask Injected',
              icon: 'data:image/svg+xml;base64,...',
              rdns: 'io.metamask',
            },
            provider: mockMetaMaskProvider,
          },
        })
      );
    });

    // Announce OKX
    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-okx-1',
              name: 'OKX Wallet',
              icon: 'data:image/svg+xml;base64,...',
              rdns: 'com.okex.wallet',
            },
            provider: mockOkxProvider,
          },
        })
      );
    });

    // Announce Unrecognized / Forged provider
    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-fake-1',
              name: 'Fake Wallet',
              icon: '',
              rdns: 'com.unrecognized.wallet',
            },
            provider: mockFakeProvider,
          },
        })
      );
    });

    // Repeat announcement with same UUID (deduplication check)
    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-mm-1',
              name: 'MetaMask Injected Duplicate',
              icon: '',
              rdns: 'io.metamask',
            },
            provider: mockMetaMaskProvider,
          },
        })
      );
    });

    expect(screen.getByTestId('wallet-count').textContent).toBe('2');

    // Open Chooser Dialog
    fireEvent.click(screen.getByText('Open Chooser'));
    expect(screen.getByText('Connect Injected Wallet')).not.toBeNull();
    expect(screen.getByText('MetaMask Injected')).not.toBeNull();
    expect(screen.getByText('OKX Wallet')).not.toBeNull();
    expect(screen.queryByText('Fake Wallet')).toBeNull();
  });

  it('opening chooser causes zero RPC requests until an option is clicked', async () => {
    const mockProvider: EIP1193Provider = {
      request: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    render(
      <WalletProvider>
        <TestWalletConsumer />
        <WalletModal />
      </WalletProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-rabby-1',
              name: 'Rabby Wallet',
              icon: '',
              rdns: 'io.rabby',
            },
            provider: mockProvider,
          },
        })
      );
    });

    fireEvent.click(screen.getByText('Open Chooser'));
    expect(mockProvider.request).not.toHaveBeenCalled();

    // Close chooser via close button
    fireEvent.click(screen.getByLabelText('Close wallet connection dialog'));
    expect(mockProvider.request).not.toHaveBeenCalled();
  });

  it('clicking an option calls eth_requestAccounts and binds exact provider', async () => {
    const mockProvider: EIP1193Provider = {
      request: vi.fn().mockImplementation(async ({ method }) => {
        if (method === 'eth_requestAccounts') {
          return ['0x1234567890123456789012345678901234567890'];
        }
        if (method === 'eth_chainId') {
          return '0xf22f'; // 61999 Studionet
        }
        return null;
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    render(
      <WalletProvider>
        <TestWalletConsumer />
        <WalletModal />
      </WalletProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-mm-exact',
              name: 'MetaMask',
              icon: '',
              rdns: 'io.metamask',
            },
            provider: mockProvider,
          },
        })
      );
    });

    fireEvent.click(screen.getByText('Open Chooser'));
    fireEvent.click(screen.getByText('MetaMask'));

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('CONNECTED');
    });

    expect(screen.getByTestId('address').textContent).toBe(
      '0x1234567890123456789012345678901234567890'
    );
    expect(screen.getByTestId('brand').textContent).toBe('metamask');
    expect(mockProvider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  it('handles chain switch and 4902 add-and-retry when chain is not Studionet', async () => {
    let currentChain = '0x1'; // Ethereum Mainnet

    const mockProvider: EIP1193Provider = {
      request: vi.fn().mockImplementation(async ({ method }) => {
        if (method === 'eth_requestAccounts') {
          return ['0x1234567890123456789012345678901234567890'];
        }
        if (method === 'eth_chainId') {
          return currentChain;
        }
        if (method === 'wallet_switchEthereumChain') {
          if (currentChain === '0x1') {
            const err: any = new Error('Chain not added');
            err.code = 4902;
            throw err;
          }
          currentChain = '0xf22f';
          return null;
        }
        if (method === 'wallet_addEthereumChain') {
          currentChain = '0xf22f';
          return null;
        }
        return null;
      }),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    render(
      <WalletProvider>
        <TestWalletConsumer />
        <WalletModal />
      </WalletProvider>
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'uuid-okx-switch',
              name: 'OKX',
              icon: '',
              rdns: 'com.okex.wallet',
            },
            provider: mockProvider,
          },
        })
      );
    });

    fireEvent.click(screen.getByText('Open Chooser'));
    fireEvent.click(screen.getByText('OKX'));

    await waitFor(() => {
      expect(mockProvider.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'wallet_addEthereumChain' })
      );
    });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('CONNECTED'));
    expect(screen.getByTestId('network').textContent).toBe('STUDIONET');
  });

  it('fails closed when the wallet reports the wrong chain after a successful switch request', async () => {
    const provider: EIP1193Provider = {
      request: vi.fn().mockImplementation(async ({ method }) => {
        if (method === 'eth_requestAccounts') return ['0x1234567890123456789012345678901234567890'];
        if (method === 'eth_chainId') return '0x1';
        if (method === 'wallet_switchEthereumChain') return null;
        return null;
      }),
    };
    render(<WalletProvider><TestWalletConsumer /><WalletModal /></WalletProvider>);
    act(() => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
      info: { uuid: 'rabby-wrong-chain', name: 'Rabby', icon: '', rdns: 'io.rabby' }, provider,
    }})));
    fireEvent.click(screen.getByText('Open Chooser'));
    fireEvent.click(screen.getByText('Rabby'));
    await waitFor(() => expect(screen.getByTestId('connect-error').textContent).toContain('Studionet'));
    expect(screen.getByTestId('status').textContent).toBe('DISCONNECTED');
    expect(screen.getByTestId('address').textContent).toBe('none');
  });

  it('fails closed when switching to Studionet is rejected', async () => {
    const provider: EIP1193Provider = {
      request: vi.fn().mockImplementation(async ({ method }) => {
        if (method === 'eth_requestAccounts') return ['0x1234567890123456789012345678901234567890'];
        if (method === 'eth_chainId') return '0x1';
        if (method === 'wallet_switchEthereumChain') throw new Error('switch rejected');
        return null;
      }),
    };
    render(<WalletProvider><TestWalletConsumer /><WalletModal /></WalletProvider>);
    act(() => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
      info: { uuid: 'mm-switch-failed', name: 'MetaMask Failed', icon: '', rdns: 'io.metamask' }, provider,
    }})));
    fireEvent.click(screen.getByText('Open Chooser'));
    fireEvent.click(screen.getByText('MetaMask Failed'));
    await waitFor(() => expect(screen.getByTestId('connect-error').textContent).toContain('Studionet'));
    expect(screen.getByTestId('status').textContent).toBe('DISCONNECTED');
  });
});
