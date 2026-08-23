export type IncidentStatus = 'DRAFT' | 'COHORT_LOCKED' | 'EVALUATING' | 'ALLOCATED' | 'CLOSED';

export type FacilityStatus = 'REGISTERED' | 'LOCKED' | 'EVALUATING' | 'DECIDED' | 'UNRESOLVED';

export type DecisionBand = 'NONE' | 'IMMEDIATE_REVIEW' | 'PRIORITY_QUEUE' | 'MONITOR' | 'OUT_OF_SCOPE' | 'UNRESOLVED';

export type EvidenceStatus = 'NONE' | 'VERIFIED' | 'UNAVAILABLE' | 'MISMATCH' | 'CONFLICTING' | 'MALFORMED';

export type AssignmentStatus = 'NONE' | 'OFFERED' | 'ACKNOWLEDGED' | 'EXPIRED';

export type EventType =
  | 'INCIDENT_CREATED'
  | 'FACILITY_REGISTERED'
  | 'COHORT_LOCKED'
  | 'FACILITY_EVALUATED'
  | 'ALLOCATION_FINALIZED'
  | 'ASSIGNMENT_OFFERED'
  | 'ASSIGNMENT_ACKNOWLEDGED'
  | 'ASSIGNMENT_EXPIRED'
  | 'WAITLIST_PROMOTED'
  | 'INCIDENT_CLOSED';

export interface IncidentRecord {
  incident_id: number;
  event_id: string;
  event_url: string;
  expected_event_digest: string;
  region_label: string;
  allowed_location_buckets: string[];
  event_occurred_at: number;
  max_event_age_seconds: number;
  slot_count: number;
  assignment_timeout_seconds: number;
  policy_text: string;
  policy_version: number;
  status: IncidentStatus;
  facility_count: number;
  history_count: number;
  allocated_count: number;
  created_at: number;
  locked_at: number;
  allocated_at: number;
}

export interface FacilityRecord {
  record_id: number;
  incident_id: number;
  facility_id: string;
  location_bucket: string;
  use_class: string;
  age_band: string;
  occupancy_band: string;
  evidence_url: string;
  expected_evidence_digest: string;
  status: FacilityStatus;
  decision: DecisionBand;
  priority_score: number;
  eligible: boolean;
  evidence_status: EvidenceStatus;
  reason_codes: string[];
  reason: string;
  evaluation_attempts: number;
  queue_position: number;
  waitlist_position: number;
  assignment_status: AssignmentStatus;
  assigned_inspector: string;
  offered_at: number;
  assignment_deadline: number;
  acknowledged_at: number;
}

export interface QueueItem {
  record_id: number;
  facility_id: string;
  location_bucket: string;
  decision: DecisionBand;
  priority_score: number;
  queue_position: number;
  assignment_status: AssignmentStatus;
  assigned_inspector: string;
  offered_at: number;
  assignment_deadline: number;
  acknowledged_at: number;
}

export interface WaitlistItem {
  record_id: number;
  facility_id: string;
  location_bucket: string;
  decision: DecisionBand;
  priority_score: number;
  waitlist_position: number;
}

export interface HistoryEntry {
  sequence: number;
  incident_id: number;
  facility_record_id: number;
  event_type: EventType;
  actor: string;
  timestamp: number;
  details: Record<string, unknown>;
}

export interface ContractCaps {
  max_incidents: number;
  max_facilities_per_incident: number;
  max_history_per_incident: number;
  max_facility_retries: number;
  max_url_length: number;
  max_policy_length: number;
  max_reason_length: number;
  max_string_id_length: number;
  min_assignment_timeout_seconds: number;
  max_assignment_timeout_seconds: number;
  score_bands: Record<string, [number, number]>;
}

export interface ContractInfo {
  version: number;
  operator: string;
  incident_count: number;
  upgraders: string[];
}

export interface CreateIncidentParams {
  event_id: string;
  event_url: string;
  expected_event_digest: string;
  region_label: string;
  allowed_location_buckets: string[];
  event_occurred_at: number;
  max_event_age_seconds: number;
  slot_count: number;
  assignment_timeout_seconds: number;
  policy_text: string;
  policy_version: number;
}

export interface RegisterFacilityParams {
  incident_id: number;
  facility_id: string;
  location_bucket: string;
  use_class: string;
  age_band: string;
  occupancy_band: string;
  evidence_url: string;
  expected_evidence_digest: string;
}
