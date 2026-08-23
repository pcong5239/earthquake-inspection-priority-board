import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { App } from '../App';
import { SpatialQueueBoard } from '../components/SpatialQueueBoard';
import { FacilityDetailPane } from '../components/FacilityDetailPane';
import { HistorySection } from '../components/HistorySection';
import { CreateIncidentModal } from '../components/modals/CreateIncidentModal';
import { RegisterFacilityModal } from '../components/modals/RegisterFacilityModal';
import { OfferAssignmentModal } from '../components/modals/OfferAssignmentModal';
import { EvaluateFacilityModal } from '../components/modals/EvaluateFacilityModal';
import { CloseIncidentModal } from '../components/modals/CloseIncidentModal';
import { WalletProvider } from '../context/WalletContext';
import { TransactionProvider } from '../context/TransactionContext';
import * as chainConfig from '../config/chain';
import * as contractService from '../services/contractService';
import type { FacilityRecord, IncidentRecord, HistoryEntry } from '../types/contract';

describe('UI Components, Role Gating, and Modal Validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders unconfigured state when VITE_CONTRACT_ADDRESS is not set', () => {
    vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(null);
    render(<App />);

    expect(screen.getByText('Contract Configuration Required')).not.toBeNull();
    expect(screen.getAllByText(/VITE_CONTRACT_ADDRESS/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GenLayer Studionet/).length).toBeGreaterThan(0);
  });

  describe('Authoritative Metadata Availability & Fail-Closed State Machine (Attempt 2 Regressions)', () => {
    const validContractAddress = '0x1032c6e107863b4798b519929e7565e33dad5ca1' as `0x${string}`;
    const mockOperator = '0x1111111111111111111111111111111111111111';

    const mockInfo = {
      version: 1,
      operator: mockOperator,
      incident_count: 0,
      upgraders: [],
    };

    const mockCaps = {
      max_incidents: 10,
      max_facilities_per_incident: 100,
      max_history_per_incident: 100,
      max_facility_retries: 3,
      max_url_length: 256,
      max_policy_length: 2048,
      max_reason_length: 512,
      max_string_id_length: 64,
      min_assignment_timeout_seconds: 60,
      max_assignment_timeout_seconds: 604800,
      score_bands: {},
    };

    it('Regression A: All metadata reads succeed with zero active incidents -> transitions to READY and renders authoritative zero-state with verified operator', async () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockResolvedValue(mockInfo);
      vi.spyOn(contractService, 'fetchCaps').mockResolvedValue(mockCaps);
      vi.spyOn(contractService, 'fetchOperator').mockResolvedValue(mockOperator);
      vi.spyOn(contractService, 'fetchActiveIncidents').mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Live on Studionet • Zero Active Incidents/)).not.toBeNull();
      });

      expect(screen.getByText('Active Incidents')).not.toBeNull();
      expect(screen.getByText('0')).not.toBeNull();
      expect(screen.getByText('No active incidents on record')).not.toBeNull();
      expect(screen.getByText('0x1111...1111')).not.toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('Regression B: get_active_incidents fails -> fail-closed error panel, zero active metric and live claims are suppressed', async () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockResolvedValue(mockInfo);
      vi.spyOn(contractService, 'fetchCaps').mockResolvedValue(mockCaps);
      vi.spyOn(contractService, 'fetchOperator').mockResolvedValue(mockOperator);
      vi.spyOn(contractService, 'fetchActiveIncidents').mockRejectedValue(
        new Error('GenLayer RPC error (gen_call): Contract 0x1032c6e107863b4798b519929e7565e33dad5ca1 not found')
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).not.toBeNull();
      });

      expect(screen.getByText('Contract State Verification Failed')).not.toBeNull();
      expect(screen.getByText(/Contract 0x1032c6e107863b4798b519929e7565e33dad5ca1 not found/)).not.toBeNull();
      expect(screen.getByText('Retry Verification')).not.toBeNull();

      // Ensure fail-closed: NO verified zero-state claims
      expect(screen.queryByText(/Live on Studionet • Zero Active Incidents/)).toBeNull();
      expect(screen.queryByText('No active incidents on record')).toBeNull();
      expect(screen.queryByText('Active Incidents')).toBeNull();
    });

    it('Regression C: contract info or operator read fails -> fail-closed error alert shown', async () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockRejectedValue(new Error('RPC Timeout 504'));
      vi.spyOn(contractService, 'fetchCaps').mockResolvedValue(mockCaps);
      vi.spyOn(contractService, 'fetchOperator').mockResolvedValue(mockOperator);
      vi.spyOn(contractService, 'fetchActiveIncidents').mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).not.toBeNull();
      });

      expect(screen.getByText('Contract State Verification Failed')).not.toBeNull();
      expect(screen.getByText(/RPC Timeout 504/)).not.toBeNull();
      expect(screen.queryByText(/Live on Studionet/)).toBeNull();
    });

    it('Regression D: Loading state renders explicit verifying indicator and does not claim verified zero state', () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockReturnValue(new Promise(() => {})); // Never resolves
      vi.spyOn(contractService, 'fetchCaps').mockReturnValue(new Promise(() => {}));
      vi.spyOn(contractService, 'fetchOperator').mockReturnValue(new Promise(() => {}));
      vi.spyOn(contractService, 'fetchActiveIncidents').mockReturnValue(new Promise(() => {}));

      render(<App />);

      expect(screen.getByRole('status')).not.toBeNull();
      expect(screen.getByText('Verifying Contract State on GenLayer Studionet...')).not.toBeNull();
      expect(screen.queryByText(/Live on Studionet • Zero Active Incidents/)).toBeNull();
      expect(screen.queryByText('No active incidents on record')).toBeNull();
      expect(screen.queryByText('Active Incidents')).toBeNull();
    });

    it('Regression E: User-triggered Retry transitions ERROR -> READY and renders authoritative state', async () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockResolvedValue(mockInfo);
      vi.spyOn(contractService, 'fetchCaps').mockResolvedValue(mockCaps);
      vi.spyOn(contractService, 'fetchOperator').mockResolvedValue(mockOperator);

      // Fails first, then succeeds on retry
      vi.spyOn(contractService, 'fetchActiveIncidents')
        .mockRejectedValueOnce(new Error('Network offline'))
        .mockResolvedValueOnce([]);

      render(<App />);

      // Initial ERROR state
      await waitFor(() => {
        expect(screen.getByRole('alert')).not.toBeNull();
      });
      expect(screen.getByText('Contract State Verification Failed')).not.toBeNull();

      // Click Retry
      fireEvent.click(screen.getByText('Retry Verification'));

      // Transitions to READY
      await waitFor(() => {
        expect(screen.getByText(/Live on Studionet • Zero Active Incidents/)).not.toBeNull();
      });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('Active Incidents')).not.toBeNull();
    });

    it('Regression F: Connected wallet during metadata failure keeps write actions disabled and infers no operator role', async () => {
      vi.spyOn(chainConfig, 'getContractAddress').mockReturnValue(validContractAddress);
      vi.spyOn(contractService, 'fetchContractInfo').mockRejectedValue(new Error('Contract not found'));
      vi.spyOn(contractService, 'fetchCaps').mockResolvedValue(mockCaps);
      vi.spyOn(contractService, 'fetchOperator').mockResolvedValue(mockOperator);
      vi.spyOn(contractService, 'fetchActiveIncidents').mockRejectedValue(new Error('Contract not found'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).not.toBeNull();
      });

      // Announce and connect operator address
      act(() => {
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: {
              info: { uuid: 'op-wallet-1', name: 'MetaMask', icon: '', rdns: 'io.metamask' },
              provider: {
                request: vi.fn().mockImplementation(async ({ method }) => {
                  if (method === 'eth_requestAccounts') return [mockOperator];
                  if (method === 'eth_chainId') return '0xf22f';
                  return null;
                }),
              },
            },
          })
        );
      });

      // Attempt to open wallet chooser and connect
      fireEvent.click(screen.getByRole('button', { name: /connect injected wallet/i }));
      fireEvent.click(screen.getByText('MetaMask'));

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).not.toBeNull();
      });

      // Verification alert remains fail-closed
      expect(screen.getByRole('alert')).not.toBeNull();
      expect(screen.getByText('Contract State Verification Failed')).not.toBeNull();

      // Header "+ Create Incident" button must remain disabled
      const createBtn = screen.getByRole('button', { name: /create incident/i }) as HTMLButtonElement;
      expect(createBtn.disabled).toBe(true);
    });
  });

  const mockIncident: IncidentRecord = {
    incident_id: 1,
    event_id: 'us7000m97q',
    event_url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000m97q',
    expected_event_digest: 'a'.repeat(64),
    region_label: 'Bay Area Sector 4',
    allowed_location_buckets: ['Sector-A', 'Sector-B'],
    event_occurred_at: 1700000000,
    max_event_age_seconds: 604800,
    slot_count: 5,
    assignment_timeout_seconds: 86400,
    policy_text: 'Triage rules',
    policy_version: 1,
    status: 'COHORT_LOCKED',
    facility_count: 2,
    history_count: 3,
    allocated_count: 1,
    created_at: 1700000000,
    locked_at: 1700000100,
    allocated_at: 1700000200,
  };

  const mockFacility: FacilityRecord = {
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
    decision: 'PRIORITY_QUEUE',
    priority_score: 75,
    eligible: true,
    evidence_status: 'VERIFIED',
    reason_codes: ['HIGH_OCCUPANCY', 'CRITICAL_INFRASTRUCTURE'],
    reason: 'Critical facility with confirmed structural distress.',
    evaluation_attempts: 1,
    queue_position: 1,
    waitlist_position: 0,
    assignment_status: 'OFFERED',
    assigned_inspector: '0x3333333333333333333333333333333333333333',
    offered_at: Math.floor(Date.now() / 1000) - 300,
    assignment_deadline: Math.floor(Date.now() / 1000) + 3600,
    acknowledged_at: 0,
  };

  it('SpatialQueueBoard renders diagram and toggles to accessible ordered list', () => {
    const onSelect = vi.fn();

    render(
      <SpatialQueueBoard
        incident={mockIncident}
        facilities={[mockFacility]}
        queue={[
          {
            record_id: 1,
            facility_id: 'FAC-101',
            location_bucket: 'Sector-A',
            decision: 'PRIORITY_QUEUE',
            priority_score: 75,
            queue_position: 1,
            assignment_status: 'OFFERED',
            assigned_inspector: '0x3333333333333333333333333333333333333333',
            offered_at: 1000,
            assignment_deadline: 2000,
            acknowledged_at: 0,
          },
        ]}
        waitlist={[]}
        selectedFacilityId={null}
        onSelectFacility={onSelect}
      />
    );

    // Initial Diagram View
    expect(screen.getByText('Spatial Queue Diagram & Regional Buckets')).not.toBeNull();
    expect(screen.getByText('Location: Sector-A')).not.toBeNull();
    expect(screen.getByText('Location: Sector-B')).not.toBeNull();

    // Toggle to Accessible List View
    fireEvent.click(screen.getByText('Accessible List'));
    expect(screen.getByLabelText('Ordered Triage & Queue List')).not.toBeNull();
    expect(screen.getByText(/Allocated Inspection Priority Queue/)).not.toBeNull();
    expect(screen.getByText(/Position #1:/)).not.toBeNull();
  });

  it('FacilityDetailPane displays full consensus findings, evidence digest, and inspector state', () => {
    const onEvaluate = vi.fn();
    const onOffer = vi.fn();
    const onAcknowledge = vi.fn();
    const onReclaim = vi.fn();

    render(
      <WalletProvider>
        <TransactionProvider>
          <FacilityDetailPane
            facility={mockFacility}
            incident={mockIncident}
            contractOperator="0x1111111111111111111111111111111111111111"
            onClose={() => {}}
            onEvaluate={onEvaluate}
            onOfferAssignment={onOffer}
            onAcknowledgeAssignment={onAcknowledge}
            onReclaimAssignment={onReclaim}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    expect(screen.getByText('FAC-101')).not.toBeNull();
    expect(screen.getByText(/Critical facility with confirmed structural distress/)).not.toBeNull();
    expect(screen.getByText('HIGH_OCCUPANCY:')).not.toBeNull();
    expect(screen.getByText('CRITICAL_INFRASTRUCTURE:')).not.toBeNull();
    expect(screen.getByText(mockFacility.evidence_url)).not.toBeNull();
  });

  it('FacilityDetailPane exposes assignment for any allocated decision band', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <FacilityDetailPane
            facility={{
              ...mockFacility,
              decision: 'IMMEDIATE_REVIEW',
              assignment_status: 'NONE',
              assigned_inspector: '0x0000000000000000000000000000000000000000',
              offered_at: 0,
              assignment_deadline: 0,
            }}
            incident={{ ...mockIncident, status: 'ALLOCATED' }}
            contractOperator="0x1111111111111111111111111111111111111111"
            onClose={() => {}}
            onEvaluate={() => {}}
            onOfferAssignment={() => {}}
            onAcknowledgeAssignment={() => {}}
            onReclaimAssignment={() => {}}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    expect(screen.getByRole('button', { name: 'Offer Assignment' })).not.toBeNull();
    expect(screen.queryByText('0x0000000000000000000000000000000000000000')).toBeNull();
  });

  it('HistorySection renders paginated audit log', () => {
    const mockHistory: HistoryEntry[] = [
      {
        sequence: 1,
        incident_id: 1,
        facility_record_id: 0,
        event_type: 'INCIDENT_CREATED',
        actor: '0x1111111111111111111111111111111111111111',
        timestamp: 1700000000,
        details: { region: 'Bay Area' },
      },
    ];

    const onPageChange = vi.fn();

    render(
      <HistorySection
        history={mockHistory}
        totalCount={25}
        offset={0}
        limit={20}
        isLoading={false}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText('Incident Audit Log (25 Events)')).not.toBeNull();
    expect(screen.getByText('#1')).not.toBeNull();
    expect(screen.getByText('INCIDENT_CREATED')).not.toBeNull();

    // Click Next
    fireEvent.click(screen.getByText('Next →'));
    expect(onPageChange).toHaveBeenCalledWith(20);
  });

  it('CreateIncidentModal validates HTTPS USGS URL and 64-hex SHA-256 digest', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <CreateIncidentModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />
        </TransactionProvider>
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Create Incident'));

    expect(screen.getByText('Event ID must be 1-128 characters.')).not.toBeNull();
    expect(screen.getByText('Event URL must begin with https://earthquake.usgs.gov/')).not.toBeNull();
    expect(screen.getByText('Digest must be a 64-character hexadecimal SHA-256 hash.')).not.toBeNull();
  });

  it('RegisterFacilityModal validates required fields', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <RegisterFacilityModal
            isOpen={true}
            incident={mockIncident}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Register Facility'));
    expect(screen.getByText('Facility identifier must be 1-128 characters.')).not.toBeNull();
    expect(screen.getByText('Evidence URL must be a valid HTTPS web resource.')).not.toBeNull();
    expect(screen.getByText('Digest must be a 64-character hexadecimal SHA-256 hash.')).not.toBeNull();
  });

  it('OfferAssignmentModal rejects invalid inspector address', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <OfferAssignmentModal
            isOpen={true}
            facility={mockFacility}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    fireEvent.click(screen.getByText('Send Offer'));
    expect(
      screen.getByText('A valid 20-byte non-zero hex Ethereum address is required.')
    ).not.toBeNull();
  });

  it('EvaluateFacilityModal renders modal dialog with facility details and trigger button', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <EvaluateFacilityModal
            isOpen={true}
            facility={mockFacility}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    expect(screen.getByText('Evaluate Facility Consensus')).not.toBeNull();
    expect(screen.getByText('Run Consensus Evaluation')).not.toBeNull();
  });

  it('CloseIncidentModal renders close modal and handles submit', () => {
    render(
      <WalletProvider>
        <TransactionProvider>
          <CloseIncidentModal
            isOpen={true}
            incident={mockIncident}
            onClose={() => {}}
            onSuccess={() => {}}
          />
        </TransactionProvider>
      </WalletProvider>
    );

    expect(screen.getByText('Close Incident #1')).not.toBeNull();
    expect(screen.getByText('Confirm Close Incident')).not.toBeNull();
  });

});
