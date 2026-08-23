import React, { useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';

export const WalletModal: React.FC = () => {
  const {
    isChooserOpen,
    isConnecting,
    connectError,
    discoveredWallets,
    closeChooser,
    connectWallet,
  } = useWallet();

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus trap & Escape listener
  useEffect(() => {
    if (isChooserOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeChooser();
          return;
        }

        if (e.key === 'Tab' && dialogRef.current) {
          const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length === 0) return;

          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      // Auto-focus first button in modal
      setTimeout(() => {
        if (dialogRef.current) {
          const firstBtn = dialogRef.current.querySelector<HTMLButtonElement>('button');
          if (firstBtn) firstBtn.focus();
        }
      }, 50);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isChooserOpen, closeChooser]);

  if (!isChooserOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) {
          closeChooser();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-dialog-title"
        className="modal-dialog"
        style={{ maxWidth: '26rem' }}
      >
        {/* Dialog Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            paddingBottom: '0.75rem',
          }}
        >
          <h3 id="wallet-dialog-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Connect Injected Wallet
          </h3>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
            onClick={closeChooser}
            disabled={isConnecting}
            aria-label="Close wallet connection dialog"
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)', marginBottom: '1rem' }}>
          Select an injected EIP-6963 provider. Zero RPC requests are dispatched until you choose an option.
        </p>

        {/* Error Alert */}
        {connectError && (
          <div
            role="alert"
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--color-band-immediate-bg)',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              marginBottom: '1rem',
            }}
          >
            {connectError}
          </div>
        )}

        {/* Discovered Wallet List */}
        {discoveredWallets.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-canvas-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-ink-muted)',
            }}
          >
            No supported injected wallets (MetaMask, OKX, Rabby) detected via EIP-6963 in your browser.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {discoveredWallets.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className="btn btn-secondary"
                disabled={isConnecting}
                onClick={() => connectWallet(wallet)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 600,
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {wallet.icon ? (
                    <img
                      src={wallet.icon}
                      alt=""
                      style={{ width: '1.5rem', height: '1.5rem', borderRadius: 'var(--radius-xs)' }}
                    />
                  ) : (
                    <span
                      style={{
                        width: '1.5rem',
                        height: '1.5rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--color-hazard)',
                        color: 'var(--color-ink-inverse)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                      }}
                    >
                      W
                    </span>
                  )}
                  <span>{wallet.name}</span>
                </div>

                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                  {wallet.brand.toUpperCase()} ↗
                </span>
              </button>
            ))}
          </div>
        )}

        {isConnecting && (
          <div
            style={{
              marginTop: '1rem',
              textAlign: 'center',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-verified)',
              fontWeight: 600,
            }}
          >
            Requesting authorization in wallet...
          </div>
        )}
      </div>
    </div>
  );
};
