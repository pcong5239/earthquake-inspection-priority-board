import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TransactionPhase, TransactionState } from '../types/transaction';
import type { WriteResult } from '../services/contractService';

interface TransactionContextValue {
  txState: TransactionState;
  runTransaction: (
    title: string,
    executeFn: (
      onPhase: (phase: TransactionPhase, data?: { hash?: string; detail?: string }) => void
    ) => Promise<WriteResult>,
    readbackFn?: () => Promise<boolean>
  ) => Promise<WriteResult | null>;
  dismissTransaction: () => void;
}

const INITIAL_TX_STATE: TransactionState = {
  phase: 'IDLE',
  title: '',
  hash: null,
  error: null,
  details: null,
  readbackSuccess: false,
  startTime: null,
  lastUpdated: null,
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export const TransactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [txState, setTxState] = useState<TransactionState>(INITIAL_TX_STATE);

  const dismissTransaction = useCallback(() => {
    setTxState(INITIAL_TX_STATE);
  }, []);

  const runTransaction = useCallback(
    async (
      title: string,
      executeFn: (
        onPhase: (phase: TransactionPhase, data?: { hash?: string; detail?: string }) => void
      ) => Promise<WriteResult>,
      readbackFn?: () => Promise<boolean>
    ): Promise<WriteResult | null> => {
      const now = Date.now();
      setTxState({
        phase: 'VALIDATING',
        title,
        hash: null,
        error: null,
        details: 'Validating transaction parameters and network state...',
        readbackSuccess: false,
        startTime: now,
        lastUpdated: now,
      });

      const handlePhaseChange = (
        phase: TransactionPhase,
        data?: { hash?: string; detail?: string }
      ) => {
        setTxState((prev) => ({
          ...prev,
          phase,
          hash: data?.hash ?? prev.hash,
          details: data?.detail ?? getPhaseDescription(phase),
          lastUpdated: Date.now(),
        }));
      };

      try {
        const result = await executeFn(handlePhaseChange);

        // Transition: Finalized & Execution Verified -> Authoritative Readback
        if (readbackFn) {
          setTxState((prev) => ({
            ...prev,
            details: 'Performing authoritative contract state readback verification...',
            lastUpdated: Date.now(),
          }));

          try {
            const readbackPassed = await readbackFn();
            if (!readbackPassed) {
              setTxState((prev) => ({
                ...prev,
                phase: 'READBACK_ERROR',
                error: 'Authoritative state readback verification failed or state mismatch detected.',
                lastUpdated: Date.now(),
              }));
              return result;
            }
            handlePhaseChange('READBACK_VERIFIED', {
              hash: result.hash,
              detail: 'Contract state change authoritatively verified against storage.',
            });
          } catch (readbackErr: any) {
            setTxState((prev) => ({
              ...prev,
              phase: 'READBACK_ERROR',
              error: `Readback verification error: ${readbackErr?.message || String(readbackErr)}`,
              lastUpdated: Date.now(),
            }));
            return result;
          }
        }

        // All verified successfully
        setTxState((prev) => ({
          ...prev,
          phase: 'SUCCESS',
          hash: result.hash,
          details: 'Transaction finalized and contract state authoritatively verified.',
          readbackSuccess: true,
          lastUpdated: Date.now(),
        }));

        return result;
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        let terminalPhase: TransactionPhase = 'EXECUTION_ERROR';

        if (errMsg.includes('WALLET_REJECTED') || errMsg.toLowerCase().includes('rejected')) {
          terminalPhase = 'REJECTED';
        } else if (errMsg.includes('TIMEOUT') || errMsg.toLowerCase().includes('timeout')) {
          terminalPhase = 'TIMEOUT';
        } else if (errMsg.includes('CONFIG_ERROR')) {
          terminalPhase = 'CONFIG_ERROR';
        }

        setTxState((prev) => ({
          ...prev,
          phase: terminalPhase,
          error: errMsg,
          lastUpdated: Date.now(),
        }));
        return null;
      }
    },
    []
  );

  return (
    <TransactionContext.Provider
      value={{
        txState,
        runTransaction,
        dismissTransaction,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export function useTransaction(): TransactionContextValue {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return context;
}

function getPhaseDescription(phase: TransactionPhase): string {
  switch (phase) {
    case 'VALIDATING':
      return 'Validating inputs and contract address...';
    case 'AWAITING_SIGNATURE':
      return 'Please confirm and sign the transaction in your connected wallet.';
    case 'SUBMITTED':
      return 'Transaction broadcasted to GenLayer Studionet RPC.';
    case 'CONSENSUS':
      return 'Awaiting consensus among active validator nodes...';
    case 'FINALIZED':
      return 'Transaction reached finality. Verifying execution result...';
    case 'EXECUTION_VERIFIED':
      return 'Execution result verified (FINISHED_WITH_RETURN). Commencing state readback...';
    case 'READBACK_VERIFIED':
      return 'Authoritatively reading back updated contract storage...';
    case 'SUCCESS':
      return 'Operation completed and verified successfully.';
    case 'REJECTED':
      return 'Transaction was rejected by the wallet.';
    case 'EXECUTION_ERROR':
      return 'Transaction failed during smart contract execution.';
    case 'TIMEOUT':
      return 'Timed out waiting for consensus or finality receipt.';
    case 'READBACK_ERROR':
      return 'Readback verification encountered an inconsistency.';
    case 'CONFIG_ERROR':
      return 'Configuration or address format error.';
    case 'IDLE':
    default:
      return '';
  }
}
