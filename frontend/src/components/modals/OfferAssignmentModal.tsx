import React, { useState } from 'react';
import type { FacilityRecord } from '../../types/contract';
import { useWallet } from '../../context/WalletContext';
import { useTransaction } from '../../context/TransactionContext';
import { offerAssignment, fetchFacility } from '../../services/contractService';
import { getContractAddress, isValidAddress } from '../../config/chain';
import { useModalDialog } from '../../hooks/useModalDialog';
import { pollUntilMatch } from '../../utils/readback';

interface OfferAssignmentModalProps {
  isOpen: boolean;
  facility: FacilityRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export const OfferAssignmentModal: React.FC<OfferAssignmentModalProps> = ({
  isOpen,
  facility,
  onClose,
  onSuccess,
}) => {
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();
  const { modalRef } = useModalDialog({ isOpen, onClose });

  const [inspectorAddress, setInspectorAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress(inspectorAddress.trim())) {
      setError('A valid 20-byte non-zero hex Ethereum address is required.');
      return;
    }

    const contractAddress = getContractAddress();
    if (!contractAddress || !walletState.address || !walletState.provider) {
      setError('Wallet or contract unconfigured.');
      return;
    }

    const targetInspector = inspectorAddress.trim().toLowerCase();
    onClose();

    await runTransaction(
      `Offer Assignment: ${facility.facility_id}`,
      (onPhase) =>
        offerAssignment(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          facility.incident_id,
          facility.record_id,
          targetInspector,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const fac = await fetchFacility(contractAddress, facility.incident_id, facility.record_id);
          if (
            fac &&
            fac.assignment_status === 'OFFERED' &&
            fac.assigned_inspector.toLowerCase() === targetInspector
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
        aria-labelledby="offer-assignment-title"
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
          <h3 id="offer-assignment-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Offer Assignment: {facility.facility_id}
          </h3>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {error && (
            <div role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)' }}>
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="inspectorAddr"
              style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
            >
              Qualified Inspector Address *
            </label>
            <input
              id="inspectorAddr"
              type="text"
              className="input mono"
              value={inspectorAddress}
              onChange={(e) => setInspectorAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
            The designated inspector must acknowledge the assignment before the incident timeout expires.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send Offer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
