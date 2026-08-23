import React, { useState } from 'react';
import type { FacilityRecord, IncidentRecord, QueueItem, WaitlistItem } from '../types/contract';
import {
  formatDecisionBand,
  formatEvidenceStatus,
  formatAssignmentStatus,
  formatFacilityStatus,
  formatAddress,
} from '../utils/formatters';

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
      style={{ marginBottom: '1.25rem', overflow: 'hidden' }}
    >
      {/* Header & View Switcher */}
      <div
        style={{
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#ffffff',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--ink-primary)', letterSpacing: '-0.01em' }}>
            Spatial Queue Diagram & Regional Buckets
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', marginTop: '0.125rem' }}>
            Coarse region cohort distribution, consensus evaluation scores, and priority queue slots.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'diagram' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('diagram')}
            aria-pressed={viewMode === 'diagram'}
          >
            Diagram View
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'accessible-list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('accessible-list')}
            aria-pressed={viewMode === 'accessible-list'}
          >
            Accessible List
          </button>
        </div>
      </div>

      {viewMode === 'accessible-list' ? (
        /* Accessible Ordered List Equivalent */
        <div aria-label="Ordered Triage & Queue List" style={{ padding: '1.25rem', backgroundColor: '#ffffff' }}>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink-primary)' }}>
            Allocated Inspection Priority Queue ({queue.length}/{incident.slot_count} Slots)
          </h3>
          {queue.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '1rem' }}>
              No facilities currently allocated to priority queue.
            </p>
          ) : (
            <ol style={{ paddingLeft: '1.25rem', marginBottom: '1.25rem', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
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
                      color: 'var(--ink-primary)',
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

          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink-primary)' }}>
            Waitlist Secondary Allocation ({waitlist.length} Facilities)
          </h3>
          {waitlist.length === 0 ? (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginBottom: '1.25rem' }}>
              No facilities in waitlist.
            </p>
          ) : (
            <ol style={{ paddingLeft: '1.25rem', marginBottom: '1.25rem', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
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
                      color: 'var(--ink-primary)',
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

          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink-primary)' }}>
            All Registered Facilities ({facilities.length} Total)
          </h3>
          <ul style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
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
                    color: 'var(--ink-primary)',
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
        <div style={{ padding: '1rem', backgroundColor: '#ffffff' }}>
          {/* Priority Queue Dispatch Track (Top Banner) */}
          <div
            style={{
              backgroundColor: 'var(--canvas-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.625rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-seismic)',
                  }}
                />
                <span style={{ fontWeight: 800, fontSize: 'var(--text-xs)', color: 'var(--accent-seismic)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  DISPATCH QUEUE ({queue.length} / {incident.slot_count} Active Capacity)
                </span>
              </div>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)', fontWeight: 600 }}>
                Timeout: {incident.assignment_timeout_seconds}s
              </span>
            </div>

            {queue.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: 'var(--ink-muted)',
                  fontSize: 'var(--text-xs)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: '#ffffff',
                }}
              >
                No facilities allocated to dispatch queue yet. Complete registration, lock cohort, run consensus evaluations, and finalize allocation.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
                  gap: '0.625rem',
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
                        padding: '0.625rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: isSelected ? 'var(--accent-seismic-subtle)' : '#ffffff',
                        border: isSelected ? '2px solid var(--accent-seismic)' : '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        transition: 'border-color var(--duration-fast), background-color var(--duration-fast)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 'var(--text-2xs)',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: 'var(--accent-seismic)' }}>
                          Slot #{q.queue_position}
                        </span>
                        <span className={`badge ${decisionInfo.badgeClass}`}>
                          {q.priority_score} pts
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--ink-primary)' }}>
                        {q.facility_id}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 'var(--text-2xs)',
                          color: 'var(--ink-muted)',
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
                            color: 'var(--accent-teal)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontWeight: 600,
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
              marginBottom: '1.25rem',
            }}
          >
            {incident.allowed_location_buckets.map((bucket) => {
              const bucketFacilities = bucketMap[bucket] || [];

              return (
                <div
                  key={bucket}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--canvas-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#ffffff',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 'var(--text-xs)', color: 'var(--ink-primary)' }}>
                      Location: {bucket}
                    </span>
                    <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)', fontWeight: 600 }}>
                      {bucketFacilities.length} facilities
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '0.625rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      minHeight: '6rem',
                    }}
                  >
                    {bucketFacilities.length === 0 ? (
                      <div
                        style={{
                          fontSize: 'var(--text-2xs)',
                          color: 'var(--ink-muted)',
                          fontStyle: 'italic',
                          textAlign: 'center',
                          padding: '1.25rem 0',
                        }}
                      >
                        No registered facilities in this bucket
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
                              padding: '0.625rem',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: isSelected
                                ? 'var(--accent-teal-subtle)'
                                : '#ffffff',
                              border: isSelected
                                ? '2px solid var(--accent-teal)'
                                : '1px solid var(--border-hairline)',
                              cursor: 'pointer',
                              boxShadow: 'var(--shadow-sm)',
                              transition: 'border-color var(--duration-fast)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.375rem',
                              }}
                            >
                              <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--ink-primary)' }}>
                                #{fac.record_id} {fac.facility_id}
                              </span>
                              <span className={`badge ${decisionInfo.badgeClass}`}>
                                {fac.decision === 'NONE' ? fac.status : `${fac.priority_score} pts`}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: 'var(--text-2xs)',
                                color: 'var(--ink-secondary)',
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

          {/* Structured Operational Facility Priority Table */}
          {facilities.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                Operational Facility Roster ({facilities.length} Records)
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)' }}>
                <table className="op-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Facility ID</th>
                      <th>Bucket</th>
                      <th>Class & Age</th>
                      <th>Decision Band</th>
                      <th>Score</th>
                      <th>Evidence</th>
                      <th>Assignment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((f) => {
                      const isSel = selectedFacilityId === f.record_id;
                      const dec = formatDecisionBand(f.decision);
                      const evi = formatEvidenceStatus(f.evidence_status);
                      const ass = formatAssignmentStatus(f.assignment_status);
                      const facSt = formatFacilityStatus(f.status);

                      return (
                        <tr
                          key={f.record_id}
                          className={isSel ? 'selected' : ''}
                          onClick={() => onSelectFacility(f.record_id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ fontWeight: 700 }}>#{f.record_id}</td>
                          <td style={{ fontWeight: 700 }}>{f.facility_id}</td>
                          <td>{f.location_bucket}</td>
                          <td>
                            {f.use_class} <span style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-2xs)' }}>({f.age_band})</span>
                          </td>
                          <td>
                            <span className={`badge ${dec.badgeClass}`}>{dec.label}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {f.status === 'DECIDED' ? `${f.priority_score}/100` : facSt.label}
                          </td>
                          <td>
                            <span className={`badge ${evi.badgeClass}`}>{evi.label}</span>
                          </td>
                          <td>
                            {f.queue_position > 0 ? (
                              <span style={{ fontWeight: 700, color: 'var(--accent-seismic)' }}>
                                Queue #{f.queue_position}
                              </span>
                            ) : f.waitlist_position > 0 ? (
                              <span style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>
                                Waitlist #{f.waitlist_position}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--ink-muted)' }}>-</span>
                            )}
                            <div style={{ marginTop: '0.125rem' }}>
                              <span className={`badge ${ass.badgeClass}`} style={{ fontSize: '0.625rem' }}>
                                {ass.label}
                              </span>
                            </div>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFacility(f.record_id);
                              }}
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Diagram Legend */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--canvas-subtle)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span style={{ fontWeight: 800, color: 'var(--ink-primary)', textTransform: 'uppercase', fontSize: 'var(--text-2xs)', letterSpacing: '0.04em' }}>
              Legend:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-immediate">80-100</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)' }}>Immediate Review</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-priority">60-79</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)' }}>Priority Queue</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-monitor">40-59</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)' }}>Monitor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-outofscope">0-39</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)' }}>Out of Scope</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="badge badge-verified">Verified</span>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)' }}>Digest Verified</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
