import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sharedReadQueue,
  fetchVersion,
  fetchOperator,
  fetchIncidentCount,
  fetchActiveIncidents,
  fetchCaps,
  fetchContractInfo,
  fetchIncident,
  fetchFacilityCount,
  fetchFacility,
  fetchFacilities,
  fetchQueue,
  fetchWaitlist,
  fetchHistoryCount,
  fetchHistory,
  createIncident,
  registerFacility,
  lockCohort,
  evaluateFacility,
  finalizeAllocation,
  offerAssignment,
  acknowledgeAssignment,
  reclaimExpiredAssignment,
  closeIncident,
  upgrade,
  executeContractWrite,
} from '../services/contractService';
import type { EIP1193Provider } from '../types/wallet';

const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockGetTransaction = vi.fn();

vi.mock('genlayer-js', () => ({
  createClient: vi.fn(() => ({
    readContract: mockReadContract,
    writeContract: mockWriteContract,
    getTransaction: mockGetTransaction,
  })),
}));

describe('GenLayer Contract Service & Exact 14-View / 10-Write ABI Parity', () => {
  const dummyContract: `0x${string}` = '0x1111111111111111111111111111111111111111';
  const dummyAccount = '0x2222222222222222222222222222222222222222';
  const dummyProvider: EIP1193Provider = {
    request: vi.fn().mockResolvedValue('0xf22f'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bounded FIFO read queue serializes execution and processes in order', async () => {
    let running = 0;
    let maxObserved = 0;
    const executionOrder: number[] = [];

    const makeTask = (id: number, delayMs: number) => () =>
      sharedReadQueue.enqueue(async () => {
        running++;
        maxObserved = Math.max(maxObserved, running);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        executionOrder.push(id);
        running--;
        return id;
      });

    const tasks = [
      makeTask(1, 40),
      makeTask(2, 40),
      makeTask(3, 40),
      makeTask(4, 20),
      makeTask(5, 20),
    ];

    const results = await Promise.all(tasks.map((t) => t()));

    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(maxObserved).toBe(1);
    expect(executionOrder.length).toBe(5);
  });

  it('retries transient RPC reads but not permanent validation failures', async () => {
    vi.useFakeTimers();
    try {
      const transient = vi.fn()
        .mockRejectedValueOnce(new Error('RPC server busy'))
        .mockResolvedValueOnce('recovered');
      const recovered = sharedReadQueue.enqueue(transient);
      await vi.advanceTimersByTimeAsync(750);
      await expect(recovered).resolves.toBe('recovered');
      expect(transient).toHaveBeenCalledTimes(2);

      const permanent = vi.fn().mockRejectedValue(new Error('Malformed contract response'));
      await expect(sharedReadQueue.enqueue(permanent)).rejects.toThrow('Malformed contract response');
      expect(permanent).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exercises all exact 14 view methods against contract specifications', async () => {
    // 1. get_version
    mockReadContract.mockResolvedValueOnce(1);
    const ver = await fetchVersion(dummyContract);
    expect(ver).toBe(1);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_version', args: [] })
    );

    // 2. get_operator
    mockReadContract.mockResolvedValueOnce('0x1234567890123456789012345678901234567890');
    const op = await fetchOperator(dummyContract);
    expect(op).toBe('0x1234567890123456789012345678901234567890');
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_operator', args: [] })
    );

    // 3. get_incident_count
    mockReadContract.mockResolvedValueOnce(5);
    const incCount = await fetchIncidentCount(dummyContract);
    expect(incCount).toBe(5);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_incident_count', args: [] })
    );

    // 4. get_active_incidents
    mockReadContract.mockResolvedValueOnce(JSON.stringify([1, 2]));
    const actives = await fetchActiveIncidents(dummyContract);
    expect(actives).toEqual([1, 2]);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_active_incidents', args: [] })
    );

    // 5. get_caps
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({
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
      })
    );
    const caps = await fetchCaps(dummyContract);
    expect(caps.max_incidents).toBe(16);
    expect(caps.score_bands.PRIORITY_QUEUE).toEqual([55, 79]);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_caps', args: [] })
    );

    // 6. get_contract_info
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        operator: '0x1234567890123456789012345678901234567890',
        incident_count: 5,
        upgraders: ['0x3333333333333333333333333333333333333333'],
      })
    );
    const info = await fetchContractInfo(dummyContract);
    expect(info.version).toBe(1);
    expect(info.upgraders).toEqual(['0x3333333333333333333333333333333333333333']);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_contract_info', args: [] })
    );

    // 7. get_incident
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({
        incident_id: 1,
        event_id: 'ev1',
        event_url: 'https://earthquake.usgs.gov/1',
        expected_event_digest: 'a'.repeat(64),
        region_label: 'Reg1',
        allowed_location_buckets: ['A'],
        event_occurred_at: 1000,
        max_event_age_seconds: 500,
        slot_count: 5,
        assignment_timeout_seconds: 100,
        policy_text: 'Policy',
        policy_version: 1,
        status: 'DRAFT',
        facility_count: 0,
        history_count: 0,
        allocated_count: 0,
        created_at: 1000,
        locked_at: 0,
        allocated_at: 0,
      })
    );
    const inc = await fetchIncident(dummyContract, 1);
    expect(inc.incident_id).toBe(1);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_incident', args: [1] })
    );

    // 8. get_facility_count
    mockReadContract.mockResolvedValueOnce(12);
    const facCount = await fetchFacilityCount(dummyContract, 1);
    expect(facCount).toBe(12);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_facility_count', args: [1] })
    );

    // 9. get_facility
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({
        record_id: 1,
        incident_id: 1,
        facility_id: 'FAC-1',
        location_bucket: 'A',
        use_class: 'HOSPITAL',
        age_band: 'PRE_1975',
        occupancy_band: 'HIGH_DENSITY',
        evidence_url: 'https://evidence/1',
        expected_evidence_digest: 'b'.repeat(64),
        status: 'REGISTERED',
        decision: 'NONE',
        priority_score: 0,
        eligible: false,
        evidence_status: 'NONE',
        reason_codes: [],
        reason: '',
        evaluation_attempts: 0,
        queue_position: 0,
        waitlist_position: 0,
        assignment_status: 'NONE',
        assigned_inspector: '',
        offered_at: 0,
        assignment_deadline: 0,
        acknowledged_at: 0,
      })
    );
    const fac = await fetchFacility(dummyContract, 1, 1);
    expect(fac.facility_id).toBe('FAC-1');
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_facility', args: [1, 1] })
    );

    // 10. get_facilities
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({ total_count: 1, offset: 0, limit: 10, facilities: [] })
    );
    const facs = await fetchFacilities(dummyContract, 1, 0, 10);
    expect(facs.total_count).toBe(1);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_facilities', args: [1, 0, 10] })
    );

    // 11. get_queue
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({ total_queue_count: 0, offset: 0, limit: 10, queue: [] })
    );
    const q = await fetchQueue(dummyContract, 1);
    expect(q.total_queue_count).toBe(0);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_queue', args: [1, 0, 20] })
    );

    // 12. get_waitlist
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({ total_waitlist_count: 0, offset: 0, limit: 10, waitlist: [] })
    );
    const w = await fetchWaitlist(dummyContract, 1);
    expect(w.total_waitlist_count).toBe(0);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_waitlist', args: [1, 0, 20] })
    );

    // 13. get_history_count
    mockReadContract.mockResolvedValueOnce(30);
    const histCount = await fetchHistoryCount(dummyContract, 1);
    expect(histCount).toBe(30);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_history_count', args: [1] })
    );

    // 14. get_history
    mockReadContract.mockResolvedValueOnce(
      JSON.stringify({ total_history_count: 0, offset: 0, limit: 10, history: [] })
    );
    const h = await fetchHistory(dummyContract, 1);
    expect(h.total_history_count).toBe(0);
    expect(mockReadContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'get_history', args: [1, 0, 20] })
    );
  });

  it('exercises all exact 10 write methods with strict argument structures', async () => {
    mockWriteContract.mockResolvedValue('0x' + 'f'.repeat(64));
    mockGetTransaction.mockResolvedValue({
      status: 'FINALIZED',
      result_name: 'MAJORITY_AGREE',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
      returnData: null,
    });

    const phases: string[] = [];
    const onPhase = (p: string) => phases.push(p);

    // 1. create_incident
    const res1 = await createIncident(
      dummyContract,
      dummyAccount,
      dummyProvider,
      {
        event_id: 'ev1',
        event_url: 'https://earthquake.usgs.gov/1',
        expected_event_digest: 'a'.repeat(64),
        region_label: 'Reg1',
        allowed_location_buckets: ['A'],
        event_occurred_at: 1000,
        max_event_age_seconds: 500,
        slot_count: 5,
        assignment_timeout_seconds: 100,
        policy_text: 'Policy',
        policy_version: 1,
      },
      onPhase
    );
    expect(res1.hash).toBe('0x' + 'f'.repeat(64));
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        functionName: 'create_incident',
        args: [
          'ev1',
          'https://earthquake.usgs.gov/1',
          'a'.repeat(64),
          'Reg1',
          ['A'],
          1000,
          500,
          5,
          100,
          'Policy',
          1,
        ],
      })
    );

    // 2. register_facility
    await registerFacility(
      dummyContract,
      dummyAccount,
      dummyProvider,
      {
        incident_id: 1,
        facility_id: 'FAC-1',
        location_bucket: 'A',
        use_class: 'HOSPITAL',
        age_band: 'PRE_1975',
        occupancy_band: 'HIGH_DENSITY',
        evidence_url: 'https://evidence',
        expected_evidence_digest: 'b'.repeat(64),
      }
    );
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        functionName: 'register_facility',
        args: [
          1,
          'FAC-1',
          'A',
          'HOSPITAL',
          'PRE_1975',
          'HIGH_DENSITY',
          'https://evidence',
          'b'.repeat(64),
        ],
      })
    );

    // 3. lock_cohort
    await lockCohort(dummyContract, dummyAccount, dummyProvider, 1);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'lock_cohort', args: [1] })
    );

    // 4. evaluate_facility
    await evaluateFacility(dummyContract, dummyAccount, dummyProvider, 1, 2);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'evaluate_facility', args: [1, 2] })
    );

    // 5. finalize_allocation
    await finalizeAllocation(dummyContract, dummyAccount, dummyProvider, 1);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'finalize_allocation', args: [1] })
    );

    // 6. offer_assignment
    await offerAssignment(
      dummyContract,
      dummyAccount,
      dummyProvider,
      1,
      2,
      '0x3333333333333333333333333333333333333333'
    );
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        functionName: 'offer_assignment',
        args: [1, 2, '0x3333333333333333333333333333333333333333'],
      })
    );

    // 7. acknowledge_assignment
    await acknowledgeAssignment(dummyContract, dummyAccount, dummyProvider, 1, 2);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'acknowledge_assignment', args: [1, 2] })
    );

    // 8. reclaim_expired_assignment
    await reclaimExpiredAssignment(dummyContract, dummyAccount, dummyProvider, 1, 2);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'reclaim_expired_assignment', args: [1, 2] })
    );

    // 9. close_incident (exactly 1 argument: [incident_id])
    await closeIncident(dummyContract, dummyAccount, dummyProvider, 1);
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({ functionName: 'close_incident', args: [1] })
    );

    // 10. upgrade (exactly 1 argument: [new_code_bytes])
    await upgrade(dummyContract, dummyAccount, dummyProvider, 'new python code');
    expect(mockWriteContract).toHaveBeenLastCalledWith(
      expect.objectContaining({
        functionName: 'upgrade',
        args: [expect.anything()],
      })
    );
    const lastCallArgs = mockWriteContract.mock.lastCall?.[0]?.args;
    expect(ArrayBuffer.isView(lastCallArgs?.[0])).toBe(true);
  });

  describe('Fail-Closed Transaction Receipt Lifecycle & Verification', () => {
    it('blocks writes when the selected provider is not on Studionet', async () => {
      const wrongNetworkProvider: EIP1193Provider = { request: vi.fn().mockResolvedValue('0x1') };
      await expect(
        executeContractWrite(dummyContract, dummyAccount, wrongNetworkProvider, 'lock_cohort', [1])
      ).rejects.toThrow('CONFIG_ERROR');
      expect(mockWriteContract).not.toHaveBeenCalled();
    });

    it('accepts strictly FINALIZED + FINISHED_WITH_RETURN as happy path', async () => {
      mockWriteContract.mockResolvedValue('0x' + '1'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        status: 'FINALIZED',
        result_name: 'MAJORITY_AGREE',
        txExecutionResultName: 'FINISHED_WITH_RETURN',
        returnData: { success: true },
      });

      const res = await executeContractWrite(
        dummyContract,
        dummyAccount,
        dummyProvider,
        'lock_cohort',
        [1]
      );
      expect(res.hash).toBe('0x' + '1'.repeat(64));
      expect(res.returnData).toEqual({ success: true });
    });

    it('rejects ACCEPTED receipt status from qualifying as finality and polls until timeout', async () => {
      vi.useFakeTimers();
      try {
        mockWriteContract.mockResolvedValue('0x' + '2'.repeat(64));
        // Always returns ACCEPTED
        mockGetTransaction.mockResolvedValue({
          status: 'ACCEPTED',
          txExecutionResultName: 'FINISHED_WITH_RETURN',
        });

        const assertion = expect(
          executeContractWrite(
            dummyContract,
            dummyAccount,
            dummyProvider,
            'lock_cohort',
            [1]
          )
        ).rejects.toThrow('TIMEOUT');

        // Fast forward past 120s timeout
        await vi.advanceTimersByTimeAsync(130_000);
        await assertion;
      } finally {
        vi.useRealTimers();
      }
    });

    it('fails closed when execution result is FINISHED_WITH_ERROR', async () => {
      mockWriteContract.mockResolvedValue('0x' + '3'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        status: 'FINALIZED',
        result_name: 'MAJORITY_AGREE',
        txExecutionResultName: 'FINISHED_WITH_ERROR',
        errorMessage: 'Caller is not operator',
      });

      await expect(
        executeContractWrite(
          dummyContract,
          dummyAccount,
          dummyProvider,
          'lock_cohort',
          [1]
        )
      ).rejects.toThrow('EXECUTION_ERROR: Caller is not operator');
    });

    it('fails closed when execution result is missing or malformed', async () => {
      mockWriteContract.mockResolvedValue('0x' + '4'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        status: 'FINALIZED',
        result_name: 'MAJORITY_AGREE',
        // missing txExecutionResultName
      });

      await expect(
        executeContractWrite(
          dummyContract,
          dummyAccount,
          dummyProvider,
          'lock_cohort',
          [1]
        )
      ).rejects.toThrow('EXECUTION_ERROR');
    });

    it('fails closed when a finalized transaction lacks majority agreement', async () => {
      mockWriteContract.mockResolvedValue('0x' + '8'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        statusName: 'FINALIZED',
        result_name: 'UNDETERMINED',
        consensus_data: { leader_receipt: [{ mode: 'leader', execution_result: 'SUCCESS' }] },
      });

      await expect(
        executeContractWrite(dummyContract, dummyAccount, dummyProvider, 'lock_cohort', [1])
      ).rejects.toThrow('majority agreement');
    });

    it('accepts the live Studionet getTransaction FINALIZED leader SUCCESS shape', async () => {
      mockWriteContract.mockResolvedValue('0x' + '5'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        status: 7,
        statusName: 'FINALIZED',
        result_name: 'MAJORITY_AGREE',
        consensus_data: {
          leader_receipt: [
            {
              mode: 'leader',
              execution_result: 'SUCCESS',
              result: { payload: { readable: 'null' } },
              genvm_result: { stderr: '' },
            },
          ],
        },
      });

      const result = await executeContractWrite(
        dummyContract,
        dummyAccount,
        dummyProvider,
        'lock_cohort',
        [1]
      );
      expect(result.returnData).toBe('null');
    });

    it('fails closed immediately when receipt status is terminal CANCELED or UNDETERMINED', async () => {
      mockWriteContract.mockResolvedValue('0x' + '6'.repeat(64));
      mockGetTransaction.mockResolvedValue({
        status: 'CANCELED',
      });

      await expect(
        executeContractWrite(
          dummyContract,
          dummyAccount,
          dummyProvider,
          'lock_cohort',
          [1]
        )
      ).rejects.toThrow('TERMINAL_STATUS');
    });

    it('recovers from transient polling errors and successfully finalizes', async () => {
      mockWriteContract.mockResolvedValue('0x' + '7'.repeat(64));
      mockGetTransaction
        .mockRejectedValueOnce(new Error('Network gateway timeout 504'))
        .mockResolvedValueOnce({
          status: 'FINALIZED',
          result_name: 'MAJORITY_AGREE',
          txExecutionResultName: 'FINISHED_WITH_RETURN',
        });

      const res = await executeContractWrite(
        dummyContract,
        dummyAccount,
        dummyProvider,
        'lock_cohort',
        [1]
      );
      expect(res.hash).toBe('0x' + '7'.repeat(64));
    });

    it('fails closed when user rejects signature in wallet', async () => {
      mockWriteContract.mockRejectedValue(new Error('User rejected the request.'));

      await expect(
        executeContractWrite(
          dummyContract,
          dummyAccount,
          dummyProvider,
          'lock_cohort',
          [1]
        )
      ).rejects.toThrow('WALLET_REJECTED');
    });
  });
});
