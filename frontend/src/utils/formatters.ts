import type { DecisionBand, EvidenceStatus, AssignmentStatus, IncidentStatus, FacilityStatus } from '../types/contract';

export function formatAddress(address: string | null | undefined, chars = 4): string {
  if (!address || typeof address !== 'string') return '-';
  const clean = address.trim();
  if (clean.length <= chars * 2 + 2) return clean;
  return `${clean.slice(0, chars + 2)}...${clean.slice(-chars)}`;
}

export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts || ts <= 0) return '-';
  const date = new Date(ts * 1000);
  if (isNaN(date.getTime())) return '-';
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatRelativeTime(ts: number | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): string {
  if (!ts || ts <= 0) return '-';
  const diff = nowSeconds - ts;
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60) return `in ${absDiff}s`;
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)}m`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)}h`;
    return `in ${Math.floor(absDiff / 86400)}d`;
  }
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDecisionBand(decision: DecisionBand): {
  label: string;
  badgeClass: string;
  description: string;
} {
  switch (decision) {
    case 'IMMEDIATE_REVIEW':
      return {
        label: 'Immediate Review',
        badgeClass: 'badge-immediate',
        description: 'Score 80-100: Top tier priority for emergency structural assessment.',
      };
    case 'PRIORITY_QUEUE':
      return {
        label: 'Priority Queue',
        badgeClass: 'badge-priority',
        description: 'Score 55-79: High priority queue for dispatch allocation.',
      };
    case 'MONITOR':
      return {
        label: 'Monitor',
        badgeClass: 'badge-monitor',
        description: 'Score 25-54: Secondary assessment waitlist under observation.',
      };
    case 'OUT_OF_SCOPE':
      return {
        label: 'Out of Scope',
        badgeClass: 'badge-outofscope',
        description: 'Score 0-24: Below immediate triage threshold or non-qualifying.',
      };
    case 'UNRESOLVED':
      return {
        label: 'Unresolved',
        badgeClass: 'badge-unresolved',
        description: 'Evaluation failed or conflicting web evidence requiring retry.',
      };
    case 'NONE':
    default:
      return {
        label: 'Pending Evaluation',
        badgeClass: 'badge-pending',
        description: 'Not yet evaluated by GenLayer consensus engine.',
      };
  }
}

export function formatEvidenceStatus(status: EvidenceStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Verified Web Evidence', badgeClass: 'badge-verified' };
    case 'UNAVAILABLE':
      return { label: 'Evidence Unavailable (404/5xx)', badgeClass: 'badge-error' };
    case 'MISMATCH':
      return { label: 'Digest Hash Mismatch', badgeClass: 'badge-error' };
    case 'CONFLICTING':
      return { label: 'Conflicting Sources', badgeClass: 'badge-warning' };
    case 'MALFORMED':
      return { label: 'Malformed Evidence Payload', badgeClass: 'badge-error' };
    case 'NONE':
    default:
      return { label: 'Awaiting Web Retrieval', badgeClass: 'badge-neutral' };
  }
}

export function formatAssignmentStatus(status: AssignmentStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'OFFERED':
      return { label: 'Offer Active', badgeClass: 'badge-offered' };
    case 'ACKNOWLEDGED':
      return { label: 'Acknowledged', badgeClass: 'badge-acknowledged' };
    case 'EXPIRED':
      return { label: 'Offer Expired', badgeClass: 'badge-expired' };
    case 'NONE':
    default:
      return { label: 'Unassigned', badgeClass: 'badge-neutral' };
  }
}

export function formatIncidentStatus(status: IncidentStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft (Registration Open)', badgeClass: 'badge-draft' };
    case 'COHORT_LOCKED':
      return { label: 'Cohort Locked (Ready to Evaluate)', badgeClass: 'badge-locked' };
    case 'EVALUATING':
      return { label: 'Consensus Evaluating', badgeClass: 'badge-evaluating' };
    case 'ALLOCATED':
      return { label: 'Allocation Finalized', badgeClass: 'badge-allocated' };
    case 'CLOSED':
      return { label: 'Incident Closed', badgeClass: 'badge-closed' };
    default:
      return { label: status, badgeClass: 'badge-neutral' };
  }
}

export function formatFacilityStatus(status: FacilityStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'REGISTERED':
      return { label: 'Registered (Draft)', badgeClass: 'badge-draft' };
    case 'LOCKED':
      return { label: 'Locked in Cohort', badgeClass: 'badge-locked' };
    case 'DECIDED':
      return { label: 'Decided', badgeClass: 'badge-decided' };
    case 'UNRESOLVED':
      return { label: 'Unresolved / Retrying', badgeClass: 'badge-unresolved' };
    default:
      return { label: status, badgeClass: 'badge-neutral' };
  }
}

export function formatReasonCode(code: string): string {
  const map: Record<string, string> = {
    HIGH_OCCUPANCY: 'High occupancy population density factor',
    CRITICAL_INFRASTRUCTURE: 'Designated critical medical/civic use class',
    HISTORIC_ERA: 'Pre-code or vulnerable building construction age band',
    EVIDENCE_VERIFIED: 'Authoritative structural report digest verified',
    EVIDENCE_UNAVAILABLE: 'Public evidence URL could not be fetched or timed out',
    EVIDENCE_DIGEST_MISMATCH: 'Rendered web content digest did not match expected hash',
    EVIDENCE_CONFLICTING: 'Multiple sources yielded conflicting damage statements',
    MODERATE_DAMAGE: 'Moderate structural distress observed',
    LOW_HAZARD: 'Superficial damage with low immediate structural risk',
    OUT_OF_COHORT: 'Facility location bucket is outside incident scope',
    EVALUATION_MAX_RETRIES: 'Evaluation retries exhausted without consensus agreement',
  };
  return map[code] || code;
}

export function safeJsonStringify(obj: unknown, space?: number): string {
  try {
    return JSON.stringify(
      obj,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
      space
    );
  } catch (err) {
    return String(err);
  }
}
