import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionProvider, useTransaction } from '../context/TransactionContext';
import { TransactionTray } from '../components/TransactionTray';
import type { TransactionPhase } from '../types/transaction';
import type { WriteResult } from '../services/contractService';

const TestTxConsumer = ({
  onExecute,
  onReadback,
}: {
  onExecute: (onPhase: (phase: TransactionPhase, data?: { hash?: string; detail?: string }) => void) => Promise<WriteResult>;
  onReadback?: () => Promise<boolean>;
}) => {
  const { runTransaction, txState } = useTransaction();

  return (
    <div>
      <div data-testid="tx-phase">{txState.phase}</div>
      <div data-testid="tx-hash">{txState.hash || 'none'}</div>
      <div data-testid="tx-error">{txState.error || 'none'}</div>
      <button
        type="button"
        onClick={() => runTransaction('Test Action', onExecute, onReadback)}
      >
        Trigger Tx
      </button>
    </div>
  );
};

describe('9-Phase Transaction Reconciliation State Machine', () => {
  it('transitions through all 8 happy-path phases and succeeds after authoritative readback', async () => {
    const dummyHash = '0x' + 'e'.repeat(64);

    const onExecute = async (onPhase: (phase: TransactionPhase, data?: { hash?: string; detail?: string }) => void): Promise<WriteResult> => {
      onPhase('SUBMITTED', { hash: dummyHash });
      onPhase('CONSENSUS', { hash: dummyHash });
      onPhase('FINALIZED', { hash: dummyHash });
      onPhase('EXECUTION_VERIFIED', { hash: dummyHash });
      return { hash: dummyHash, receipt: { status: 'FINALIZED' } as any };
    };

    const onReadback = vi.fn().mockResolvedValue(true);

    render(
      <TransactionProvider>
        <TestTxConsumer onExecute={onExecute} onReadback={onReadback} />
        <TransactionTray />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText('Trigger Tx'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-phase').textContent).toBe('SUCCESS');
    });

    expect(screen.getByTestId('tx-hash').textContent).toBe(dummyHash);
    expect(onReadback).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Transaction finalized and contract state authoritatively verified.')
    ).not.toBeNull();
  });

  it('transitions to READBACK_ERROR when authoritative state readback returns false or fails', async () => {
    const dummyHash = '0x' + 'd'.repeat(64);

    const onExecute = async (onPhase: (phase: TransactionPhase, data?: { hash?: string; detail?: string }) => void): Promise<WriteResult> => {
      onPhase('FINALIZED', { hash: dummyHash });
      return { hash: dummyHash, receipt: { status: 'FINALIZED' } as any };
    };

    const onReadback = vi.fn().mockResolvedValue(false); // Mismatch

    render(
      <TransactionProvider>
        <TestTxConsumer onExecute={onExecute} onReadback={onReadback} />
        <TransactionTray />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText('Trigger Tx'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-phase').textContent).toBe('READBACK_ERROR');
    });

    expect(screen.getByTestId('tx-error').textContent).toContain('readback verification failed');
  });

  it('transitions to REJECTED when wallet denies signature', async () => {
    const onExecute = async (): Promise<WriteResult> => {
      throw new Error('WALLET_REJECTED: User denied signature.');
    };

    render(
      <TransactionProvider>
        <TestTxConsumer onExecute={onExecute} />
        <TransactionTray />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText('Trigger Tx'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-phase').textContent).toBe('REJECTED');
    });

    expect(screen.getByTestId('tx-error').textContent).toContain('User denied signature');
  });

  it('transitions to TIMEOUT when consensus is not reached within deadline', async () => {
    const onExecute = async (): Promise<WriteResult> => {
      throw new Error('TIMEOUT: Transaction receipt not finalized within 120s');
    };

    render(
      <TransactionProvider>
        <TestTxConsumer onExecute={onExecute} />
        <TransactionTray />
      </TransactionProvider>
    );

    fireEvent.click(screen.getByText('Trigger Tx'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-phase').textContent).toBe('TIMEOUT');
    });

    expect(screen.getByTestId('tx-error').textContent).toContain('TIMEOUT');
  });
});
