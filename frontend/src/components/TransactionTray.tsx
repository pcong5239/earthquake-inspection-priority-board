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
        bottom: '1rem',
        right: '1rem',
        left: '1rem',
        maxWidth: '44rem',
        margin: '0 auto',
        backgroundColor: 'var(--color-bg-canvas)',
        border: isTerminalError
          ? '2px solid var(--color-error)'
          : isSuccess
          ? '2px solid var(--color-verified)'
          : '2px solid var(--color-hazard)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-tray)',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              backgroundColor: isTerminalError
                ? 'var(--color-error)'
                : isSuccess
                ? 'var(--color-verified)'
                : 'var(--color-hazard)',
            }}
          />
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0 }}>
            {txState.title || 'Transaction in Progress'}
          </h4>
        </div>

        {(isTerminalError || isSuccess) && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.125rem 0.375rem', fontSize: 'var(--font-size-xs)' }}
            onClick={dismissTransaction}
            aria-label="Dismiss transaction notification"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Phase Track */}
      {!isTerminalError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            marginBottom: '0.5rem',
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
                  padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-xs)',
                  whiteSpace: 'nowrap',
                  backgroundColor: isCurrent
                    ? 'var(--color-hazard)'
                    : isCompleted
                    ? 'var(--color-band-priority-bg)'
                    : 'var(--color-bg-canvas-subtle)',
                  color: isCurrent
                    ? 'var(--color-ink-inverse)'
                    : isCompleted
                    ? 'var(--color-verified)'
                    : 'var(--color-ink-muted)',
                  fontWeight: isCurrent || isCompleted ? 700 : 400,
                }}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Hash & Explorer Link */}
      {txState.hash && (
        <div style={{ fontSize: 'var(--font-size-xs)', marginBottom: '0.25rem' }}>
          <span style={{ color: 'var(--color-ink-muted)' }}>Tx Hash: </span>
          <a
            href={getExplorerTxUrl(txState.hash)}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
          >
            {formatAddress(txState.hash, 8)} ↗ (Explorer)
          </a>
        </div>
      )}

      {/* Message / Error Details */}
      {txState.error ? (
        <div
          role="alert"
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-error)',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {txState.error}
        </div>
      ) : (
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-ink-secondary)',
            lineHeight: 1.4,
          }}
        >
          {txState.details}
        </div>
      )}
    </aside>
  );
};
