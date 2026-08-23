import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus, ExecutionResult } from 'genlayer-js/types';
import type {
  IncidentRecord,
  FacilityRecord,
  QueueItem,
  WaitlistItem,
  HistoryEntry,
  ContractCaps,
  ContractInfo,
  CreateIncidentParams,
  RegisterFacilityParams,
} from '../types/contract';
import type { EIP1193Provider } from '../types/wallet';
import {
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
import { isValidAddress } from '../config/chain';

class BoundedReadQueue {
  private maxConcurrency: number;
  private runningCount = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.runningCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.runningCount++;
    try {
      for (let attempt = 1; ; attempt++) {
        try {
          return await task();
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          const transient = /rpc|failed to fetch|server busy|429|timeout|gateway/.test(message);
          if (!transient || attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
      }
    } finally {
      this.runningCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  get queueLength(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.runningCount;
  }
}

export const sharedReadQueue = new BoundedReadQueue(1);

export function createReadOnlyClient() {
  return createClient({
    chain: studionet,
  });
}

export function createWriteClient(accountAddress: string, provider: EIP1193Provider) {
  if (!isValidAddress(accountAddress)) {
    throw new Error(`Invalid sender account address: ${accountAddress}`);
  }
  return createClient({
    chain: studionet,
    account: accountAddress.toLowerCase() as `0x${string}`,
    provider: provider as any,
  });
}

// ---------------------------------------------------------------------------
// Contract View Functions (All 14 methods)
// ---------------------------------------------------------------------------

export async function fetchVersion(contractAddress: `0x${string}`): Promise<number> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_version',
      args: [],
    });
    if (typeof raw !== 'number' && typeof raw !== 'bigint') {
      throw new Error(`Invalid version returned: ${String(raw)}`);
    }
    return Number(raw);
  });
}

export async function fetchOperator(contractAddress: `0x${string}`): Promise<string> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_operator',
      args: [],
    });
    if (typeof raw !== 'string') {
      throw new Error(`Invalid operator address returned: ${String(raw)}`);
    }
    return raw;
  });
}

export async function fetchIncidentCount(contractAddress: `0x${string}`): Promise<number> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_incident_count',
      args: [],
    });
    if (typeof raw !== 'number' && typeof raw !== 'bigint') {
      throw new Error(`Invalid incident count: ${String(raw)}`);
    }
    return Number(raw);
  });
}

export async function fetchActiveIncidents(contractAddress: `0x${string}`): Promise<number[]> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_active_incidents',
      args: [],
    });
    return parseActiveIncidents(raw);
  });
}

export async function fetchCaps(contractAddress: `0x${string}`): Promise<ContractCaps> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_caps',
      args: [],
    });
    const parsed = parseContractCaps(raw);
    if (!parsed) {
      throw new Error(`Malformed contract caps payload: ${String(raw)}`);
    }
    return parsed;
  });
}

export const fetchContractCaps = fetchCaps;

export async function fetchContractInfo(contractAddress: `0x${string}`): Promise<ContractInfo> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_contract_info',
      args: [],
    });
    const parsed = parseContractInfo(raw);
    if (!parsed) {
      throw new Error(`Malformed contract info payload from get_contract_info: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchIncident(
  contractAddress: `0x${string}`,
  incidentId: number
): Promise<IncidentRecord> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_incident',
      args: [incidentId],
    });
    const parsed = parseIncidentRecord(raw);
    if (!parsed) {
      throw new Error(`Malformed or non-existent incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchFacilityCount(
  contractAddress: `0x${string}`,
  incidentId: number
): Promise<number> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_facility_count',
      args: [incidentId],
    });
    if (typeof raw !== 'number' && typeof raw !== 'bigint') {
      throw new Error(`Invalid facility count: ${String(raw)}`);
    }
    return Number(raw);
  });
}

export async function fetchFacility(
  contractAddress: `0x${string}`,
  incidentId: number,
  recordId: number
): Promise<FacilityRecord> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_facility',
      args: [incidentId, recordId],
    });
    const parsed = parseFacilityRecord(raw);
    if (!parsed) {
      throw new Error(`Malformed or non-existent facility #${recordId} for incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchFacilities(
  contractAddress: `0x${string}`,
  incidentId: number,
  offset = 0,
  limit = 20
): Promise<{ total_count: number; offset: number; limit: number; facilities: FacilityRecord[] }> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_facilities',
      args: [incidentId, offset, limit],
    });
    const parsed = parseFacilitiesList(raw);
    if (!parsed) {
      throw new Error(`Malformed facilities list for incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchQueue(
  contractAddress: `0x${string}`,
  incidentId: number,
  offset = 0,
  limit = 20
): Promise<{ total_queue_count: number; offset: number; limit: number; queue: QueueItem[] }> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_queue',
      args: [incidentId, offset, limit],
    });
    const parsed = parseQueueList(raw);
    if (!parsed) {
      throw new Error(`Malformed queue list for incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchWaitlist(
  contractAddress: `0x${string}`,
  incidentId: number,
  offset = 0,
  limit = 20
): Promise<{ total_waitlist_count: number; offset: number; limit: number; waitlist: WaitlistItem[] }> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_waitlist',
      args: [incidentId, offset, limit],
    });
    const parsed = parseWaitlistList(raw);
    if (!parsed) {
      throw new Error(`Malformed waitlist list for incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

export async function fetchHistoryCount(
  contractAddress: `0x${string}`,
  incidentId: number
): Promise<number> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_history_count',
      args: [incidentId],
    });
    if (typeof raw !== 'number' && typeof raw !== 'bigint') {
      throw new Error(`Invalid history count: ${String(raw)}`);
    }
    return Number(raw);
  });
}

