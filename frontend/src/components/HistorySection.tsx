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
    <section
      aria-label="Incident Audit Log"
      className="panel"
      style={{ marginBottom: '1.25rem', overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '0.875rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--canvas-subtle)',
        }}
      >
        <div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--ink-primary)', letterSpacing: '-0.01em' }}>
            Incident Audit Log ({totalCount} Events)
          </h3>
          <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)', marginTop: '0.125rem' }}>
            Immutable on-chain event sequence recorded on GenLayer Studionet.
          </p>
        </div>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: 'var(--ink-muted)', fontWeight: 600, fontSize: 'var(--text-2xs)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={offset === 0 || isLoading}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
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
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--ink-muted)',
            fontSize: 'var(--text-xs)',
            backgroundColor: '#ffffff',
          }}
        >
          No audit history events recorded for this incident yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#ffffff' }}>
          <table className="op-table">
            <thead>
              <tr>
                <th style={{ width: '4.5rem' }}>Seq #</th>
                <th style={{ width: '11rem' }}>Timestamp</th>
                <th style={{ width: '13rem' }}>Event Type</th>
                <th style={{ width: '10rem' }}>Actor</th>
                <th>Payload / Provenance Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.sequence}>
                  <td style={{ fontWeight: 800, color: 'var(--accent-seismic)' }}>
                    #{entry.sequence}
                  </td>
                  <td style={{ color: 'var(--ink-secondary)', fontSize: 'var(--text-2xs)' }}>
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td>
                    <span
                      className="badge badge-slate"
                      style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}
                    >
                      {entry.event_type}
                    </span>
                  </td>
                  <td>
                    <a
                      href={getExplorerAddressUrl(entry.actor)}
                      target="_blank"
                      rel="noreferrer"
                      className="mono"
                      style={{ color: 'var(--accent-teal)', fontWeight: 600, textDecoration: 'underline', fontSize: 'var(--text-2xs)' }}
                      title={entry.actor}
                    >
                      {formatAddress(entry.actor)} ↗
                    </a>
                  </td>
                  <td>
                    <pre
                      className="mono"
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontSize: '0.6875rem',
                        color: 'var(--ink-secondary)',
                        backgroundColor: 'var(--canvas-subtle)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-hairline)',
                        maxHeight: '4.5rem',
                        overflowY: 'auto',
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
