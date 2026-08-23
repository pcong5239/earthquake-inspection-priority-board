import React, { useState } from 'react';
import type { CreateIncidentParams } from '../../types/contract';
import { useWallet } from '../../context/WalletContext';
import { useTransaction } from '../../context/TransactionContext';
import { createIncident, fetchIncidentCount, fetchIncident } from '../../services/contractService';
import { getContractAddress } from '../../config/chain';
import { useModalDialog } from '../../hooks/useModalDialog';
import { pollUntilMatch } from '../../utils/readback';

interface CreateIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();
  const { modalRef } = useModalDialog({ isOpen, onClose });

  const [eventId, setEventId] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [expectedDigest, setExpectedDigest] = useState('');
  const [regionLabel, setRegionLabel] = useState('');
  const [locationBucketsStr, setLocationBucketsStr] = useState('Sector-A, Sector-B, Sector-C');
  const [eventOccurredAtStr, setEventOccurredAtStr] = useState(() =>
    new Date(Date.now() - 3600_000).toISOString().slice(0, 16)
  );
  const [maxAgeSeconds, setMaxAgeSeconds] = useState(604800); // 7 days
  const [slotCount, setSlotCount] = useState(5);
  const [timeoutSeconds, setTimeoutSeconds] = useState(86400); // 24 hours
  const [policyText, setPolicyText] = useState(
    'Prioritize immediate triage of high occupancy medical and emergency facilities in affected sectors.'
  );
  const [policyVersion, setPolicyVersion] = useState(1);

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!eventId.trim() || eventId.trim().length > 128) {
      newErrors.eventId = 'Event ID must be 1-128 characters.';
    }
    if (
      !eventUrl.trim() ||
      eventUrl.trim().length > 512 ||
      !eventUrl.startsWith('https://earthquake.usgs.gov/')
    ) {
      newErrors.eventUrl = 'Event URL must begin with https://earthquake.usgs.gov/';
    }
    if (!/^[0-9a-fA-F]{64}$/.test(expectedDigest.trim())) {
      newErrors.expectedDigest = 'Digest must be a 64-character hexadecimal SHA-256 hash.';
    }
    if (!regionLabel.trim() || regionLabel.trim().length > 128) {
      newErrors.regionLabel = 'Region label must be 1-128 characters.';
    }

    const buckets = locationBucketsStr
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    if (buckets.length === 0) {
      newErrors.locationBuckets = 'At least one location bucket is required.';
    } else if (
      buckets.length > 32 ||
      new Set(buckets).size !== buckets.length ||
      buckets.some((bucket) =>
        bucket.length > 128 || /lat|lon|gps|coord|degree|°/i.test(bucket) || /-?\d+\.\d+/.test(bucket)
      )
    ) {
      newErrors.locationBuckets = 'Use 1-32 unique coarse labels (max 128 chars; no coordinates).';
    }

    const occurredAtSeconds = Math.floor(new Date(eventOccurredAtStr).getTime() / 1000);
    if (isNaN(occurredAtSeconds) || occurredAtSeconds <= 0) {
      newErrors.eventOccurredAt = 'Valid occurrence timestamp is required.';
    }

    if (slotCount < 1 || slotCount > 24) {
      newErrors.slotCount = 'Slot count must be between 1 and 24.';
    }
    if (timeoutSeconds < 60 || timeoutSeconds > 604800) {
      newErrors.timeoutSeconds = 'Timeout must be between 60s and 604800s (7 days).';
    }
    if (maxAgeSeconds < 1 || maxAgeSeconds > 31536000) {
      newErrors.maxAgeSeconds = 'Max event age must be between 1 and 31536000 seconds.';
    }
    if (policyVersion < 1) {
      newErrors.policyVersion = 'Policy version must be a positive integer.';
    }
    if (!policyText.trim() || policyText.trim().length > 2000) {
      newErrors.policyText = 'Policy text must be 1-2000 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const contractAddress = getContractAddress();
    if (!contractAddress || !walletState.address || !walletState.provider) {
      setErrors({ form: 'Wallet or contract address unconfigured.' });
      return;
    }

    const buckets = locationBucketsStr
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    const occurredAtSeconds = Math.floor(new Date(eventOccurredAtStr).getTime() / 1000);

    const params: CreateIncidentParams = {
      event_id: eventId.trim(),
      event_url: eventUrl.trim(),
      expected_event_digest: expectedDigest.trim().toLowerCase(),
      region_label: regionLabel.trim(),
      allowed_location_buckets: buckets,
      event_occurred_at: occurredAtSeconds,
      max_event_age_seconds: Number(maxAgeSeconds),
      slot_count: Number(slotCount),
      assignment_timeout_seconds: Number(timeoutSeconds),
      policy_text: policyText.trim(),
      policy_version: Number(policyVersion),
    };

    onClose();

    await runTransaction(
      `Create Incident: ${params.region_label}`,
      (onPhase) =>
        createIncident(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          params,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const count = await fetchIncidentCount(contractAddress);
          if (count > 0) {
            const inc = await fetchIncident(contractAddress, count);
            if (inc && inc.event_id === params.event_id) {
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
        aria-labelledby="create-incident-title"
        className="modal-dialog"
        style={{ maxWidth: '36rem' }}
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
          <h3 id="create-incident-title" style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: 0 }}>
            Create Earthquake Triage Incident
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
            <label htmlFor="eventId" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              USGS Event ID *
            </label>
            <input
              id="eventId"
              type="text"
              className="input"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="e.g. us7000m97q"
            />
            {errors.eventId && <span className="field-error">{errors.eventId}</span>}
          </div>

          <div>
            <label htmlFor="eventUrl" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              USGS Event HTTPS URL *
            </label>
            <input
              id="eventUrl"
              type="url"
              className="input"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
              placeholder="https://earthquake.usgs.gov/earthquakes/eventpage/us7000m97q"
            />
            {errors.eventUrl && <span className="field-error">{errors.eventUrl}</span>}
          </div>

          <div>
            <label
              htmlFor="expectedDigest"
              style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
            >
              Expected SHA-256 Digest (64-hex) *
            </label>
            <input
              id="expectedDigest"
              type="text"
              className="input mono"
              value={expectedDigest}
              onChange={(e) => setExpectedDigest(e.target.value)}
              placeholder="Lowercase 64-char hex hash"
            />
            {errors.expectedDigest && <span className="field-error">{errors.expectedDigest}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="regionLabel" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Region Label *
              </label>
              <input
                id="regionLabel"
                type="text"
                className="input"
                value={regionLabel}
                onChange={(e) => setRegionLabel(e.target.value)}
                placeholder="e.g. Bay Area Sector 4"
              />
              {errors.regionLabel && <span className="field-error">{errors.regionLabel}</span>}
            </div>

            <div>
              <label htmlFor="occurredAt" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Event Occurrence Time *
              </label>
              <input
                id="occurredAt"
                type="datetime-local"
                className="input"
                value={eventOccurredAtStr}
                onChange={(e) => setEventOccurredAtStr(e.target.value)}
              />
              {errors.eventOccurredAt && <span className="field-error">{errors.eventOccurredAt}</span>}
            </div>
          </div>

          <div>
            <label htmlFor="locationBuckets" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              Allowed Location Buckets (comma-separated coarse labels) *
            </label>
            <input
              id="locationBuckets"
              type="text"
              className="input"
              value={locationBucketsStr}
              onChange={(e) => setLocationBucketsStr(e.target.value)}
              placeholder="Sector-A, Sector-B, Sector-C"
            />
            {errors.locationBuckets && <span className="field-error">{errors.locationBuckets}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="slotCount" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Priority Queue Slots (1-24) *
              </label>
              <input
                id="slotCount"
                type="number"
                min={1}
                max={24}
                className="input"
                value={slotCount}
                onChange={(e) => setSlotCount(Number(e.target.value))}
              />
              {errors.slotCount && <span className="field-error">{errors.slotCount}</span>}
            </div>

            <div>
              <label
                htmlFor="timeoutSeconds"
                style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}
              >
                Assignment Timeout (seconds) *
              </label>
              <input
                id="timeoutSeconds"
                type="number"
                min={60}
                max={604800}
                className="input"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              />
              {errors.timeoutSeconds && <span className="field-error">{errors.timeoutSeconds}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="maxAgeSeconds" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Max Event Age (seconds) *
              </label>
              <input
                id="maxAgeSeconds"
                type="number"
                min={1}
                max={31536000}
                className="input"
                value={maxAgeSeconds}
                onChange={(e) => setMaxAgeSeconds(Number(e.target.value))}
              />
              {errors.maxAgeSeconds && <span className="field-error">{errors.maxAgeSeconds}</span>}
            </div>

            <div>
              <label htmlFor="policyVersion" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                Policy Version *
              </label>
              <input
                id="policyVersion"
                type="number"
                min={1}
                className="input"
                value={policyVersion}
                onChange={(e) => setPolicyVersion(Number(e.target.value))}
              />
              {errors.policyVersion && <span className="field-error">{errors.policyVersion}</span>}
            </div>
          </div>

          <div>
            <label htmlFor="policyText" style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
              Triage Policy Guidance *
            </label>
            <textarea
              id="policyText"
              className="input"
              rows={3}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
            />
            {errors.policyText && <span className="field-error">{errors.policyText}</span>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
