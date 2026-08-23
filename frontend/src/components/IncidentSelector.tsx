import React from 'react';
import type { IncidentRecord, FacilityRecord } from '../types/contract';
import { formatIncidentStatus, formatTimestamp } from '../utils/formatters';
import { useWallet } from '../context/WalletContext';

interface IncidentSelectorProps {
  activeIncidents: number[];
  selectedIncidentId: number | null;
  selectedIncident: IncidentRecord | null;
  facilities: FacilityRecord[];
  queueCount: number;
  waitlistCount: number;
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
  facilities,
  queueCount,
  waitlistCount,
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

  // Compute operational metrics from verified reads
  const evaluatedCount = facilities.filter((f) => f.status === 'DECIDED').length;
  const unresolvedCount = facilities.filter((f) => f.status === 'UNRESOLVED').length;

  return (
    <section
      aria-label="Incident Control & Overview"
      className="panel"
      style={{ marginBottom: '1.25rem', overflow: 'hidden' }}
    >
      {/* 1. Operational Summary Metric Rail */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10.5rem, 1fr))',
          backgroundColor: 'var(--canvas-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Incidents
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--ink-primary)', marginTop: '0.125rem' }}>
            {activeIncidents.length}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Incident Phase
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            {statusInfo ? (
              <span className={`badge ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>None Active</span>
            )}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Registered Facilities
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--ink-primary)', marginTop: '0.125rem' }}>
            {selectedIncident ? selectedIncident.facility_count : '-'}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Evaluated / Unresolved
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '0.25rem' }}>
            {selectedIncident ? (
              <>
                <span style={{ color: 'var(--band-monitor-color)' }}>{evaluatedCount} Decided</span>
                <span style={{ color: 'var(--ink-faint)', margin: '0 0.375rem' }}>/</span>
                <span style={{ color: unresolvedCount > 0 ? 'var(--band-unresolved-color)' : 'var(--ink-muted)' }}>
                  {unresolvedCount} Unresolved
                </span>
              </>
            ) : (
              '-'
            )}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border-hairline)' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Allocated Capacity
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '0.25rem' }}>
            {selectedIncident ? (
              <span>
                {selectedIncident.allocated_count} / {selectedIncident.slot_count} Slots
              </span>
            ) : (
              '-'
            )}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: 'var(--text-3xs)', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Queue & Waitlist
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '0.25rem' }}>
            {selectedIncident ? (
              <>
                <span style={{ color: 'var(--accent-seismic)' }}>{queueCount} Q</span>
                <span style={{ color: 'var(--ink-faint)', margin: '0 0.375rem' }}>•</span>
                <span style={{ color: 'var(--accent-teal)' }}>{waitlistCount} Wait</span>
              </>
            ) : (
              '-'
            )}
          </div>
        </div>
      </div>

      {/* 2. Selector Controls & Action Toolbar */}
      <div
        style={{
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          backgroundColor: '#ffffff',
          borderBottom: selectedIncident ? '1px solid var(--border-hairline)' : 'none',
        }}
      >
        {/* Incident Select Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label htmlFor="incident-select" style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Incident:
          </label>
          {activeIncidents.length === 0 ? (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              No active incidents on record
            </span>
          ) : (
            <select
              id="incident-select"
              value={selectedIncidentId ?? ''}
              onChange={(e) => onSelectIncident(Number(e.target.value))}
              disabled={isLoading}
              className="form-select"
              style={{
                width: 'auto',
                minWidth: '12rem',
                fontWeight: 700,
                fontSize: 'var(--text-xs)',
                backgroundColor: 'var(--canvas-subtle)',
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

        {/* Workflow Lifecycle Action Buttons (Role Gated) */}
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
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--ink-secondary)',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'var(--canvas-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                }}
              >
                Cohort Locked — Run evaluations below
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

      {/* 3. Selected Incident Briefing & USGS Cryptographic Provenance */}
      {selectedIncident && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#ffffff',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(13.5rem, 1fr))',
            gap: '0.875rem',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              Region / Event ID
            </div>
            <div style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>
              {selectedIncident.region_label} ({selectedIncident.event_id})
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              Event Timestamp
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
              {formatTimestamp(selectedIncident.event_occurred_at)}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              Capacity & Timeout
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
              {selectedIncident.slot_count} Slots • {selectedIncident.assignment_timeout_seconds}s Timeout
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              Facility Counts
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
              {selectedIncident.facility_count} Total • {selectedIncident.allocated_count} Allocated
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              Location Buckets (Coarse)
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {selectedIncident.allowed_location_buckets.map((b) => (
                <span
                  key={b}
                  style={{
                    backgroundColor: 'var(--canvas-subtle)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 600,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', paddingTop: '0.5rem', borderTop: '1px solid var(--border-hairline)' }}>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>
              USGS Event Source & Expected Digest
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <a
                href={selectedIncident.event_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'underline' }}
              >
                {selectedIncident.event_url} ↗
              </a>
              <span
                className="mono"
                style={{
                  fontSize: 'var(--text-2xs)',
                  color: 'var(--ink-secondary)',
                  backgroundColor: 'var(--canvas-subtle)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                }}
                title={selectedIncident.expected_event_digest}
              >
                SHA-256: {selectedIncident.expected_event_digest.slice(0, 20)}...
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
