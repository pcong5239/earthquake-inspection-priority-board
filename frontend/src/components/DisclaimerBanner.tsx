import React from 'react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <aside
      className="disclaimer-banner"
      role="note"
      aria-label="Public Operational & Safety Disclaimer"
      style={{
        backgroundColor: 'var(--color-bg-canvas-subtle)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '0.625rem 1rem',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-ink-muted)',
        lineHeight: 1.4,
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            color: 'var(--color-hazard)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          Operational Coordination Demo
        </span>
        <span>
          This software is an autonomous smart-contract workflow demonstration on GenLayer Studionet. It does
          <strong> not</strong> provide official structural safety certifications, building occupancy determinations,
          emergency dispatch, or life-safety rescue instructions. All location buckets are coarse privacy-preserving
          identifiers.
        </span>
      </div>
    </aside>
  );
};
