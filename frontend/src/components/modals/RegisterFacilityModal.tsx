import React, { useState } from 'react';
import type { IncidentRecord, RegisterFacilityParams } from '../../types/contract';
import { useWallet } from '../../context/WalletContext';
import { useTransaction } from '../../context/TransactionContext';
import { registerFacility, fetchFacilityCount, fetchFacility } from '../../services/contractService';
import { getContractAddress } from '../../config/chain';
import { useModalDialog } from '../../hooks/useModalDialog';
import { pollUntilMatch } from '../../utils/readback';

interface RegisterFacilityModalProps {
  isOpen: boolean;
  incident: IncidentRecord;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterFacilityModal: React.FC<RegisterFacilityModalProps> = ({
  isOpen,
  incident,
  onClose,
  onSuccess,
}) => {
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();
  const { modalRef } = useModalDialog({ isOpen, onClose });

  const [facilityId, setFacilityId] = useState('');
  const [locationBucket, setLocationBucket] = useState(
    incident.allowed_location_buckets[0] || 'Sector-A'
  );
  const [useClass, setUseClass] = useState('HOSPITAL');
  const [ageBand, setAgeBand] = useState('PRE_1975');
  const [occupancyBand, setOccupancyBand] = useState('HIGH_DENSITY');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [expectedEvidenceDigest, setExpectedEvidenceDigest] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!facilityId.trim()) {
      newErrors.facilityId = 'Facility identifier is required.';
    }
    if (!locationBucket.trim()) {
      newErrors.locationBucket = 'Location bucket is required.';
    }
    if (!evidenceUrl.trim() || !evidenceUrl.startsWith('https://')) {
      newErrors.evidenceUrl = 'Evidence URL must be a valid HTTPS web resource.';
    }
    if (!/^[0-9a-fA-F]{64}$/.test(expectedEvidenceDigest.trim())) {
      newErrors.expectedEvidenceDigest = 'Digest must be a 64-character hexadecimal SHA-256 hash.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const contractAddress = getContractAddress();
    if (!contractAddress || !walletState.address || !walletState.provider) {
      setErrors({ form: 'Wallet or contract unconfigured.' });
      return;
    }

    const params: RegisterFacilityParams = {
      incident_id: incident.incident_id,
      facility_id: facilityId.trim(),
      location_bucket: locationBucket.trim(),
      use_class: useClass,
      age_band: ageBand,
      occupancy_band: occupancyBand,
      evidence_url: evidenceUrl.trim(),
      expected_evidence_digest: expectedEvidenceDigest.trim().toLowerCase(),
    };

    onClose();

    await runTransaction(
      `Register Facility: ${params.facility_id}`,
      (onPhase) =>
        registerFacility(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          params,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const count = await fetchFacilityCount(contractAddress, incident.incident_id);
          if (count > 0) {
            const fac = await fetchFacility(contractAddress, incident.incident_id, count);
            if (
              fac &&
              fac.facility_id === params.facility_id &&
              fac.expected_evidence_digest === params.expected_evidence_digest
            ) {
              return true;
            }
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
        aria-labelledby="register-facility-title"
        className="modal-dialog"
        style={{ maxWidth: '32rem' }}
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
          <h3 id="register-facility-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Register Facility in Incident #{incident.incident_id}
          </h3>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {errors.form && (
            <div role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)' }}>
              {errors.form}
            </div>
          )}

          <div>
            <label htmlFor="facId" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              Facility ID *
            </label>
            <input
              id="facId"
              type="text"
              className="input"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              placeholder="e.g. FAC-SAN-FRAN-101"
            />
            {errors.facilityId && <span className="field-error">{errors.facilityId}</span>}
          </div>

          <div>
            <label htmlFor="locBucket" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              Location Bucket *
            </label>
            <select
              id="locBucket"
              className="input"
              value={locationBucket}
              onChange={(e) => setLocationBucket(e.target.value)}
            >
              {incident.allowed_location_buckets.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.locationBucket && <span className="field-error">{errors.locationBucket}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label htmlFor="useClass" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Use Class
              </label>
              <select
                id="useClass"
                className="input"
                value={useClass}
                onChange={(e) => setUseClass(e.target.value)}
              >
                <option value="HOSPITAL">HOSPITAL</option>
                <option value="EMERGENCY_CENTER">EMERGENCY_CENTER</option>
                <option value="SCHOOL">SCHOOL</option>
                <option value="RESIDENTIAL_MULTI">RESIDENTIAL_MULTI</option>
                <option value="COMMERCIAL">COMMERCIAL</option>
                <option value="INDUSTRIAL">INDUSTRIAL</option>
              </select>
            </div>

            <div>
              <label htmlFor="ageBand" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Age Band
              </label>
              <select
                id="ageBand"
                className="input"
                value={ageBand}
                onChange={(e) => setAgeBand(e.target.value)}
              >
                <option value="PRE_1975">PRE_1975</option>
                <option value="1975_1995">1975_1995</option>
                <option value="POST_1995">POST_1995</option>
              </select>
            </div>

            <div>
              <label htmlFor="occBand" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Occupancy
              </label>
              <select
                id="occBand"
                className="input"
                value={occupancyBand}
                onChange={(e) => setOccupancyBand(e.target.value)}
              >
                <option value="HIGH_DENSITY">HIGH_DENSITY</option>
                <option value="MEDIUM_DENSITY">MEDIUM_DENSITY</option>
                <option value="LOW_DENSITY">LOW_DENSITY</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="evidenceUrl" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              Public Evidence HTTPS URL *
            </label>
            <input
              id="evidenceUrl"
              type="url"
              className="input"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://reports.emergency.gov/damage/facility-101.html"
            />
            {errors.evidenceUrl && <span className="field-error">{errors.evidenceUrl}</span>}
          </div>

          <div>
            <label
              htmlFor="expectedEvidenceDigest"
              style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
            >
              Expected Evidence SHA-256 Digest (64-hex) *
            </label>
            <input
              id="expectedEvidenceDigest"
              type="text"
              className="input mono"
              value={expectedEvidenceDigest}
              onChange={(e) => setExpectedEvidenceDigest(e.target.value)}
              placeholder="Lowercase 64-char hex hash of rendered evidence"
            />
            {errors.expectedEvidenceDigest && <span className="field-error">{errors.expectedEvidenceDigest}</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Register Facility
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
