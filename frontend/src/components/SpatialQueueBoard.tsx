import React, { useState } from 'react';
import type { FacilityRecord, IncidentRecord, QueueItem, WaitlistItem } from '../types/contract';
import { formatDecisionBand, formatEvidenceStatus, formatAssignmentStatus, formatAddress } from '../utils/formatters';

interface SpatialQueueBoardProps {
  incident: IncidentRecord;
  facilities: FacilityRecord[];
  queue: QueueItem[];
  waitlist: WaitlistItem[];
  selectedFacilityId: number | null;
  onSelectFacility: (recordId: number) => void;
}

export const SpatialQueueBoard: React.FC<SpatialQueueBoardProps> = ({
  incident,
  facilities,
  queue,
  waitlist,
  selectedFacilityId,
  onSelectFacility,
}) => {
  const [viewMode, setViewMode] = useState<'diagram' | 'accessible-list'>('diagram');

  // Group facilities by location bucket
  const bucketMap: Record<string, FacilityRecord[]> = {};
  for (const bucket of incident.allowed_location_buckets) {
    bucketMap[bucket] = [];
  }
  for (const fac of facilities) {
    if (!bucketMap[fac.location_bucket]) {
      bucketMap[fac.location_bucket] = [];
    }
    bucketMap[fac.location_bucket].push(fac);
  }

  return (
    <section
      aria-label="Spatial Queue and Region Diagram"
      className="panel"
      style={{ marginBottom: '1rem' }}
    >
      {/* View Switcher & Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
            Spatial Queue Diagram & Regional Buckets
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
            Coarse region cohort distribution, consensus evaluation scores, and priority queue slots.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            className={`btn ${viewMode === 'diagram' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 'var(--font-size-xs)', padding: '0.25rem 0.5rem' }}
            onClick={() => setViewMode('diagram')}
            aria-pressed={viewMode === 'diagram'}
          >
            Diagram View
          </button>
          <button
            type="button"
            className={`btn ${viewMode === 'accessible-list' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 'var(--font-size-xs)', padding: '0.25rem 0.5rem' }}
            onClick={() => setViewMode('accessible-list')}
            aria-pressed={viewMode === 'accessible-list'}
          >
            Accessible List
          </button>
        </div>
      </div>

      {viewMode === 'accessible-list' ? (
        /* Accessible Ordered List Equivalent */
        <div aria-label="Ordered Triage & Queue List">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '0.5rem' }}>
            Allocated Inspection Priority Queue ({queue.length}/{incident.slot_count} Slots)
          </h3>
          {queue.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
              No facilities currently allocated to priority queue.
            </p>
          ) : (
            <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem', fontSize: 'var(--font-size-sm)' }}>
              {queue.map((item) => (
                <li key={item.record_id} style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onSelectFacility(item.record_id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--color-ink-primary)',
                      textDecoration: 'underline',
                    }}
                  >
                    <strong>Position #{item.queue_position}:</strong> Facility {item.facility_id} ({item.location_bucket})
                    — Score: {item.priority_score} ({formatDecisionBand(item.decision).label})
                    — Assignment: {formatAssignmentStatus(item.assignment_status).label}
                    {item.assigned_inspector && ` to ${formatAddress(item.assigned_inspector)}`}
                  </button>
                </li>
              ))}
            </ol>
          )}

          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '0.5rem' }}>
            Waitlist Secondary Allocation ({waitlist.length} Facilities)
          </h3>
          {waitlist.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
              No facilities in waitlist.
            </p>
          ) : (
            <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem', fontSize: 'var(--font-size-sm)' }}>
              {waitlist.map((item) => (
                <li key={item.record_id} style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onSelectFacility(item.record_id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--color-ink-primary)',
                      textDecoration: 'underline',
                    }}
                  >
                    <strong>Waitlist #{item.waitlist_position}:</strong> Facility {item.facility_id} ({item.location_bucket})
                    — Score: {item.priority_score} ({formatDecisionBand(item.decision).label})
                  </button>
                </li>
              ))}
            </ol>
          )}

          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: '0.5rem' }}>
            All Registered Facilities ({facilities.length} Total)
          </h3>
          <ul style={{ paddingLeft: '1.25rem', fontSize: 'var(--font-size-sm)' }}>
            {facilities.map((fac) => (
              <li key={fac.record_id} style={{ marginBottom: '0.375rem' }}>
                <button
                  type="button"
                  onClick={() => onSelectFacility(fac.record_id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--color-ink-primary)',
                    textDecoration: 'underline',
                  }}
                >
                  Facility #{fac.record_id} ({fac.facility_id}) — Bucket: {fac.location_bucket}, Class: {fac.use_class},
                  Decision: {formatDecisionBand(fac.decision).label}, Status: {fac.status}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /* Spatial Diagram Layout */
        <div>
          {/* Priority Queue Dispatch Track (Top Banner) */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-canvas-subtle)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-hazard)' }}>
                DISPATCH QUEUE ({queue.length} / {incident.slot_count} Active Slots)
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                Timeout: {incident.assignment_timeout_seconds}s
              </span>
            </div>

            {queue.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'var(--color-ink-muted)',
                  fontSize: 'var(--font-size-xs)',
                  border: '1px dashed var(--color-border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                No facilities allocated to dispatch queue yet. Lock cohort, run evaluations, and finalize allocation.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
                  gap: '0.5rem',
                }}
              >
                {queue.map((q) => {
                  const isSelected = selectedFacilityId === q.record_id;
                  const decisionInfo = formatDecisionBand(q.decision);
                  const assignInfo = formatAssignmentStatus(q.assignment_status);

                  return (
                    <div
                      key={q.record_id}
                      onClick={() => onSelectFacility(q.record_id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectFacility(q.record_id);
                        }
                      }}
                      style={{
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isSelected
                          ? 'var(--color-bg-canvas)'
                          : 'var(--color-bg-canvas)',
                        border: isSelected
                          ? '2px solid var(--color-hazard)'
                          : '1px solid var(--color-border-default)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          Slot #{q.queue_position}
                        </span>
                        <span className={`badge ${decisionInfo.badgeClass}`}>
                          {q.priority_score} pts
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                        {q.facility_id}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-ink-muted)',
                        }}
                      >
                        <span>Bucket: {q.location_bucket}</span>
                        <span className={`badge ${assignInfo.badgeClass}`} style={{ fontSize: '0.625rem' }}>
                          {assignInfo.label}
                        </span>
                      </div>

                      {q.assigned_inspector && (
                        <div
                          className="mono"
                          style={{
                            fontSize: '0.625rem',
                            color: 'var(--color-verified)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          → {formatAddress(q.assigned_inspector)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Regional Spatial Coarse Location Buckets Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            {incident.allowed_location_buckets.map((bucket) => {
              const bucketFacilities = bucketMap[bucket] || [];

              return (
                <div
                  key={bucket}
                  style={{
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-canvas)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--color-bg-canvas-subtle)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                      Location: {bucket}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
                      {bucketFacilities.length} facilities
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      minHeight: '6rem',
                    }}
                  >
                    {bucketFacilities.length === 0 ? (
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-ink-muted)',
                          fontStyle: 'italic',
                          textAlign: 'center',
                          padding: '1rem 0',
                        }}
                      >
                        No registered facilities
                      </div>
                    ) : (
                      bucketFacilities.map((fac) => {
                        const isSelected = selectedFacilityId === fac.record_id;
                        const decisionInfo = formatDecisionBand(fac.decision);
                        const evidenceInfo = formatEvidenceStatus(fac.evidence_status);

                        return (
                          <div
                            key={fac.record_id}
                            onClick={() => onSelectFacility(fac.record_id)}
                            tabIndex={0}
                            role="button"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelectFacility(fac.record_id);
                              }
                            }}
                            style={{
                              padding: '0.5rem',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: isSelected
                                ? 'var(--color-bg-canvas-subtle)'
                                : 'var(--color-bg-canvas)',
                              border: isSelected
                                ? '2px solid var(--color-verified)'
                                : '1px solid var(--color-border-subtle)',
                              cursor: 'pointer',
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
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                                #{fac.record_id} {fac.facility_id}
                              </span>
                              <span className={`badge ${decisionInfo.badgeClass}`} style={{ fontSize: '0.625rem' }}>
                                {fac.decision === 'NONE' ? fac.status : `${fac.priority_score} pts`}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.6875rem',
                                color: 'var(--color-ink-muted)',
                              }}
                            >
                              <span>
                                {fac.use_class} • {fac.occupancy_band}
                              </span>
                              <span className={`badge ${evidenceInfo.badgeClass}`} style={{ fontSize: '0.625rem' }}>
                                {evidenceInfo.label.split(' ')[0]}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diagram Legend */}
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-bg-canvas-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--color-ink-primary)' }}>Legend:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-immediate">80-100</span>
              <span>Immediate Review</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-priority">60-79</span>
              <span>Priority Queue</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-monitor">40-59</span>
              <span>Monitor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-outofscope">0-39</span>
              <span>Out of Scope</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-verified">Verified</span>
              <span>Digest Verified</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
