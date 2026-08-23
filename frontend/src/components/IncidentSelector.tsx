import React from 'react';
import type { IncidentRecord } from '../types/contract';
import { formatIncidentStatus, formatTimestamp } from '../utils/formatters';
import { useWallet } from '../context/WalletContext';

interface IncidentSelectorProps {
  activeIncidents: number[];
  selectedIncidentId: number | null;
  selectedIncident: IncidentRecord | null;
  isLoading: boolean;
  contractOperator: string | null;
  onSelectIncident: (id: number) => void;
  onRegisterFacility: () => void;
  onLockCohort: () => void;
  onFinalizeAllocation: () => void;
  onCloseIncident: () => void;
}

export const IncidentSelector: React.FC<IncidentSelectorProps> = ({
  activeIncidents,
  selectedIncidentId,
  selectedIncident,
  isLoading,
  contractOperator,
  onSelectIncident,
  onRegisterFacility,
  onLockCohort,
  onFinalizeAllocation,
  onCloseIncident,
}) => {
  const { walletState } = useWallet();

  const isOperator = Boolean(
    walletState.isConnected &&
      walletState.isStudionet &&
      walletState.address &&
      contractOperator &&
      walletState.address.toLowerCase() === contractOperator.toLowerCase()
  );

  const statusInfo = selectedIncident ? formatIncidentStatus(selectedIncident.status) : null;

  return (
    <section
      aria-label="Incident Control & Overview"
      className="panel"
      style={{ marginBottom: '1rem' }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.75rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.75rem',
        }}
      >
        {/* Incident Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="incident-select" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            Active Incident:
          </label>
          {activeIncidents.length === 0 ? (
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-ink-muted)' }}>
              No active incidents on record
            </span>
          ) : (
            <select
              id="incident-select"
              value={selectedIncidentId ?? ''}
              onChange={(e) => onSelectIncident(Number(e.target.value))}
              disabled={isLoading}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-bg-canvas)',
                color: 'var(--color-ink-primary)',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {activeIncidents.map((id) => (
                <option key={id} value={id}>
                  Incident #{id}
                </option>
              ))}
            </select>
          )}

          {selectedIncident && statusInfo && (
            <span className={`badge ${statusInfo.badgeClass}`}>
              {statusInfo.label}
            </span>
          )}
        </div>

        {/* Workflow Lifecycle Action Buttons */}
        {selectedIncident && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedIncident.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onRegisterFacility}
                  disabled={!isOperator}
                  title={isOperator ? 'Register facility in current cohort' : 'Requires Operator wallet'}
                >
                  + Register Facility
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onLockCohort}
                  disabled={!isOperator || selectedIncident.facility_count === 0}
                  title={
                    !isOperator
                      ? 'Requires Operator wallet'
                      : selectedIncident.facility_count === 0
                      ? 'Add at least one facility before locking cohort'
                      : 'Lock facility cohort to begin consensus evaluation'
                  }
                >
                  Lock Cohort
                </button>
              </>
            )}

            {selectedIncident.status === 'COHORT_LOCKED' && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-ink-muted)',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'var(--color-bg-canvas-subtle)',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                Cohort Locked — Evaluate facilities below
              </span>
            )}

            {(selectedIncident.status === 'COHORT_LOCKED' || selectedIncident.status === 'EVALUATING') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onFinalizeAllocation}
                disabled={!walletState.isConnected || !walletState.isStudionet}
                title={
                  !walletState.isConnected || !walletState.isStudionet
                    ? 'Connect a wallet on Studionet to finalize allocation'
                    : 'Finalize queue and waitlist allocations for all evaluated facilities'
                }
              >
                Finalize Allocation
              </button>
            )}

            {selectedIncident.status !== 'CLOSED' && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={onCloseIncident}
                disabled={!isOperator}
                title={isOperator ? 'Close incident and release active state' : 'Requires Operator wallet'}
              >
                Close Incident
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected Incident Details Bar */}
      {selectedIncident && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
            gap: '0.75rem',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <div>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Region / Event ID</div>
            <div style={{ fontWeight: 600 }}>
              {selectedIncident.region_label} ({selectedIncident.event_id})
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Occurred At</div>
            <div style={{ fontWeight: 600 }}>{formatTimestamp(selectedIncident.event_occurred_at)}</div>
          </div>

          <div>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Capacity & Timeout</div>
            <div style={{ fontWeight: 600 }}>
              {selectedIncident.slot_count} Slots • {selectedIncident.assignment_timeout_seconds}s Timeout
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Facility Counts</div>
            <div style={{ fontWeight: 600 }}>
              {selectedIncident.facility_count} Total • {selectedIncident.allocated_count} Allocated
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Location Buckets</div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {selectedIncident.allowed_location_buckets.map((b) => (
                <span
                  key={b}
                  style={{
                    backgroundColor: 'var(--color-bg-canvas-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.6875rem',
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>USGS Event Source & Digest</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href={selectedIncident.event_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
              >
                {selectedIncident.event_url}
              </a>
              <span className="mono" style={{ color: 'var(--color-ink-muted)', fontSize: '0.6875rem' }} title={selectedIncident.expected_event_digest}>
                SHA-256: {selectedIncident.expected_event_digest.slice(0, 16)}...
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
