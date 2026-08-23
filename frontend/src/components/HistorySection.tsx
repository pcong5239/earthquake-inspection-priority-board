import React from 'react';
import type { HistoryEntry } from '../types/contract';
import { formatTimestamp, formatAddress, safeJsonStringify } from '../utils/formatters';
import { getExplorerAddressUrl } from '../config/chain';

interface HistorySectionProps {
  history: HistoryEntry[];
  totalCount: number;
  offset: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (newOffset: number) => void;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  history,
  totalCount,
  offset,
  limit,
  isLoading,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <section aria-label="Incident Audit Log" className="panel" style={{ marginBottom: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
            Incident Audit Log ({totalCount} Events)
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
            Immutable event history recorded on GenLayer Studionet.
          </p>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--font-size-xs)' }}>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem' }}
            disabled={offset === 0 || isLoading}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.5rem' }}
            disabled={offset + limit >= totalCount || isLoading}
            onClick={() => onPageChange(offset + limit)}
          >
            Next →
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            textAlign: 'center',
            color: 'var(--color-ink-muted)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          No audit history events recorded for this incident.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--font-size-xs)',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                <th style={{ padding: '0.5rem' }}>Seq #</th>
                <th style={{ padding: '0.5rem' }}>Timestamp</th>
                <th style={{ padding: '0.5rem' }}>Event Type</th>
                <th style={{ padding: '0.5rem' }}>Actor</th>
                <th style={{ padding: '0.5rem' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={entry.sequence}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>#{entry.sequence}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-ink-muted)' }}>
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <span
                      style={{
                        padding: '0.125rem 0.375rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--color-bg-canvas-subtle)',
                        border: '1px solid var(--color-border-subtle)',
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                      }}
                    >
                      {entry.event_type}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <a
                      href={getExplorerAddressUrl(entry.actor)}
                      target="_blank"
                      rel="noreferrer"
                      className="mono"
                      style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
                    >
                      {formatAddress(entry.actor)}
                    </a>
                  </td>
                  <td style={{ padding: '0.5rem', maxWidth: '24rem' }}>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontSize: '0.6875rem',
                        color: 'var(--color-ink-secondary)',
                      }}
                    >
                      {safeJsonStringify(entry.details)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
