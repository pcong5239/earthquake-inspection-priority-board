export type TransactionPhase =
  | 'IDLE'
  | 'VALIDATING'
  | 'AWAITING_SIGNATURE'
  | 'SUBMITTED'
  | 'CONSENSUS'
  | 'FINALIZED'
  | 'EXECUTION_VERIFIED'
  | 'READBACK_VERIFIED'
  | 'SUCCESS'
  | 'REJECTED'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'READBACK_ERROR'
  | 'CONFIG_ERROR';

export interface TransactionState {
  phase: TransactionPhase;
  title: string;
  hash: string | null;
  error: string | null;
  details: string | null;
  readbackSuccess?: boolean;
  startTime: number | null;
  lastUpdated: number | null;
}
