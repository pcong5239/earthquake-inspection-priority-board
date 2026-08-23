import React from 'react';
import type { FacilityRecord, IncidentRecord } from '../types/contract';
import {
  formatDecisionBand,
  formatEvidenceStatus,
  formatAssignmentStatus,
  formatFacilityStatus,
  formatReasonCode,
  formatTimestamp,
  formatAddress,
} from '../utils/formatters';
import { useWallet } from '../context/WalletContext';
import { getExplorerAddressUrl } from '../config/chain';

interface FacilityDetailPaneProps {
  facility: FacilityRecord;
  incident: IncidentRecord;
  contractOperator: string | null;
  onClose: () => void;
  onEvaluate: () => void;
  onOfferAssignment: () => void;
  onAcknowledgeAssignment: () => void;
  onReclaimAssignment: () => void;
}

export const FacilityDetailPane: React.FC<FacilityDetailPaneProps> = ({
  facility,
  incident,
  contractOperator,
  onClose,
  onEvaluate,
  onOfferAssignment,
  onAcknowledgeAssignment,
  onReclaimAssignment,
}) => {
  const { walletState } = useWallet();

  const isOperator = Boolean(
    walletState.isConnected &&
      walletState.isStudionet &&
      walletState.address &&
      contractOperator &&
      walletState.address.toLowerCase() === contractOperator.toLowerCase()
  );

  const isAssignedInspector = Boolean(
    walletState.isConnected &&
      walletState.isStudionet &&
      walletState.address &&
      facility.assigned_inspector &&
      walletState.address.toLowerCase() === facility.assigned_inspector.toLowerCase()
  );

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isOfferActive =
    facility.assignment_status === 'OFFERED' && facility.assignment_deadline > nowSeconds;
  const isOfferExpired =
    facility.assignment_status === 'OFFERED' && facility.assignment_deadline <= nowSeconds;

  const canEvaluate =
    (incident.status === 'COHORT_LOCKED' || incident.status === 'EVALUATING') &&
    (facility.status === 'LOCKED' || facility.status === 'UNRESOLVED') &&
    walletState.isConnected && walletState.isStudionet;

  const canOffer =
    isOperator &&
    facility.decision === 'PRIORITY_QUEUE' &&
    facility.queue_position > 0 &&
    (facility.assignment_status === 'NONE' ||
      facility.assignment_status === 'EXPIRED' ||
      isOfferExpired);

  const canAcknowledge = isAssignedInspector && isOfferActive;

  const canReclaim = isOfferExpired && walletState.isConnected && walletState.isStudionet;

  const decisionInfo = formatDecisionBand(facility.decision);
  const evidenceInfo = formatEvidenceStatus(facility.evidence_status);
  const assignmentInfo = formatAssignmentStatus(facility.assignment_status);
  const facilityStatusInfo = formatFacilityStatus(facility.status);

  return (
    <aside
      aria-label="Facility Detail Inspector"
      className="panel"
      style={{
        marginBottom: '1.25rem',
        border: '1px solid var(--accent-teal)',
        boxShadow: 'var(--shadow-elevated)',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Pane Header */}
      <div
        style={{
          padding: '0.875rem 1rem',
          backgroundColor: 'var(--accent-teal-subtle)',
          borderBottom: '1px solid var(--accent-teal-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--accent-teal)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
            Facility Record #{facility.record_id} • Incident #{facility.incident_id}
          </div>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--ink-primary)', marginTop: '0.125rem' }}>
            {facility.facility_id}
          </h3>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          aria-label="Close Facility Inspector"
        >
          ✕ Close
        </button>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Grid of Key Properties */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
            gap: '0.75rem',
            fontSize: 'var(--text-xs)',
            marginBottom: '1rem',
            paddingBottom: '0.875rem',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Status & Decision
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              <span className={`badge ${facilityStatusInfo.badgeClass}`}>{facilityStatusInfo.label}</span>
              <span className={`badge ${decisionInfo.badgeClass}`}>{decisionInfo.label}</span>
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Priority Score
            </div>
            <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--ink-primary)' }}>
              {facility.priority_score} / 100{' '}
              <span style={{ fontSize: 'var(--text-2xs)', color: facility.eligible ? 'var(--status-success)' : 'var(--ink-muted)' }}>
                {facility.eligible ? '• Eligible' : '• Ineligible'}
              </span>
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Location Bucket
            </div>
            <div style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>{facility.location_bucket}</div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Use & Occupancy
            </div>
            <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
              {facility.use_class} • {facility.occupancy_band} ({facility.age_band})
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Queue Allocation
            </div>
            <div style={{ fontWeight: 700, color: 'var(--accent-seismic)' }}>
              {facility.queue_position > 0
                ? `Queue Slot #${facility.queue_position}`
                : facility.waitlist_position > 0
                ? `Waitlist #${facility.waitlist_position}`
                : 'Unassigned'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Evidence Status
            </div>
            <div>
              <span className={`badge ${evidenceInfo.badgeClass}`}>{evidenceInfo.label}</span>
            </div>
          </div>
        </div>

        {/* Web Evidence Source & Digest */}
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--canvas-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 'var(--text-xs)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary)', marginBottom: '0.375rem' }}>
            Evidence Verification Payload
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Evidence URL: </span>
              <a
                href={facility.evidence_url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'underline' }}
              >
                {facility.evidence_url}
              </a>
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>Expected SHA-256 Digest: </span>
              <span className="mono" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)', wordBreak: 'break-all' }}>
                {facility.expected_evidence_digest}
              </span>
            </div>
          </div>
        </div>

        {/* Consensus Reason & Reason Codes */}
        {(facility.reason || facility.reason_codes.length > 0) && (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--canvas-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-xs)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary)', marginBottom: '0.375rem' }}>
              Consensus Evaluation Findings (Attempt #{facility.evaluation_attempts})
            </div>
            {facility.reason && (
              <p style={{ marginBottom: '0.5rem', lineHeight: 1.45, color: 'var(--ink-primary)' }}>
                {facility.reason}
              </p>
            )}
            {facility.reason_codes.length > 0 && (
              <div>
                <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Reason Codes:
                </div>
                <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: 1.5 }}>
                  {facility.reason_codes.map((code) => (
                    <li key={code}>
                      <strong style={{ color: 'var(--ink-primary)' }}>{code}:</strong> {formatReasonCode(code)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Assignment & Inspector Status */}
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--canvas-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 'var(--text-xs)',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.375rem',
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary)' }}>
              Inspection Assignment
            </span>
            <span className={`badge ${assignmentInfo.badgeClass}`}>{assignmentInfo.label}</span>
          </div>

          {facility.assigned_inspector && (
            <div style={{ marginBottom: '0.375rem' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Assigned Inspector: </span>
              <a
                href={getExplorerAddressUrl(facility.assigned_inspector)}
                target="_blank"
                rel="noreferrer"
                className="mono"
                style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'underline' }}
              >
                {facility.assigned_inspector} ↗
              </a>
            </div>
          )}

          {facility.offered_at > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.375rem', fontSize: 'var(--text-2xs)' }}>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>Offered At: </span>
                <span style={{ fontWeight: 600 }}>{formatTimestamp(facility.offered_at)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-muted)' }}>Deadline: </span>
                <span style={{ fontWeight: 600 }}>{formatTimestamp(facility.assignment_deadline)}</span>
              </div>
              {facility.acknowledged_at > 0 && (
                <div>
                  <span style={{ color: 'var(--ink-muted)' }}>Acknowledged At: </span>
                  <span style={{ fontWeight: 600 }}>{formatTimestamp(facility.acknowledged_at)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Evaluate Action (Permissionless on Studionet) */}
          {(incident.status === 'COHORT_LOCKED' || incident.status === 'EVALUATING') &&
            (facility.status === 'LOCKED' || facility.status === 'UNRESOLVED') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onEvaluate}
                disabled={!canEvaluate}
                title={
                  !walletState.isConnected
                    ? 'Connect wallet to execute evaluation'
                    : 'Trigger GenLayer consensus evaluation of web evidence and policy rules'
                }
              >
                Evaluate Facility (Consensus)
              </button>
            )}

          {/* Offer Assignment (Operator Only) */}
          {facility.decision === 'PRIORITY_QUEUE' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOfferAssignment}
              disabled={!canOffer}
              title={
                !isOperator
                  ? 'Requires Operator wallet'
                  : 'Offer assignment to an inspector address'
              }
            >
              Offer Assignment
            </button>
          )}

          {/* Acknowledge Assignment (Assigned Inspector Only) */}
          {facility.assignment_status === 'OFFERED' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAcknowledgeAssignment}
              disabled={!canAcknowledge}
              title={
                !walletState.isConnected
                  ? 'Connect assigned inspector wallet'
                  : !isAssignedInspector
                  ? `Only assigned inspector (${formatAddress(facility.assigned_inspector)}) can acknowledge`
                  : isOfferExpired
                  ? 'Offer deadline has expired'
                  : 'Acknowledge assignment offer'
              }
            >
              Acknowledge Assignment
            </button>
          )}

          {/* Reclaim Expired Assignment (Permissionless) */}
          {isOfferExpired && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onReclaimAssignment}
              disabled={!canReclaim}
              title="Reclaim expired offer to restore queue slot for new assignment"
            >
              Reclaim Expired Assignment
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
