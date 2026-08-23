import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { TransactionProvider } from './context/TransactionContext';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Header } from './components/Header';
import { IncidentSelector } from './components/IncidentSelector';
import { SpatialQueueBoard } from './components/SpatialQueueBoard';
import { FacilityDetailPane } from './components/FacilityDetailPane';
import { HistorySection } from './components/HistorySection';
import { TransactionTray } from './components/TransactionTray';
import { WalletModal } from './components/WalletModal';
import { Footer } from './components/Footer';

import { CreateIncidentModal } from './components/modals/CreateIncidentModal';
import { RegisterFacilityModal } from './components/modals/RegisterFacilityModal';
import { OfferAssignmentModal } from './components/modals/OfferAssignmentModal';
import { EvaluateFacilityModal } from './components/modals/EvaluateFacilityModal';
import { CloseIncidentModal } from './components/modals/CloseIncidentModal';

import type {
  IncidentRecord,
  FacilityRecord,
  QueueItem,
  WaitlistItem,
  HistoryEntry,
  ContractCaps,
  ContractInfo,
} from './types/contract';

import {
  fetchContractInfo,
  fetchCaps,
  fetchOperator,
  fetchActiveIncidents,
  fetchIncident,
  fetchFacility,
  fetchFacilities,
  fetchQueue,
  fetchWaitlist,
  fetchHistory,
  lockCohort,
  finalizeAllocation,
  acknowledgeAssignment,
  reclaimExpiredAssignment,
} from './services/contractService';
import { useTransaction } from './context/TransactionContext';
import { getContractAddress, STUDIONET_RPC_URL, STUDIONET_CHAIN_ID } from './config/chain';
import { pollUntilMatch } from './utils/readback';

