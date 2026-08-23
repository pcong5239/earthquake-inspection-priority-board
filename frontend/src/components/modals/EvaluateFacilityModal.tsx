import React from 'react';
import type { FacilityRecord } from '../../types/contract';
import { useWallet } from '../../context/WalletContext';
import { useTransaction } from '../../context/TransactionContext';
import { evaluateFacility, fetchFacility } from '../../services/contractService';
import { getContractAddress } from '../../config/chain';
import { useModalDialog } from '../../hooks/useModalDialog';
import { pollUntilMatch } from '../../utils/readback';

interface EvaluateFacilityModalProps {
  isOpen: boolean;
  facility: FacilityRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export const EvaluateFacilityModal: React.FC<EvaluateFacilityModalProps> = ({
  isOpen,
  facility,
  onClose,
  onSuccess,
}) => {
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();
  const { modalRef } = useModalDialog({ isOpen, onClose });

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    const contractAddress = getContractAddress();
    if (!contractAddress || !walletState.address || !walletState.provider) {
      return;
    }

    onClose();

    await runTransaction(
      `Evaluate Facility: ${facility.facility_id}`,
      (onPhase) =>
        evaluateFacility(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          facility.incident_id,
          facility.record_id,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const fac = await fetchFacility(contractAddress, facility.incident_id, facility.record_id);
          if (
            fac &&
            (fac.status === 'DECIDED' || fac.status === 'UNRESOLVED') &&
            fac.evaluation_attempts > facility.evaluation_attempts
          ) {
            return true;
          }
          return false;
        });
        if (passed) {
          onSuccess();
          return true;
        }
        return false;
      }
    );
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluate-facility-title"
        className="modal-dialog"
        style={{ maxWidth: '30rem' }}
        tabIndex={-1}
      >
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
          <h3 id="evaluate-facility-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Evaluate Facility Consensus
          </h3>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--font-size-xs)' }}>
          <p>
            Trigger GenLayer decentralized consensus execution to evaluate <strong>{facility.facility_id}</strong>.
          </p>

          <div
            style={{
              padding: '0.625rem',
              backgroundColor: 'var(--color-bg-canvas-subtle)',
              borderRadius: 'var(--radius-xs)',
              lineHeight: 1.4,
            }}
          >
            <div><strong>Location Bucket:</strong> {facility.location_bucket}</div>
            <div><strong>Use Class:</strong> {facility.use_class} ({facility.occupancy_band})</div>
            <div><strong>Evidence URL:</strong> {facility.evidence_url}</div>
            <div className="mono" style={{ fontSize: '0.6875rem' }}>
              <strong>Expected SHA-256:</strong> {facility.expected_evidence_digest}
            </div>
          </div>

          <p style={{ color: 'var(--color-ink-muted)' }}>
            GenLayer validator nodes will fetch the evidence web page, verify the cryptographic hash, apply the triage policy rules, and return a consensus decision band (0-100 priority score).
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleEvaluate}>
              Run Consensus Evaluation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
