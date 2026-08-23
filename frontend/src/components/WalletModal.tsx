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
        style={{ maxWidth: '28rem', border: '1px solid var(--border-strong)' }}
      >
        {/* Dialog Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '1.25rem',
                height: '1.25rem',
                backgroundColor: 'var(--accent-teal)',
                color: '#ffffff',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.6875rem',
              }}
            >
              ⬡
            </span>
            <h3 id="wallet-dialog-title" style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--ink-primary)', margin: 0 }}>
              Connect Injected Wallet
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={closeChooser}
            disabled={isConnecting}
            aria-label="Close wallet connection dialog"
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', marginBottom: '1rem', lineHeight: 1.45 }}>
          Select an injected EIP-6963 provider. Zero RPC requests are dispatched until you choose an option.
        </p>

        {/* Error Alert */}
        {connectError && (
          <div
            role="alert"
            style={{
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--status-error-bg)',
              color: 'var(--status-error)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-xs)',
              marginBottom: '1rem',
              lineHeight: 1.45,
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
              backgroundColor: 'var(--canvas-subtle)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-xs)',
              color: 'var(--ink-muted)',
              lineHeight: 1.5,
            }}
          >
            No supported injected wallets (MetaMask, OKX, Rabby) detected via EIP-6963 in this browser window.
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
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                  width: '100%',
                  textAlign: 'left',
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
                        backgroundColor: 'var(--accent-seismic)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      W
                    </span>
                  )}
                  <span style={{ color: 'var(--ink-primary)' }}>{wallet.name}</span>
                </div>

                <span
                  className="badge badge-slate"
                  style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem' }}
                >
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
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-teal)',
              fontWeight: 700,
            }}
          >
            Awaiting wallet approval & chain verification...
          </div>
        )}
      </div>
    </div>
  );
};
