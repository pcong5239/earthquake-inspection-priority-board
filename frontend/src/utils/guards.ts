import type {
  IncidentRecord,
  FacilityRecord,
  QueueItem,
  WaitlistItem,
  HistoryEntry,
  ContractCaps,
  ContractInfo,
  IncidentStatus,
  FacilityStatus,
  DecisionBand,
  EvidenceStatus,
  AssignmentStatus,
  EventType,
} from '../types/contract';

const VALID_INCIDENT_STATUSES = new Set<IncidentStatus>([
  'DRAFT',
  'COHORT_LOCKED',
  'EVALUATING',
  'ALLOCATED',
  'CLOSED',
]);

const VALID_FACILITY_STATUSES = new Set<FacilityStatus>([
  'REGISTERED',
  'LOCKED',
  'EVALUATING',
  'DECIDED',
  'UNRESOLVED',
]);

const VALID_DECISION_BANDS = new Set<DecisionBand>([
  'NONE',
  'IMMEDIATE_REVIEW',
  'PRIORITY_QUEUE',
  'MONITOR',
  'OUT_OF_SCOPE',
  'UNRESOLVED',
]);

const VALID_EVIDENCE_STATUSES = new Set<EvidenceStatus>([
  'NONE',
  'VERIFIED',
  'UNAVAILABLE',
  'MISMATCH',
  'CONFLICTING',
  'MALFORMED',
]);

const VALID_ASSIGNMENT_STATUSES = new Set<AssignmentStatus>([
  'NONE',
  'OFFERED',
  'ACKNOWLEDGED',
  'EXPIRED',
]);

const VALID_EVENT_TYPES = new Set<EventType>([
  'INCIDENT_CREATED',
  'FACILITY_REGISTERED',
  'COHORT_LOCKED',
  'FACILITY_EVALUATED',
  'ALLOCATION_FINALIZED',
  'ASSIGNMENT_OFFERED',
  'ASSIGNMENT_ACKNOWLEDGED',
  'ASSIGNMENT_EXPIRED',
  'WAITLIST_PROMOTED',
  'INCIDENT_CLOSED',
]);

export function parseJsonSafe<T>(raw: unknown): T | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function parseActiveIncidents(raw: unknown): number[] {
  const parsed = parseJsonSafe<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0);
}

export function parseContractCaps(raw: unknown): ContractCaps | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (
    typeof parsed.max_incidents !== 'number' ||
    typeof parsed.max_facilities_per_incident !== 'number' ||
    typeof parsed.max_history_per_incident !== 'number' ||
    typeof parsed.max_facility_retries !== 'number' ||
    typeof parsed.max_url_length !== 'number' ||
    typeof parsed.max_policy_length !== 'number' ||
    typeof parsed.max_reason_length !== 'number' ||
    typeof parsed.max_string_id_length !== 'number' ||
    typeof parsed.min_assignment_timeout_seconds !== 'number' ||
    typeof parsed.max_assignment_timeout_seconds !== 'number' ||
    !parsed.score_bands ||
    typeof parsed.score_bands !== 'object'
  ) {
    return null;
  }

  return parsed as unknown as ContractCaps;
}

export function parseContractInfo(raw: unknown): ContractInfo | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (
    typeof parsed.version !== 'number' ||
    typeof parsed.operator !== 'string' ||
    typeof parsed.incident_count !== 'number' ||
    !Array.isArray(parsed.upgraders)
  ) {
    return null;
  }

  return {
    version: parsed.version,
    operator: parsed.operator,
    incident_count: parsed.incident_count,
    upgraders: parsed.upgraders.filter((u): u is string => typeof u === 'string'),
  };
}

