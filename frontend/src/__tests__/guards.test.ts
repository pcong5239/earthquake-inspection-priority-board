import { describe, it, expect } from 'vitest';
import {
  parseJsonSafe,
  parseActiveIncidents,
  parseContractCaps,
  parseContractInfo,
  parseIncidentRecord,
  parseFacilityRecord,
  parseFacilitiesList,
  parseQueueList,
  parseWaitlistList,
  parseHistoryList,
} from '../utils/guards';
import {
  formatAddress,
  formatTimestamp,
  formatRelativeTime,
  formatDecisionBand,
  formatEvidenceStatus,
  formatAssignmentStatus,
  formatIncidentStatus,
  formatFacilityStatus,
  formatReasonCode,
  safeJsonStringify,
} from '../utils/formatters';

describe('Strict Runtime Guards and JSON Parsing', () => {
  it('parses raw JSON strings safely', () => {
    expect(parseJsonSafe<number>('123')).toBe(123);
    expect(parseJsonSafe<object>('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonSafe('invalid json')).toBeNull();
  });

  it('parses valid contract info and rejects malformed objects', () => {
    const validRaw = JSON.stringify({
      version: 1,
      operator: '0x1111111111111111111111111111111111111111',
      incident_count: 5,
      upgraders: ['0x2222222222222222222222222222222222222222'],
    });
    const parsed = parseContractInfo(validRaw);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
    expect(parsed?.operator).toBe('0x1111111111111111111111111111111111111111');
    expect(parsed?.incident_count).toBe(5);
    expect(parsed?.upgraders).toEqual(['0x2222222222222222222222222222222222222222']);

    // Malformed cases
    expect(parseContractInfo('not json')).toBeNull();
    expect(parseContractInfo(JSON.stringify({ version: 'one' }))).toBeNull();
    expect(parseContractInfo(JSON.stringify({ version: 1, operator: 123 }))).toBeNull();
    expect(parseContractInfo(null)).toBeNull();
    expect(parseContractInfo(123)).toBeNull();
  });

  it('parses contract caps and verifies exact contract score bands', () => {
    const validCaps = JSON.stringify({
      max_incidents: 16,
      max_facilities_per_incident: 24,
      max_history_per_incident: 192,
      max_facility_retries: 2,
      max_url_length: 512,
      max_policy_length: 2000,
      max_reason_length: 600,
      max_string_id_length: 128,
      min_assignment_timeout_seconds: 60,
      max_assignment_timeout_seconds: 604800,
      score_bands: {
        IMMEDIATE_REVIEW: [80, 100],
        PRIORITY_QUEUE: [55, 79],
        MONITOR: [25, 54],
        OUT_OF_SCOPE: [0, 24],
      },
    });

    const parsed = parseContractCaps(validCaps);
    expect(parsed).not.toBeNull();
    expect(parsed?.max_incidents).toBe(16);
    expect(parsed?.score_bands.IMMEDIATE_REVIEW).toEqual([80, 100]);
    expect(parsed?.score_bands.PRIORITY_QUEUE).toEqual([55, 79]);
    expect(parsed?.score_bands.MONITOR).toEqual([25, 54]);
    expect(parsed?.score_bands.OUT_OF_SCOPE).toEqual([0, 24]);

    // Missing key
    expect(parseContractCaps(JSON.stringify({ max_incidents: 20 }))).toBeNull();
  });

  it('parses active incidents list and filters invalid IDs', () => {
    expect(parseActiveIncidents(JSON.stringify([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(parseActiveIncidents(JSON.stringify([1, -5, 'foo', 0, 4]))).toEqual([1, 4]);
    expect(parseActiveIncidents('not an array')).toEqual([]);
  });

  it('parses full incident record and enforces valid status enum', () => {
    const validInc = JSON.stringify({
      incident_id: 1,
      event_id: 'us7000m97q',
      event_url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000m97q',
      expected_event_digest: 'a'.repeat(64),
      region_label: 'Bay Area Sector 4',
      allowed_location_buckets: ['Sector-A', 'Sector-B'],
      event_occurred_at: 1700000000,
      max_event_age_seconds: 604800,
      slot_count: 10,
      assignment_timeout_seconds: 86400,
      policy_text: 'Priority triage guidelines',
      policy_version: 1,
      status: 'COHORT_LOCKED',
      facility_count: 3,
      history_count: 5,
      allocated_count: 0,
      created_at: 1700000100,
      locked_at: 1700000200,
      allocated_at: 0,
    });

    const parsed = parseIncidentRecord(validInc);
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe('COHORT_LOCKED');
    expect(parsed?.allowed_location_buckets).toEqual(['Sector-A', 'Sector-B']);

    // Invalid status enum
    const invalidInc = JSON.stringify({
      ...JSON.parse(validInc),
      status: 'INVALID_STATUS',
    });
    expect(parseIncidentRecord(invalidInc)).toBeNull();
  });

  it('parses facility record and validates EVALUATING status and decision band enums', () => {
    const validFac = JSON.stringify({
      record_id: 1,
      incident_id: 1,
      facility_id: 'FAC-101',
      location_bucket: 'Sector-A',
      use_class: 'HOSPITAL',
      age_band: 'PRE_1975',
      occupancy_band: 'HIGH_DENSITY',
      evidence_url: 'https://emergency.gov/damage/fac-101.html',
      expected_evidence_digest: 'b'.repeat(64),
      status: 'EVALUATING',
      decision: 'IMMEDIATE_REVIEW',
      priority_score: 92,
      eligible: true,
      evidence_status: 'VERIFIED',
      reason_codes: ['CRITICAL_INFRASTRUCTURE', 'HIGH_OCCUPANCY'],
      reason: 'Critical facility with verified severe distress.',
      evaluation_attempts: 1,
      queue_position: 1,
      waitlist_position: 0,
      assignment_status: 'OFFERED',
      assigned_inspector: '0x3333333333333333333333333333333333333333',
      offered_at: 1700000300,
      assignment_deadline: 1700086700,
      acknowledged_at: 0,
    });

    const parsed = parseFacilityRecord(validFac);
    expect(parsed).not.toBeNull();
    expect(parsed?.status).toBe('EVALUATING');
    expect(parsed?.priority_score).toBe(92);
    expect(parsed?.decision).toBe('IMMEDIATE_REVIEW');
    expect(parsed?.reason_codes).toEqual(['CRITICAL_INFRASTRUCTURE', 'HIGH_OCCUPANCY']);

    // Invalid decision band enum
    const invalidFac = JSON.stringify({
      ...JSON.parse(validFac),
      decision: 'ULTRA_CRITICAL',
    });
    expect(parseFacilityRecord(invalidFac)).toBeNull();
  });

  it('parses lists for facilities, queue, waitlist, and history', () => {
    const rawFacs = JSON.stringify({
      total_count: 1,
      offset: 0,
      limit: 20,
      facilities: [
        {
          record_id: 1,
          incident_id: 1,
          facility_id: 'FAC-101',
          location_bucket: 'Sector-A',
          use_class: 'HOSPITAL',
          age_band: 'PRE_1975',
          occupancy_band: 'HIGH_DENSITY',
          evidence_url: 'https://emergency.gov/damage/fac-101.html',
          expected_evidence_digest: 'b'.repeat(64),
          status: 'DECIDED',
          decision: 'IMMEDIATE_REVIEW',
          priority_score: 92,
          eligible: true,
          evidence_status: 'VERIFIED',
          reason_codes: [],
          reason: '',
          evaluation_attempts: 1,
          queue_position: 1,
          waitlist_position: 0,
          assignment_status: 'NONE',
          assigned_inspector: '',
          offered_at: 0,
          assignment_deadline: 0,
          acknowledged_at: 0,
        },
      ],
    });
    const parsedFacs = parseFacilitiesList(rawFacs);
    expect(parsedFacs?.total_count).toBe(1);

    const rawWaitlist = JSON.stringify({
      total_waitlist_count: 1,
      offset: 0,
      limit: 20,
      waitlist: [
        {
          record_id: 2,
          facility_id: 'FAC-102',
          location_bucket: 'Sector-A',
          decision: 'MONITOR',
          priority_score: 55,
          waitlist_position: 1,
        },
      ],
    });
    const parsedWaitlist = parseWaitlistList(rawWaitlist);
    expect(parsedWaitlist?.total_waitlist_count).toBe(1);

    const rawQueue = JSON.stringify({
      total_queue_count: 1,
      offset: 0,
      limit: 20,
      queue: [
        {
          record_id: 1,
          facility_id: 'FAC-101',
          location_bucket: 'Sector-A',
          decision: 'PRIORITY_QUEUE',
          priority_score: 75,
          queue_position: 1,
          assignment_status: 'NONE',
          assigned_inspector: '',
          offered_at: 0,
          assignment_deadline: 0,
          acknowledged_at: 0,
        },
      ],
    });

    const parsedQueue = parseQueueList(rawQueue);
    expect(parsedQueue).not.toBeNull();
    expect(parsedQueue?.total_queue_count).toBe(1);
    expect(parsedQueue?.queue[0].facility_id).toBe('FAC-101');

    const rawHistory = JSON.stringify({
      total_history_count: 1,
      offset: 0,
      limit: 20,
      history: [
        {
          sequence: 1,
          incident_id: 1,
          facility_record_id: 0,
          event_type: 'INCIDENT_CREATED',
          actor: '0x1111111111111111111111111111111111111111',
          timestamp: 1700000000,
          details: { region: 'Sector-A' },
        },
      ],
    });

    const parsedHistory = parseHistoryList(rawHistory);
    expect(parsedHistory).not.toBeNull();
    expect(parsedHistory?.history[0].event_type).toBe('INCIDENT_CREATED');
  });
});

describe('Formatters and BigInt Safety', () => {
  it('formats addresses safely with truncation', () => {
    expect(formatAddress(null)).toBe('-');
    expect(formatAddress(undefined)).toBe('-');
    expect(formatAddress('')).toBe('-');
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678', 6)).toBe('0x123456...345678');
  });

  it('formats UTC timestamps and relative times', () => {
    expect(formatTimestamp(null)).toBe('-');
    expect(formatTimestamp(0)).toBe('-');
    expect(formatTimestamp(1700000000)).toBe('2023-11-14 22:13:20 UTC');

    const now = 1700003600;
    expect(formatRelativeTime(1700000000, now)).toBe('1h ago');
    expect(formatRelativeTime(1700003550, now)).toBe('50s ago');
    expect(formatRelativeTime(1700007200, now)).toBe('in 1h');
  });

  it('formats status and badge classes correctly', () => {
    expect(formatDecisionBand('IMMEDIATE_REVIEW').badgeClass).toBe('badge-immediate');
    expect(formatDecisionBand('PRIORITY_QUEUE').badgeClass).toBe('badge-priority');
    expect(formatEvidenceStatus('VERIFIED').badgeClass).toBe('badge-verified');
    expect(formatEvidenceStatus('MISMATCH').badgeClass).toBe('badge-error');
    expect(formatAssignmentStatus('OFFERED').badgeClass).toBe('badge-offered');
    expect(formatIncidentStatus('COHORT_LOCKED').badgeClass).toBe('badge-locked');
    expect(formatFacilityStatus('DECIDED').badgeClass).toBe('badge-decided');
    expect(formatReasonCode('HIGH_OCCUPANCY')).toBe('High occupancy population density factor');
  });

  it('safely serializes JSON containing BigInt values without throwing', () => {
    const objWithBigInt = {
      id: 123,
      amount: 1000000000000000000n,
      nested: { cap: 50n },
    };

    expect(() => JSON.stringify(objWithBigInt)).toThrow(); // Native throws
    const safeStr = safeJsonStringify(objWithBigInt);
    expect(safeStr).toContain('"amount":"1000000000000000000"');
    expect(safeStr).toContain('"cap":"50"');
  });
});
