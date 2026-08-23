import React from 'react';
import type { IncidentRecord } from '../../types/contract';
import { useWallet } from '../../context/WalletContext';
import { useTransaction } from '../../context/TransactionContext';
import { closeIncident, fetchIncident, fetchActiveIncidents } from '../../services/contractService';
import { getContractAddress } from '../../config/chain';
import { useModalDialog } from '../../hooks/useModalDialog';
import { pollUntilMatch } from '../../utils/readback';

interface CloseIncidentModalProps {
  isOpen: boolean;
  incident: IncidentRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseIncidentModal: React.FC<CloseIncidentModalProps> = ({
  isOpen,
  incident,
  onClose,
  onSuccess,
}) => {
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();
  const { modalRef } = useModalDialog({ isOpen, onClose });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const contractAddress = getContractAddress();
    if (!contractAddress || !walletState.address || !walletState.provider) {
      return;
    }

    onClose();

    await runTransaction(
      `Close Incident #${incident.incident_id}`,
      (onPhase) =>
        closeIncident(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          incident.incident_id,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const [inc, actives] = await Promise.all([
            fetchIncident(contractAddress, incident.incident_id).catch(() => null),
            fetchActiveIncidents(contractAddress).catch((): number[] => []),
          ]);
          if (inc && inc.status === 'CLOSED' && !actives.includes(incident.incident_id)) {
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
        aria-labelledby="close-incident-title"
        className="modal-dialog"
        style={{ maxWidth: '28rem' }}
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
          <h3 id="close-incident-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Close Incident #{incident.incident_id}
          </h3>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
            Closing the incident transitions it to terminal <strong>CLOSED</strong> status on-chain and releases its active tracking slot. This action cannot be reversed.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              Confirm Close Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