export async function fetchHistory(
  contractAddress: `0x${string}`,
  incidentId: number,
  offset = 0,
  limit = 20
): Promise<{ total_history_count: number; offset: number; limit: number; history: HistoryEntry[] }> {
  return sharedReadQueue.enqueue(async () => {
    const client = createReadOnlyClient();
    const raw = await client.readContract({
      address: contractAddress,
      functionName: 'get_history',
      args: [incidentId, offset, limit],
    });
    const parsed = parseHistoryList(raw);
    if (!parsed) {
      throw new Error(`Malformed history list for incident #${incidentId}: ${String(raw)}`);
    }
    return parsed;
  });
}

// ---------------------------------------------------------------------------
// Write Execution Helper with Strict Finality & Execution Result Verification
// ---------------------------------------------------------------------------

export interface WriteResult {
  hash: string;
  receipt: unknown;
  returnData?: unknown;
}

export async function executeContractWrite(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  functionName: string,
  args: unknown[],
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  if (onPhaseChange) onPhaseChange('VALIDATING', { detail: `Validating transaction parameters for ${functionName}` });

  const chainId = await provider.request({ method: 'eth_chainId' });
  const normalizedChainId = String(chainId).toLowerCase();
  if (normalizedChainId !== '0xf22f' && normalizedChainId !== '61999') {
    throw new Error('CONFIG_ERROR: Connected wallet is not on GenLayer Studionet (chain 61999).');
  }

  const client = createWriteClient(accountAddress, provider);

  if (onPhaseChange) onPhaseChange('AWAITING_SIGNATURE', { detail: 'Awaiting signature approval from wallet' });

  let txHash: string;
  try {
    const hashResult = await client.writeContract({
      address: contractAddress,
      functionName,
      args: args as any,
      value: 0n,
    });
    txHash = typeof hashResult === 'string' ? hashResult : String(hashResult);
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    if (
      errMessage.toLowerCase().includes('user rejected') ||
      errMessage.toLowerCase().includes('user denied') ||
      errMessage.toLowerCase().includes('rejected') ||
      (err as any)?.code === 4001
    ) {
      throw new Error(`WALLET_REJECTED: ${errMessage}`);
    }
    throw new Error(`SUBMISSION_FAILED: ${errMessage}`);
  }

  if (onPhaseChange) onPhaseChange('SUBMITTED', { hash: txHash });

  // Polling for strict finality and consensus
  if (onPhaseChange) onPhaseChange('CONSENSUS', { hash: txHash, detail: 'Waiting for consensus finalization' });

  const startTime = Date.now();
  const timeoutMs = 120_000;
  const pollIntervalMs = 2_000;

  let isFinalized = false;
  let finalizedReceipt: any = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await client.getTransaction({ hash: txHash as any });
      if (receipt && typeof receipt === 'object') {
        const rawStatus = (receipt as any).statusName ?? (receipt as any).status;
        if (typeof rawStatus === 'string') {
          const statusUpper = rawStatus.toUpperCase();
          if (statusUpper === TransactionStatus.FINALIZED || statusUpper === 'FINALIZED') {
            isFinalized = true;
            finalizedReceipt = receipt;
            break;
          }
          if (
            statusUpper === TransactionStatus.CANCELED ||
            statusUpper === 'CANCELED' ||
            statusUpper === TransactionStatus.UNDETERMINED ||
            statusUpper === 'UNDETERMINED'
          ) {
            throw new Error(`TERMINAL_STATUS: Transaction resolved with unaccepted terminal status: ${statusUpper}`);
          }
        }
      }
    } catch (pollErr: unknown) {
      const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
      if (msg.includes('TERMINAL_STATUS')) throw pollErr;
      // Transient RPC error during poll, continue loop
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (!isFinalized || !finalizedReceipt) {
    throw new Error(`TIMEOUT: Transaction receipt not finalized within ${timeoutMs / 1000}s`);
  }

  if (onPhaseChange) onPhaseChange('FINALIZED', { hash: txHash });

  if (String(finalizedReceipt.result_name).toUpperCase() !== 'MAJORITY_AGREE') {
    throw new Error('EXECUTION_ERROR: Finalized transaction did not reach majority agreement');
  }

  // Verification of execution result
  const leaderReceipts = finalizedReceipt.consensus_data?.leader_receipt;
  const leaderReceipt = Array.isArray(leaderReceipts)
    ? leaderReceipts.find((item: any) => item?.mode === 'leader')
    : leaderReceipts;
  const execResult =
    leaderReceipt?.execution_result ??
    finalizedReceipt.txExecutionResultName ??
    finalizedReceipt.executionResult ??
    finalizedReceipt.execution_result ??
    finalizedReceipt.resultName;

  if (typeof execResult !== 'string') {
    throw new Error(`EXECUTION_ERROR: Missing or malformed execution result in finalized receipt`);
  }

  const execResultUpper = execResult.toUpperCase();

  if (
    execResultUpper !== ExecutionResult.FINISHED_WITH_RETURN &&
    execResultUpper !== 'FINISHED_WITH_RETURN' &&
    execResultUpper !== 'SUCCESS'
  ) {
    const errorDetails =
      leaderReceipt?.genvm_result?.stderr ||
      finalizedReceipt.errorMessage ||
      finalizedReceipt.error ||
      finalizedReceipt.txExecutionResult ||
      `Execution failed with status: ${execResultUpper}`;
    throw new Error(`EXECUTION_ERROR: ${String(errorDetails)}`);
  }

  if (onPhaseChange) onPhaseChange('EXECUTION_VERIFIED', { hash: txHash });

  return {
    hash: txHash,
    receipt: finalizedReceipt,
    returnData:
      leaderReceipt?.result?.payload?.readable ??
      finalizedReceipt.returnData ??
      finalizedReceipt.return_data,
  };
}