const MainDashboard: React.FC = () => {
  const contractAddress = getContractAddress();
  const { walletState } = useWallet();
  const { runTransaction } = useTransaction();

  // Contract Level State
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [contractCaps, setContractCaps] = useState<ContractCaps | null>(null);
  const [contractOperator, setContractOperator] = useState<string | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<number[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

  // Selected Incident Data
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);

  // Selected Facility for Detail Pane
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [isCreateIncidentOpen, setIsCreateIncidentOpen] = useState(false);
  const [isRegisterFacilityOpen, setIsRegisterFacilityOpen] = useState(false);
  const [isOfferAssignmentOpen, setIsOfferAssignmentOpen] = useState(false);
  const [isEvaluateFacilityOpen, setIsEvaluateFacilityOpen] = useState(false);
  const [isCloseIncidentOpen, setIsCloseIncidentOpen] = useState(false);

  const isPollingRef = useRef(false);

  // Fetch Contract Metadata
  const loadContractMetadata = useCallback(async () => {
    if (!contractAddress) return;
    try {
      const [info, caps, op, actives] = await Promise.all([
        fetchContractInfo(contractAddress).catch(() => null),
        fetchCaps(contractAddress).catch(() => null),
        fetchOperator(contractAddress).catch(() => null),
        fetchActiveIncidents(contractAddress).catch((): number[] => []),
      ]);

      if (info) setContractInfo(info);
      if (caps) setContractCaps(caps);
      if (op) setContractOperator(op);
      setActiveIncidents(actives);

      if (actives.length > 0) {
        setSelectedIncidentId((prev) => (prev !== null && actives.includes(prev) ? prev : actives[0]));
      } else {
        setSelectedIncidentId(null);
        setSelectedIncident(null);
      }
    } catch (err: any) {
      setLoadError(`Failed to load contract state: ${err?.message || String(err)}`);
    }
  }, [contractAddress]);

  // Fetch Incident Details
  const loadIncidentDetails = useCallback(
    async (incId: number) => {
      if (!contractAddress) return;
      setIsLoading(true);
      try {
        const [inc, facsRes, queueRes, waitRes, histRes] = await Promise.all([
          fetchIncident(contractAddress, incId),
          fetchFacilities(contractAddress, incId, 0, 100),
          fetchQueue(contractAddress, incId, 0, 50),
          fetchWaitlist(contractAddress, incId, 0, 50),
          fetchHistory(contractAddress, incId, historyOffset, 20),
        ]);

        setSelectedIncident(inc);
        setFacilities(facsRes.facilities);
        setQueue(queueRes.queue);
        setWaitlist(waitRes.waitlist);
        setHistory(histRes.history);
        setHistoryTotalCount(histRes.total_history_count);
        setLoadError(null);
      } catch (err: any) {
        setLoadError(`Failed to fetch incident #${incId}: ${err?.message || String(err)}`);
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, historyOffset]
  );

  useEffect(() => {
    loadContractMetadata();
  }, [loadContractMetadata]);

  useEffect(() => {
    if (selectedIncidentId !== null) {
      loadIncidentDetails(selectedIncidentId);
    }
  }, [selectedIncidentId, loadIncidentDetails]);

  // Periodic gentle polling for active incident (bounded single-flight)
  useEffect(() => {
    if (!contractAddress || selectedIncidentId === null) return;

    const interval = setInterval(async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const [inc, facsRes, queueRes, waitRes, histRes] = await Promise.all([
          fetchIncident(contractAddress, selectedIncidentId),
          fetchFacilities(contractAddress, selectedIncidentId, 0, 100),
          fetchQueue(contractAddress, selectedIncidentId, 0, 50),
          fetchWaitlist(contractAddress, selectedIncidentId, 0, 50),
          fetchHistory(contractAddress, selectedIncidentId, historyOffset, 20),
        ]);

        setSelectedIncident(inc);
        setFacilities(facsRes.facilities);
        setQueue(queueRes.queue);
        setWaitlist(waitRes.waitlist);
        setHistory(histRes.history);
        setHistoryTotalCount(histRes.total_history_count);
      } catch {
        // Keep old validated data visible during transient network errors
      } finally {
        isPollingRef.current = false;
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [contractAddress, selectedIncidentId, historyOffset]);

  const selectedFacility =
    facilities.find((f) => f.record_id === selectedFacilityId) || null;

  // Direct Write Handlers
  const handleAcknowledgeAssignment = async () => {
    if (!contractAddress || !selectedFacility || !walletState.address || !walletState.provider) return;

    await runTransaction(
      `Acknowledge Assignment: ${selectedFacility.facility_id}`,
      (onPhase) =>
        acknowledgeAssignment(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          selectedFacility.incident_id,
          selectedFacility.record_id,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const fac = await fetchFacility(
            contractAddress,
            selectedFacility.incident_id,
            selectedFacility.record_id
          );
          return fac.assignment_status === 'ACKNOWLEDGED' && fac.acknowledged_at > 0;
        });
        if (passed && selectedIncidentId !== null) {
          await loadIncidentDetails(selectedIncidentId);
          return true;
        }
        return false;
      }
    );
  };

  const handleReclaimAssignment = async () => {
    if (!contractAddress || !selectedFacility || !walletState.address || !walletState.provider) return;

    await runTransaction(
      `Reclaim Expired Assignment: ${selectedFacility.facility_id}`,
      (onPhase) =>
        reclaimExpiredAssignment(
          contractAddress,
          walletState.address!,
          walletState.provider!,
          selectedFacility.incident_id,
          selectedFacility.record_id,
          (phase, data) => onPhase(phase as any, data)
        ),
      async () => {
        const passed = await pollUntilMatch(async () => {
          const fac = await fetchFacility(
            contractAddress,
            selectedFacility.incident_id,
            selectedFacility.record_id
          );
          return fac.assignment_status === 'EXPIRED' || fac.queue_position === 0;
        });
        if (passed && selectedIncidentId !== null) {
          await loadIncidentDetails(selectedIncidentId);
          return true;
        }
        return false;
      }
    );
  };

  if (!contractAddress) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DisclaimerBanner />
        <Header
          contractOperator={null}
          contractVersion={null}
          onOpenCreateIncident={() => {}}
        />

        <main style={{ flex: 1, maxWidth: '50rem', margin: '3rem auto', padding: '0 1rem' }}>
          <div className="panel" style={{ border: '2px solid var(--color-hazard)', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  backgroundColor: 'var(--color-hazard)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--color-ink-inverse)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                }}
              >
                !
              </div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
                Contract Configuration Required
              </h2>
            </div>

            <p style={{ lineHeight: 1.5, marginBottom: '1.25rem' }}>
              No contract address is configured in this deployment environment. All on-chain operations and live
              coordination views are paused until a valid GenLayer intelligent contract is deployed.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-bg-canvas-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--font-size-xs)',
                marginBottom: '1.25rem',
                lineHeight: 1.6,
              }}
            >
              <div><strong>Network:</strong> GenLayer Studionet (Chain ID {STUDIONET_CHAIN_ID})</div>
              <div><strong>RPC URL:</strong> {STUDIONET_RPC_URL}</div>
              <div><strong>Required Variable:</strong> <code>VITE_CONTRACT_ADDRESS</code> in <code>.env</code></div>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-ink-muted)' }}>
              To activate this priority board, deploy <code>contracts/earthquake_inspection_priority_board.py</code> to
              GenLayer Studionet and supply the resulting 20-byte hex address.
            </p>
          </div>
        </main>

        <Footer contractInfo={null} contractCaps={null} />
        <WalletModal />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DisclaimerBanner />
      <Header
        contractOperator={contractOperator}
        contractVersion={contractInfo?.version ?? null}
        onOpenCreateIncident={() => setIsCreateIncidentOpen(true)}
      />

      <main style={{ flex: 1, maxWidth: '80rem', margin: '0 auto', width: '100%', padding: '1rem' }}>
        {loadError && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-band-immediate-bg)',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.125rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
              onClick={() => {
                if (selectedIncidentId !== null) loadIncidentDetails(selectedIncidentId);
                else loadContractMetadata();
              }}
            >
              Retry
            </button>
          </div>
        )}

        <IncidentSelector
          activeIncidents={activeIncidents}
          selectedIncidentId={selectedIncidentId}
          selectedIncident={selectedIncident}
          isLoading={isLoading}
          contractOperator={contractOperator}
          onSelectIncident={(id) => setSelectedIncidentId(id)}
          onRegisterFacility={() => setIsRegisterFacilityOpen(true)}
          onLockCohort={() => {
            if (!contractAddress || !selectedIncident || !walletState.address || !walletState.provider) return;
            runTransaction(
              `Lock Cohort: Incident #${selectedIncident.incident_id}`,
              (onPhase) =>
                lockCohort(
                  contractAddress,
                  walletState.address!,
                  walletState.provider!,
                  selectedIncident.incident_id,
                  (phase, data) => onPhase(phase as any, data)
                ),
              async () => {
                const passed = await pollUntilMatch(async () => {
                  const inc = await fetchIncident(contractAddress, selectedIncident.incident_id);
                  return inc.status === 'COHORT_LOCKED' || inc.status === 'EVALUATING';
                });
                if (passed) {
                  await loadIncidentDetails(selectedIncident.incident_id);
                  return true;
                }
                return false;
              }
            );
          }}
          onFinalizeAllocation={() => {
            if (!contractAddress || !selectedIncident || !walletState.address || !walletState.provider) return;
            runTransaction(
              `Finalize Allocation: Incident #${selectedIncident.incident_id}`,
              (onPhase) =>
                finalizeAllocation(
                  contractAddress,
                  walletState.address!,
                  walletState.provider!,
                  selectedIncident.incident_id,
                  (phase, data) => onPhase(phase as any, data)
                ),
              async () => {
                const passed = await pollUntilMatch(async () => {
                  const inc = await fetchIncident(contractAddress, selectedIncident.incident_id);
                  return inc.status === 'ALLOCATED';
                });
                if (passed) {
                  await loadIncidentDetails(selectedIncident.incident_id);
                  return true;
                }
                return false;
              }
            );
          }}
          onCloseIncident={() => setIsCloseIncidentOpen(true)}
        />

        {selectedIncident && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedFacility ? '1fr 22rem' : '1fr', gap: '1rem' }}>
            <div>
              <SpatialQueueBoard
                incident={selectedIncident}
                facilities={facilities}
                queue={queue}
                waitlist={waitlist}
                selectedFacilityId={selectedFacilityId}
                onSelectFacility={(id) => setSelectedFacilityId(id)}
              />

              <HistorySection
                history={history}
                totalCount={historyTotalCount}
                offset={historyOffset}
                limit={20}
                isLoading={isLoading}
                onPageChange={(newOffset) => setHistoryOffset(newOffset)}
              />
            </div>

            {selectedFacility && (
              <FacilityDetailPane
                facility={selectedFacility}
                incident={selectedIncident}
                contractOperator={contractOperator}
                onClose={() => setSelectedFacilityId(null)}
                onEvaluate={() => setIsEvaluateFacilityOpen(true)}
                onOfferAssignment={() => setIsOfferAssignmentOpen(true)}
                onAcknowledgeAssignment={handleAcknowledgeAssignment}
                onReclaimAssignment={handleReclaimAssignment}
              />
            )}
          </div>
        )}
      </main>

      <Footer contractInfo={contractInfo} contractCaps={contractCaps} />

      {/* Write Modals */}
      <CreateIncidentModal
        isOpen={isCreateIncidentOpen}
        onClose={() => setIsCreateIncidentOpen(false)}
        onSuccess={loadContractMetadata}
      />

      {selectedIncident && (
        <>
          <RegisterFacilityModal
            isOpen={isRegisterFacilityOpen}
            incident={selectedIncident}
            onClose={() => setIsRegisterFacilityOpen(false)}
            onSuccess={() => loadIncidentDetails(selectedIncident.incident_id)}
          />

          <CloseIncidentModal
            isOpen={isCloseIncidentOpen}
            incident={selectedIncident}
            onClose={() => setIsCloseIncidentOpen(false)}
            onSuccess={loadContractMetadata}
          />
        </>
      )}

      {selectedFacility && (
        <>
          <OfferAssignmentModal
            isOpen={isOfferAssignmentOpen}
            facility={selectedFacility}
            onClose={() => setIsOfferAssignmentOpen(false)}
            onSuccess={() => selectedIncident && loadIncidentDetails(selectedIncident.incident_id)}
          />

          <EvaluateFacilityModal
            isOpen={isEvaluateFacilityOpen}
            facility={selectedFacility}
            onClose={() => setIsEvaluateFacilityOpen(false)}
            onSuccess={() => selectedIncident && loadIncidentDetails(selectedIncident.incident_id)}
          />
        </>
      )}

      <WalletModal />
      <TransactionTray />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <TransactionProvider>
        <MainDashboard />
      </TransactionProvider>
    </WalletProvider>
  );
};

export default App;