export function parseIncidentRecord(raw: unknown): IncidentRecord | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (
    typeof parsed.incident_id !== 'number' ||
    typeof parsed.event_id !== 'string' ||
    typeof parsed.event_url !== 'string' ||
    typeof parsed.expected_event_digest !== 'string' ||
    typeof parsed.region_label !== 'string' ||
    !Array.isArray(parsed.allowed_location_buckets) ||
    typeof parsed.event_occurred_at !== 'number' ||
    typeof parsed.max_event_age_seconds !== 'number' ||
    typeof parsed.slot_count !== 'number' ||
    typeof parsed.assignment_timeout_seconds !== 'number' ||
    typeof parsed.policy_text !== 'string' ||
    typeof parsed.policy_version !== 'number' ||
    typeof parsed.status !== 'string' ||
    !VALID_INCIDENT_STATUSES.has(parsed.status as IncidentStatus) ||
    typeof parsed.facility_count !== 'number' ||
    typeof parsed.history_count !== 'number' ||
    typeof parsed.allocated_count !== 'number' ||
    typeof parsed.created_at !== 'number' ||
    typeof parsed.locked_at !== 'number' ||
    typeof parsed.allocated_at !== 'number'
  ) {
    return null;
  }

  return {
    incident_id: parsed.incident_id,
    event_id: parsed.event_id,
    event_url: parsed.event_url,
    expected_event_digest: parsed.expected_event_digest,
    region_label: parsed.region_label,
    allowed_location_buckets: parsed.allowed_location_buckets.filter((b): b is string => typeof b === 'string'),
    event_occurred_at: parsed.event_occurred_at,
    max_event_age_seconds: parsed.max_event_age_seconds,
    slot_count: parsed.slot_count,
    assignment_timeout_seconds: parsed.assignment_timeout_seconds,
    policy_text: parsed.policy_text,
    policy_version: parsed.policy_version,
    status: parsed.status as IncidentStatus,
    facility_count: parsed.facility_count,
    history_count: parsed.history_count,
    allocated_count: parsed.allocated_count,
    created_at: parsed.created_at,
    locked_at: parsed.locked_at,
    allocated_at: parsed.allocated_at,
  };
}

export function parseFacilityRecord(raw: unknown): FacilityRecord | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  if (
    typeof parsed.record_id !== 'number' ||
    typeof parsed.incident_id !== 'number' ||
    typeof parsed.facility_id !== 'string' ||
    typeof parsed.location_bucket !== 'string' ||
    typeof parsed.use_class !== 'string' ||
    typeof parsed.age_band !== 'string' ||
    typeof parsed.occupancy_band !== 'string' ||
    typeof parsed.evidence_url !== 'string' ||
    typeof parsed.expected_evidence_digest !== 'string' ||
    typeof parsed.status !== 'string' ||
    !VALID_FACILITY_STATUSES.has(parsed.status as FacilityStatus) ||
    typeof parsed.decision !== 'string' ||
    !VALID_DECISION_BANDS.has(parsed.decision as DecisionBand) ||
    typeof parsed.priority_score !== 'number' ||
    typeof parsed.eligible !== 'boolean' ||
    typeof parsed.evidence_status !== 'string' ||
    !VALID_EVIDENCE_STATUSES.has(parsed.evidence_status as EvidenceStatus) ||
    !Array.isArray(parsed.reason_codes) ||
    typeof parsed.reason !== 'string' ||
    typeof parsed.evaluation_attempts !== 'number' ||
    typeof parsed.queue_position !== 'number' ||
    typeof parsed.waitlist_position !== 'number' ||
    typeof parsed.assignment_status !== 'string' ||
    !VALID_ASSIGNMENT_STATUSES.has(parsed.assignment_status as AssignmentStatus) ||
    typeof parsed.assigned_inspector !== 'string' ||
    typeof parsed.offered_at !== 'number' ||
    typeof parsed.assignment_deadline !== 'number' ||
    typeof parsed.acknowledged_at !== 'number'
  ) {
    return null;
  }

  return {
    record_id: parsed.record_id,
    incident_id: parsed.incident_id,
    facility_id: parsed.facility_id,
    location_bucket: parsed.location_bucket,
    use_class: parsed.use_class,
    age_band: parsed.age_band,
    occupancy_band: parsed.occupancy_band,
    evidence_url: parsed.evidence_url,
    expected_evidence_digest: parsed.expected_evidence_digest,
    status: parsed.status as FacilityStatus,
    decision: parsed.decision as DecisionBand,
    priority_score: parsed.priority_score,
    eligible: parsed.eligible,
    evidence_status: parsed.evidence_status as EvidenceStatus,
    reason_codes: parsed.reason_codes.filter((c): c is string => typeof c === 'string'),
    reason: parsed.reason,
    evaluation_attempts: parsed.evaluation_attempts,
    queue_position: parsed.queue_position,
    waitlist_position: parsed.waitlist_position,
    assignment_status: parsed.assignment_status as AssignmentStatus,
    assigned_inspector: parsed.assigned_inspector,
    offered_at: parsed.offered_at,
    assignment_deadline: parsed.assignment_deadline,
    acknowledged_at: parsed.acknowledged_at,
  };
}

