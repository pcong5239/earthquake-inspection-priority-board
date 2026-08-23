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
      style={{ marginBottom: '1rem', border: '1px solid var(--color-border-focus)' }}
    >
      {/* Pane Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
            Facility Record #{facility.record_id} • Incident #{facility.incident_id}
          </div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
            {facility.facility_id}
          </h3>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
          onClick={onClose}
          aria-label="Close Facility Inspector"
        >
          ✕ Close
        </button>
      </div>

      {/* Grid of Key Properties */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
          gap: '0.75rem',
          fontSize: 'var(--font-size-xs)',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Status & Decision</div>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            <span className={`badge ${facilityStatusInfo.badgeClass}`}>{facilityStatusInfo.label}</span>
            <span className={`badge ${decisionInfo.badgeClass}`}>{decisionInfo.label}</span>
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Priority Score</div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
            {facility.priority_score} / 100 {facility.eligible ? '• Eligible' : '• Ineligible'}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Location Bucket</div>
          <div style={{ fontWeight: 600 }}>{facility.location_bucket}</div>
        </div>

        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Use & Occupancy</div>
          <div style={{ fontWeight: 600 }}>
            {facility.use_class} • {facility.occupancy_band} ({facility.age_band})
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Queue Allocation</div>
          <div style={{ fontWeight: 600 }}>
            {facility.queue_position > 0
              ? `Queue Slot #${facility.queue_position}`
              : facility.waitlist_position > 0
              ? `Waitlist #${facility.waitlist_position}`
              : 'Unassigned'}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.125rem' }}>Evidence Status</div>
          <div>
            <span className={`badge ${evidenceInfo.badgeClass}`}>{evidenceInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Web Evidence Source & Digest */}
      <div
        style={{
          padding: '0.625rem',
          backgroundColor: 'var(--color-bg-canvas-subtle)',
          borderRadius: 'var(--radius-xs)',
          fontSize: 'var(--font-size-xs)',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Evidence Verification Payload</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div>
            <span style={{ color: 'var(--color-ink-muted)' }}>Evidence URL: </span>
            <a
              href={facility.evidence_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
            >
              {facility.evidence_url}
            </a>
          </div>
          <div>
            <span style={{ color: 'var(--color-ink-muted)' }}>Expected SHA-256 Digest: </span>
            <span className="mono" style={{ fontSize: '0.6875rem' }}>
              {facility.expected_evidence_digest}
            </span>
          </div>
        </div>
      </div>

      {/* Consensus Reason & Reason Codes */}
      {(facility.reason || facility.reason_codes.length > 0) && (
        <div
          style={{
            padding: '0.625rem',
            backgroundColor: 'var(--color-bg-canvas-subtle)',
            borderRadius: 'var(--radius-xs)',
            fontSize: 'var(--font-size-xs)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            Consensus Evaluation Findings (Attempt #{facility.evaluation_attempts})
          </div>
          {facility.reason && (
            <p style={{ marginBottom: '0.5rem', lineHeight: 1.4 }}>{facility.reason}</p>
          )}
          {facility.reason_codes.length > 0 && (
            <div>
              <div style={{ color: 'var(--color-ink-muted)', marginBottom: '0.25rem' }}>Reason Codes:</div>
              <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                {facility.reason_codes.map((code) => (
                  <li key={code}>
                    <strong>{code}:</strong> {formatReasonCode(code)}
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
          padding: '0.625rem',
          backgroundColor: 'var(--color-bg-canvas-subtle)',
          borderRadius: 'var(--radius-xs)',
          fontSize: 'var(--font-size-xs)',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.25rem',
          }}
        >
          <span style={{ fontWeight: 600 }}>Inspection Assignment</span>
          <span className={`badge ${assignmentInfo.badgeClass}`}>{assignmentInfo.label}</span>
        </div>

        {facility.assigned_inspector && (
          <div style={{ marginBottom: '0.25rem' }}>
            <span style={{ color: 'var(--color-ink-muted)' }}>Assigned Inspector: </span>
            <a
              href={getExplorerAddressUrl(facility.assigned_inspector)}
              target="_blank"
              rel="noreferrer"
              className="mono"
              style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
            >
              {facility.assigned_inspector}
            </a>
          </div>
        )}

        {facility.offered_at > 0 && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <div>
              <span style={{ color: 'var(--color-ink-muted)' }}>Offered At: </span>
              <span>{formatTimestamp(facility.offered_at)}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-ink-muted)' }}>Deadline: </span>
              <span>{formatTimestamp(facility.assignment_deadline)}</span>
            </div>
            {facility.acknowledged_at > 0 && (
              <div>
                <span style={{ color: 'var(--color-ink-muted)' }}>Acknowledged At: </span>
                <span>{formatTimestamp(facility.acknowledged_at)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Evaluate Action (Permissionless) */}
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
    </aside>
  );
};
