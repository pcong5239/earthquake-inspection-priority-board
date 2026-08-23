import React from 'react';
import { useWallet } from '../context/WalletContext';
import { formatAddress } from '../utils/formatters';
import { getContractAddress, getExplorerAddressUrl } from '../config/chain';

interface HeaderProps {
  contractOperator: string | null;
  contractVersion: number | null;
  metadataStatus?: 'LOADING' | 'READY' | 'ERROR';
  onOpenCreateIncident: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  contractOperator,
  contractVersion,
  metadataStatus = 'READY',
  onOpenCreateIncident,
}) => {
  const { walletState, openChooser, disconnectWallet, switchChain } = useWallet();
  const contractAddress = getContractAddress();

  const isOperator = Boolean(
    metadataStatus === 'READY' &&
      walletState.isConnected &&
      walletState.isStudionet &&
      walletState.address &&
      contractOperator &&
      walletState.address.toLowerCase() === contractOperator.toLowerCase()
  );

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.75rem 1.25rem',
        boxShadow: '0 1px 3px 0 rgba(20, 27, 36, 0.04)',
      }}
    >
      <div
        style={{
          maxWidth: '86rem',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Brand / Product Title / Purpose */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div
            style={{
              width: '2rem',
              height: '2rem',
              backgroundColor: 'var(--accent-seismic)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#ffffff',
              fontSize: '1rem',
              boxShadow: '0 2px 4px rgba(210, 67, 23, 0.3)',
              flexShrink: 0,
            }}
          >
            ▲
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 800,
                  color: 'var(--ink-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                Earthquake Inspection Priority Board
              </h1>
              <span
                className="badge badge-teal"
                style={{ fontSize: '0.625rem', padding: '0.1rem 0.375rem' }}
                title="Connected to GenLayer Studionet decentralized network"
              >
                <span className="live-dot active" style={{ width: '5px', height: '5px' }} />
                Studionet (61999)
              </span>
              {contractVersion !== null && (
                <span
                  style={{
                    fontSize: 'var(--text-2xs)',
                    color: 'var(--ink-muted)',
                    fontWeight: 600,
                  }}
                >
                  v{contractVersion}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                fontSize: 'var(--text-2xs)',
                color: 'var(--ink-secondary)',
                marginTop: '0.125rem',
                flexWrap: 'wrap',
              }}
            >
              <span>Evidence-bound consensus triage without publishing exact facility coordinates</span>
              <span>•</span>
              {contractAddress ? (
                <a
                  href={getExplorerAddressUrl(contractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{ fontWeight: 600, color: 'var(--accent-teal)' }}
                  title={`Contract on Studionet Explorer: ${contractAddress}`}
                >
                  Contract: {formatAddress(contractAddress)} ↗
                </a>
              ) : (
                <span style={{ color: 'var(--accent-seismic)', fontWeight: 700 }}>
                  Contract Unconfigured
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Wallet Connection Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Operator Action: Create Incident */}
          {contractAddress && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenCreateIncident}
              disabled={!isOperator}
              title={
                isOperator
                  ? 'Create a new earthquake inspection triage incident on-chain'
                  : 'Requires connected Operator wallet'
              }
              aria-label="Create Incident"
            >
              + Create Incident
            </button>
          )}

          {/* Wallet State Area */}
          {walletState.isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {!walletState.isStudionet && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={switchChain}
                  title="Switch wallet network to GenLayer Studionet (Chain ID 61999)"
                >
                  Switch to Studionet
                </button>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--canvas-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {isOperator ? (
                  <span
                    className="badge badge-priority"
                    style={{ fontSize: '0.625rem' }}
                    title="Connected account matches the contract Operator address"
                  >
                    OPERATOR
                  </span>
                ) : (
                  <span
                    className="badge badge-slate"
                    style={{ fontSize: '0.625rem' }}
                    title="Connected as observer / public caller"
                  >
                    OBSERVER
                  </span>
                )}
                <span className="mono" style={{ fontWeight: 600 }} title={walletState.address ?? ''}>
                  {formatAddress(walletState.address)}
                </span>
                <span style={{ color: 'var(--ink-muted)', textTransform: 'capitalize', fontSize: 'var(--text-2xs)' }}>
                  ({walletState.brand || 'Injected'})
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
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
