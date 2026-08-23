import React from 'react';
import { useWallet } from '../context/WalletContext';
import { formatAddress } from '../utils/formatters';
import { getContractAddress, getExplorerAddressUrl } from '../config/chain';

interface HeaderProps {
  contractOperator: string | null;
  contractVersion: number | null;
  onOpenCreateIncident: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  contractOperator,
  contractVersion,
  onOpenCreateIncident,
}) => {
  const { walletState, openChooser, disconnectWallet, switchChain } = useWallet();
  const contractAddress = getContractAddress();

  const isOperator =
    Boolean(walletState.isConnected &&
    walletState.isStudionet &&
    walletState.address &&
    contractOperator &&
    walletState.address.toLowerCase() === contractOperator.toLowerCase());

  return (
    <header
      style={{
        backgroundColor: 'var(--color-bg-canvas)',
        borderBottom: '1px solid var(--color-border-default)',
        padding: '0.75rem 1rem',
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Brand / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '1.25rem',
              height: '1.25rem',
              backgroundColor: 'var(--color-hazard)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: 'var(--color-ink-inverse)',
              fontSize: '0.75rem',
            }}
          >
            !
          </div>
          <div>
            <h1
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 700,
                color: 'var(--color-ink-primary)',
                lineHeight: 1.2,
              }}
            >
              Earthquake Inspection Priority Board
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-ink-muted)',
              }}
            >
              <span>GenLayer Studionet (61999)</span>
              {contractVersion !== null && (
                <>
                  <span>•</span>
                  <span>v{contractVersion}</span>
                </>
              )}
              {contractAddress ? (
                <>
                  <span>•</span>
                  <a
                    href={getExplorerAddressUrl(contractAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono"
                    style={{ textDecoration: 'underline' }}
                    title={`Contract: ${contractAddress}`}
                  >
                    {formatAddress(contractAddress)}
                  </a>
                </>
              ) : (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--color-hazard)', fontWeight: 600 }}>
                    Contract Address Unconfigured
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Operator Action: Create Incident */}
          {contractAddress && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenCreateIncident}
              disabled={!isOperator}
              title={
                isOperator
                  ? 'Create a new earthquake triage incident'
                  : 'Requires connected Operator wallet'
              }
              aria-label="Create Incident"
            >
              + Create Incident
            </button>
          )}

          {/* Wallet State */}
          {walletState.isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {!walletState.isStudionet && (
                <button
                  type="button"
                  className="btn"
                  style={{
                    backgroundColor: 'var(--color-band-immediate-bg)',
                    color: 'var(--color-hazard)',
                    borderColor: 'var(--color-hazard)',
                  }}
                  onClick={switchChain}
                  title="Switch wallet network to GenLayer Studionet"
                >
                  Wrong Network (Switch)
                </button>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-canvas-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                {isOperator && (
                  <span
                    className="badge badge-priority"
                    style={{ fontSize: '0.6875rem' }}
                    title="Connected wallet is the authorized Contract Operator"
                  >
                    OPERATOR
                  </span>
                )}
                <span className="mono" title={walletState.address ?? ''}>
                  {formatAddress(walletState.address)}
                </span>
                <span style={{ color: 'var(--color-ink-muted)', textTransform: 'capitalize' }}>
                  ({walletState.brand || 'Injected'})
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={disconnectWallet}
                title="Disconnect wallet session"
                aria-label="Disconnect Wallet"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openChooser}
              aria-label="Connect Injected Wallet"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