export function parseFacilitiesList(raw: unknown): { total_count: number; offset: number; limit: number; facilities: FacilityRecord[] } | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.facilities)) return null;

  const validFacs: FacilityRecord[] = [];
  for (const item of parsed.facilities) {
    const fac = parseFacilityRecord(JSON.stringify(item));
    if (fac) validFacs.push(fac);
  }

  return {
    total_count: typeof parsed.total_count === 'number' ? parsed.total_count : validFacs.length,
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
    limit: typeof parsed.limit === 'number' ? parsed.limit : validFacs.length,
    facilities: validFacs,
  };
}

export function parseQueueList(raw: unknown): { total_queue_count: number; offset: number; limit: number; queue: QueueItem[] } | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.queue)) return null;

  const validQueue: QueueItem[] = [];
  for (const item of parsed.queue) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.record_id === 'number' &&
      typeof item.facility_id === 'string' &&
      typeof item.location_bucket === 'string' &&
      typeof item.decision === 'string' &&
      VALID_DECISION_BANDS.has(item.decision as DecisionBand) &&
      typeof item.priority_score === 'number' &&
      typeof item.queue_position === 'number' &&
      typeof item.assignment_status === 'string' &&
      VALID_ASSIGNMENT_STATUSES.has(item.assignment_status as AssignmentStatus) &&
      typeof item.assigned_inspector === 'string' &&
      typeof item.offered_at === 'number' &&
      typeof item.assignment_deadline === 'number' &&
      typeof item.acknowledged_at === 'number'
    ) {
      validQueue.push(item as QueueItem);
    }
  }

  return {
    total_queue_count: typeof parsed.total_queue_count === 'number' ? parsed.total_queue_count : validQueue.length,
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
    limit: typeof parsed.limit === 'number' ? parsed.limit : validQueue.length,
    queue: validQueue,
  };
}

export function parseWaitlistList(raw: unknown): { total_waitlist_count: number; offset: number; limit: number; waitlist: WaitlistItem[] } | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.waitlist)) return null;

  const validWaitlist: WaitlistItem[] = [];
  for (const item of parsed.waitlist) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.record_id === 'number' &&
      typeof item.facility_id === 'string' &&
      typeof item.location_bucket === 'string' &&
      typeof item.decision === 'string' &&
      VALID_DECISION_BANDS.has(item.decision as DecisionBand) &&
      typeof item.priority_score === 'number' &&
      typeof item.waitlist_position === 'number'
    ) {
      validWaitlist.push(item as WaitlistItem);
    }
  }

  return {
    total_waitlist_count: typeof parsed.total_waitlist_count === 'number' ? parsed.total_waitlist_count : validWaitlist.length,
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
    limit: typeof parsed.limit === 'number' ? parsed.limit : validWaitlist.length,
    waitlist: validWaitlist,
  };
}

export function parseHistoryList(raw: unknown): { total_history_count: number; offset: number; limit: number; history: HistoryEntry[] } | null {
  const parsed = parseJsonSafe<Record<string, unknown>>(raw);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.history)) return null;

  const validHistory: HistoryEntry[] = [];
  for (const item of parsed.history) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.sequence === 'number' &&
      typeof item.incident_id === 'number' &&
      typeof item.facility_record_id === 'number' &&
      typeof item.event_type === 'string' &&
      VALID_EVENT_TYPES.has(item.event_type as EventType) &&
      typeof item.actor === 'string' &&
      typeof item.timestamp === 'number' &&
      item.details &&
      typeof item.details === 'object'
    ) {
      validHistory.push(item as HistoryEntry);
    }
  }

  return {
    total_history_count: typeof parsed.total_history_count === 'number' ? parsed.total_history_count : validHistory.length,
    offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
    limit: typeof parsed.limit === 'number' ? parsed.limit : validHistory.length,
    history: validHistory,
  };
}