// ---------------------------------------------------------------------------
// Contract Write Functions (All 10 methods)
// ---------------------------------------------------------------------------

export async function createIncident(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  params: CreateIncidentParams,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  const args = [
    params.event_id,
    params.event_url,
    params.expected_event_digest.toLowerCase(),
    params.region_label,
    params.allowed_location_buckets,
    params.event_occurred_at,
    params.max_event_age_seconds,
    params.slot_count,
    params.assignment_timeout_seconds,
    params.policy_text,
    params.policy_version,
  ];

  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'create_incident',
    args,
    onPhaseChange
  );
}

export async function registerFacility(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  params: RegisterFacilityParams,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  const args = [
    params.incident_id,
    params.facility_id,
    params.location_bucket,
    params.use_class,
    params.age_band,
    params.occupancy_band,
    params.evidence_url,
    params.expected_evidence_digest.toLowerCase(),
  ];

  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'register_facility',
    args,
    onPhaseChange
  );
}

export async function lockCohort(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'lock_cohort',
    [incidentId],
    onPhaseChange
  );
}

export async function evaluateFacility(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  recordId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'evaluate_facility',
    [incidentId, recordId],
    onPhaseChange
  );
}

export async function finalizeAllocation(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'finalize_allocation',
    [incidentId],
    onPhaseChange
  );
}

export async function offerAssignment(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  recordId: number,
  inspectorAddress: string,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  if (!isValidAddress(inspectorAddress)) {
    throw new Error(`Invalid inspector address: ${inspectorAddress}`);
  }
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'offer_assignment',
    [incidentId, recordId, inspectorAddress.toLowerCase()],
    onPhaseChange
  );
}

export async function acknowledgeAssignment(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  recordId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'acknowledge_assignment',
    [incidentId, recordId],
    onPhaseChange
  );
}

export async function reclaimExpiredAssignment(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  recordId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'reclaim_expired_assignment',
    [incidentId, recordId],
    onPhaseChange
  );
}

export async function closeIncident(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  incidentId: number,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'close_incident',
    [incidentId],
    onPhaseChange
  );
}

export async function upgrade(
  contractAddress: `0x${string}`,
  accountAddress: string,
  provider: EIP1193Provider,
  newCodeBytes: Uint8Array | number[] | string,
  onPhaseChange?: (phase: string, data?: { hash?: string; detail?: string }) => void
): Promise<WriteResult> {
  let bytesArg: Uint8Array | number[];
  if (typeof newCodeBytes === 'string') {
    bytesArg = new TextEncoder().encode(newCodeBytes);
  } else {
    bytesArg = newCodeBytes;
  }

  return executeContractWrite(
    contractAddress,
    accountAddress,
    provider,
    'upgrade',
    [bytesArg],
    onPhaseChange
  );
}
