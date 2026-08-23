import React from 'react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <aside
      className="disclaimer-banner"
      role="note"
      aria-label="Public Operational & Safety Disclaimer"
      style={{
        backgroundColor: '#1b232e',
        color: '#d1d5db',
        borderBottom: '1px solid #2e3846',
        padding: '0.4375rem 1rem',
        fontSize: 'var(--text-2xs)',
        lineHeight: 1.45,
      }}
    >
      <div
        style={{
          maxWidth: '86rem',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.125rem 0.375rem',
            backgroundColor: 'rgba(210, 67, 23, 0.25)',
            border: '1px solid rgba(210, 67, 23, 0.5)',
            borderRadius: 'var(--radius-xs)',
            color: '#f97316',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.625rem',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>⚠</span> Operational Coordination Demo
        </span>
        <span style={{ color: '#cbd5e1' }}>
          This software is an autonomous smart-contract workflow demonstration on GenLayer Studionet. It does{' '}
          <strong style={{ color: '#f8fafc' }}>not</strong> provide official structural safety certifications, building occupancy determinations,
          emergency dispatch, or life-safety rescue instructions. All location buckets are coarse privacy-preserving identifiers.
        </span>
      </div>
    </aside>
  );
};
