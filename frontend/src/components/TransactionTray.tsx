import React from 'react';
import { useTransaction } from '../context/TransactionContext';
import { getExplorerTxUrl } from '../config/chain';
import { formatAddress } from '../utils/formatters';

const PHASES_FLOW = [
  { key: 'VALIDATING', label: '1. Validate' },
  { key: 'AWAITING_SIGNATURE', label: '2. Sign' },
  { key: 'SUBMITTED', label: '3. Submit' },
  { key: 'CONSENSUS', label: '4. Consensus' },
  { key: 'FINALIZED', label: '5. Finalize' },
  { key: 'EXECUTION_VERIFIED', label: '6. Exec Verified' },
  { key: 'READBACK_VERIFIED', label: '7. Readback' },
  { key: 'SUCCESS', label: '8. Success' },
];

export const TransactionTray: React.FC = () => {
  const { txState, dismissTransaction } = useTransaction();

  if (txState.phase === 'IDLE') {
    return null;
  }

  const isTerminalError = [
    'REJECTED',
    'EXECUTION_ERROR',
    'TIMEOUT',
    'READBACK_ERROR',
    'CONFIG_ERROR',
  ].includes(txState.phase);

  const isSuccess = txState.phase === 'SUCCESS';

  const currentPhaseIndex = PHASES_FLOW.findIndex((p) => p.key === txState.phase);

  return (
    <aside
      aria-label="Transaction Reconciliation Progress Tray"
      role="region"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        left: '1.25rem',
        maxWidth: '46rem',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        border: isTerminalError
          ? '2px solid var(--status-error)'
          : isSuccess
          ? '2px solid var(--status-success)'
          : '2px solid var(--accent-seismic)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-tray)',
        padding: '1rem 1.25rem',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isTerminalError
                ? 'var(--status-error)'
                : isSuccess
                ? 'var(--status-success)'
                : 'var(--accent-seismic)',
            }}
          />
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--ink-primary)', margin: 0 }}>
            {txState.title || 'Transaction in Progress'}
          </h4>
        </div>

        {(isTerminalError || isSuccess) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={dismissTransaction}
            aria-label="Dismiss transaction notification"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Step-Based Phase Track */}
      {!isTerminalError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            overflowX: 'auto',
            paddingBottom: '0.375rem',
            marginBottom: '0.625rem',
          }}
        >
          {PHASES_FLOW.map((p, idx) => {
            const isCompleted = currentPhaseIndex >= idx;
            const isCurrent = p.key === txState.phase;

            return (
              <span
                key={p.key}
                style={{
                  fontSize: '0.6875rem',
                  padding: '0.2rem 0.4375rem',
                  borderRadius: 'var(--radius-xs)',
                  whiteSpace: 'nowrap',
                  backgroundColor: isCurrent
                    ? 'var(--accent-seismic)'
                    : isCompleted
                    ? 'var(--accent-teal-subtle)'
                    : 'var(--canvas-subtle)',
                  color: isCurrent
                    ? '#ffffff'
                    : isCompleted
                    ? 'var(--accent-teal)'
                    : 'var(--ink-muted)',
                  border: isCurrent
                    ? '1px solid var(--accent-seismic)'
                    : isCompleted
                    ? '1px solid var(--accent-teal-border)'
                    : '1px solid var(--border-hairline)',
                  fontWeight: isCurrent || isCompleted ? 700 : 500,
                }}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Tx Hash & Explorer Link */}
      {txState.hash && (
        <div style={{ fontSize: 'var(--text-xs)', marginBottom: '0.375rem' }}>
          <span style={{ color: 'var(--ink-muted)' }}>Transaction: </span>
          <a
            href={getExplorerTxUrl(txState.hash)}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'underline' }}
          >
            {formatAddress(txState.hash, 8)} ↗ (Studionet Explorer)
          </a>
        </div>
      )}

      {/* Error or Progress Detail */}
      {txState.error ? (
        <div
          role="alert"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--status-error)',
            fontWeight: 600,
            lineHeight: 1.45,
            backgroundColor: 'var(--status-error-bg)',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--status-error-border)',
          }}
        >
          {txState.error}
        </div>
      ) : (
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--ink-secondary)',
            lineHeight: 1.45,
          }}
        >
          {txState.details}
        </div>
      )}
    </aside>
  );
};
