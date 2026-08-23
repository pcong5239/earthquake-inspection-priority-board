import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WalletProvider, useWallet } from './context/WalletContext';
import { TransactionProvider, useTransaction } from './context/TransactionContext';
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
import {
  getContractAddress,
  getExplorerAddressUrl,
  STUDIONET_RPC_URL,
  STUDIONET_CHAIN_ID,
} from './config/chain';
import { formatAddress } from './utils/formatters';
import { pollUntilMatch } from './utils/readback';

export type MetadataStatus = 'LOADING' | 'READY' | 'ERROR';

const LIFECYCLE_STEPS = [
  {
    num: '1',
    name: 'Commit Evidence',
    phaseKey: 'DRAFT',
    desc: 'Operator registers incident with USGS event URL & SHA-256 hash, then adds facility candidates with damage evidence.',
  },
  {
    num: '2',
    name: 'Lock Cohort',
    phaseKey: 'COHORT_LOCKED',
    desc: 'Freezes facility registration cohort, establishing the immutable set of candidate facilities for consensus evaluation.',
  },
  {
    num: '3',
    name: 'Consensus Evaluation',
    phaseKey: 'EVALUATING',
    desc: 'Studionet validators independently fetch exact web-response bytes, verify SHA-256 digests, and run LLM policy scoring.',
  },
  {
    num: '4',
    name: 'Allocate',
    phaseKey: 'ALLOCATED',
    desc: 'Deterministically sorts evaluated facilities into priority queue slots and waitlist tracks according to capacity.',
  },
  {
    num: '5',
    name: 'Assign',
    phaseKey: 'ALLOCATED',
    desc: 'Operator offers queue slots to qualified inspector addresses with fail-closed acknowledgment deadlines.',
  },
];

const MainDashboard: React.FC = () => {
  const contractAddress = getContractAddress();
  const { walletState, openChooser } = useWallet();
  const { runTransaction } = useTransaction();

  // Explicit Metadata Availability State
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatus>('LOADING');
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

  // Loading, Stale & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [isCreateIncidentOpen, setIsCreateIncidentOpen] = useState(false);
  const [isRegisterFacilityOpen, setIsRegisterFacilityOpen] = useState(false);
  const [isOfferAssignmentOpen, setIsOfferAssignmentOpen] = useState(false);
  const [isEvaluateFacilityOpen, setIsEvaluateFacilityOpen] = useState(false);
  const [isCloseIncidentOpen, setIsCloseIncidentOpen] = useState(false);

  const isPollingRef = useRef(false);

  const isOperator = Boolean(
    metadataStatus === 'READY' &&
      walletState.isConnected &&
      walletState.isStudionet &&
      walletState.address &&
      contractOperator &&
      walletState.address.toLowerCase() === contractOperator.toLowerCase()
  );

  // Fetch Authoritative Contract Metadata
  const loadContractMetadata = useCallback(async () => {
    if (!contractAddress) return;
    setMetadataStatus('LOADING');
    setLoadError(null);
    setIsStale(false);

    try {
      const [info, caps, op, actives] = await Promise.all([
        fetchContractInfo(contractAddress),
        fetchCaps(contractAddress),
        fetchOperator(contractAddress),
        fetchActiveIncidents(contractAddress),
      ]);

      // Authoritative read set validated
      setContractInfo(info);
      setContractCaps(caps);
      setContractOperator(op);
      setActiveIncidents(actives);
      setMetadataStatus('READY');
      setLoadError(null);

      if (actives.length > 0) {
        setSelectedIncidentId((prev) => (prev !== null && actives.includes(prev) ? prev : actives[0]));
      } else {
        setSelectedIncidentId(null);
        setSelectedIncident(null);
      }
    } catch (err: any) {
      setMetadataStatus('ERROR');
      setContractInfo(null);
      setContractCaps(null);
      setContractOperator(null);
      setActiveIncidents([]);
      setSelectedIncidentId(null);
      setSelectedIncident(null);
      setLoadError(`Failed to verify contract state: ${err?.message || String(err)}`);
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
        setIsStale(false);
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
    if (metadataStatus === 'READY' && selectedIncidentId !== null) {
      loadIncidentDetails(selectedIncidentId);
    }
  }, [metadataStatus, selectedIncidentId, loadIncidentDetails]);

  // Periodic gentle polling for active incident (bounded single-flight, fail-closed/stale preservation)
  useEffect(() => {
    if (!contractAddress || metadataStatus !== 'READY' || selectedIncidentId === null) return;

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
        setIsStale(false);
      } catch {
        // Preserve last authoritative validated state; mark as stale
        setIsStale(true);
      } finally {
        isPollingRef.current = false;
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [contractAddress, metadataStatus, selectedIncidentId, historyOffset]);

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

  // State 1: Unconfigured Address State
  if (!contractAddress) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DisclaimerBanner />
        <Header
          contractOperator={null}
          contractVersion={null}
          metadataStatus="ERROR"
          onOpenCreateIncident={() => {}}
        />

        <main style={{ flex: 1, maxWidth: '52rem', margin: '3rem auto', padding: '0 1.25rem', width: '100%' }}>
          <div className="panel" style={{ border: '2px solid var(--accent-seismic)', padding: '2rem', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  backgroundColor: 'var(--accent-seismic)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                }}
              >
                !
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--ink-primary)', margin: 0 }}>
                Contract Configuration Required
              </h2>
            </div>

            <p style={{ lineHeight: 1.55, marginBottom: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)' }}>
              No contract address is configured in this deployment environment. All on-chain operations and live
              seismic coordination views are paused until a valid GenLayer intelligent contract is deployed.
            </p>

            <div
              style={{
                backgroundColor: 'var(--canvas-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                marginBottom: '1.25rem',
                lineHeight: 1.6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div><strong>Network:</strong> GenLayer Studionet (Chain ID {STUDIONET_CHAIN_ID})</div>
              <div><strong>RPC URL:</strong> {STUDIONET_RPC_URL}</div>
              <div><strong>Required Variable:</strong> <code>VITE_CONTRACT_ADDRESS</code> in <code>.env</code></div>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
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

  // State 2: Metadata Verification In Progress (Fail-Closed Loading)
  if (metadataStatus === 'LOADING') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DisclaimerBanner />
        <Header
          contractOperator={null}
          contractVersion={null}
          metadataStatus="LOADING"
          onOpenCreateIncident={() => {}}
        />

        <main style={{ flex: 1, maxWidth: '52rem', margin: '3rem auto', padding: '0 1.25rem', width: '100%' }}>
          <div
            role="status"
            className="panel"
            style={{
              padding: '2.5rem 2rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}
          >
            <div className="live-dot active" style={{ width: '10px', height: '10px', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--ink-primary)', marginBottom: '0.5rem' }}>
              Verifying Contract State on GenLayer Studionet...
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', lineHeight: 1.5, maxWidth: '34rem', margin: '0 auto 1.25rem' }}>
              Connecting to Studionet RPC (Chain ID {STUDIONET_CHAIN_ID}) to authoritatively verify contract identity, operator permissions, and active incident records.
            </p>
            <div
              style={{
                backgroundColor: 'var(--canvas-subtle)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-2xs)',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '0.25rem',
                textAlign: 'left',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div><strong>Configured Contract:</strong> <span className="mono">{formatAddress(contractAddress, 8)}</span></div>
              <div><strong>Status:</strong> Verifying authoritative state...</div>
            </div>
          </div>
        </main>

        <Footer contractInfo={null} contractCaps={null} />
        <WalletModal />
        <TransactionTray />
      </div>
    );
  }

  // State 3: Metadata Verification Failed (Fail-Closed Operational Alert)
  if (metadataStatus === 'ERROR') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <DisclaimerBanner />
        <Header
          contractOperator={null}
          contractVersion={null}
          metadataStatus="ERROR"
          onOpenCreateIncident={() => {}}
        />

        <main style={{ flex: 1, maxWidth: '52rem', margin: '3rem auto', padding: '0 1.25rem', width: '100%' }}>
          <div
            role="alert"
            className="panel"
            style={{
              border: '2px solid var(--status-error)',
              backgroundColor: '#ffffff',
              padding: '2rem',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  backgroundColor: 'var(--status-error)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                }}
              >
                ✕
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--ink-primary)', margin: 0 }}>
                  Contract State Verification Failed
                </h2>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontWeight: 700, marginTop: '0.125rem' }}>
                  Unable to authoritatively read intelligent contract on GenLayer Studionet
                </div>
              </div>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
              {loadError || 'The contract at the configured address could not be verified on Studionet. This may indicate an unreachable RPC endpoint, an undeployed contract address, or an incompatible contract ABI.'}
            </p>

            <div
              style={{
                backgroundColor: 'var(--canvas-subtle)',
                padding: '1rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                marginBottom: '1.5rem',
                lineHeight: 1.6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <strong>Configured Address:</strong>{' '}
                <a
                  href={getExplorerAddressUrl(contractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}
                >
                  {contractAddress} ↗
                </a>
              </div>
              <div><strong>Network:</strong> GenLayer Studionet (Chain ID {STUDIONET_CHAIN_ID})</div>
              <div><strong>RPC Endpoint:</strong> <code>{STUDIONET_RPC_URL}</code></div>
              <div><strong>Verification Status:</strong> Unverified / Unavailable (Fail-Closed)</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => loadContractMetadata()}
              >
                Retry Verification
              </button>
              <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-muted)' }}>
                Write operations and live incident coordination are disabled until authoritative contract identity is verified.
              </span>
            </div>
          </div>
        </main>

        <Footer contractInfo={null} contractCaps={null} />
        <WalletModal />
        <TransactionTray />
      </div>
    );
  }

  // State 4: Metadata READY (Authoritatively Verified Contract Identity)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <DisclaimerBanner />
      <Header
        contractOperator={contractOperator}
        contractVersion={contractInfo?.version ?? null}
        metadataStatus="READY"
        onOpenCreateIncident={() => setIsCreateIncidentOpen(true)}
      />

      <main style={{ flex: 1, maxWidth: '86rem', margin: '0 auto', width: '100%', padding: '1rem 1.25rem' }}>
        {/* Background Sync Degradation Alert */}
        {isStale && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--accent-seismic-subtle)',
              color: 'var(--accent-seismic)',
              border: '1px solid var(--accent-seismic-border)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-xs)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 600,
            }}
          >
            <span>Warning: Background contract sync failed. Showing last authoritative validated state.</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (selectedIncidentId !== null) loadIncidentDetails(selectedIncidentId);
                else loadContractMetadata();
              }}
            >
              Retry Sync
            </button>
          </div>
        )}

        {loadError && !isStale && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-error-bg)',
              color: 'var(--status-error)',
              border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-xs)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (selectedIncidentId !== null) loadIncidentDetails(selectedIncidentId);
                else loadContractMetadata();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Incident Control & Summary Rail */}
        <IncidentSelector
          activeIncidents={activeIncidents}
          selectedIncidentId={selectedIncidentId}
          selectedIncident={selectedIncident}
          facilities={facilities}
          queueCount={queue.length}
          waitlistCount={waitlist.length}
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

        {/* Selected Incident: Responsive Two-Column Command Center Workspace */}
        {selectedIncident ? (
          <div
            className="desktop-two-col"
            style={{
              display: 'grid',
              gridTemplateColumns: selectedFacility ? 'minmax(0, 1fr) 26rem' : 'minmax(0, 1fr) 22rem',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            {/* Left / Main Workspace: Spatial Queue Diagram, Ordered Triage & Facility Priority Board */}
            <div>
              <SpatialQueueBoard
                incident={selectedIncident}
                facilities={facilities}
                queue={queue}
                waitlist={waitlist}
                selectedFacilityId={selectedFacilityId}
                onSelectFacility={(id) => setSelectedFacilityId(id)}
              />
            </div>

            {/* Right / Context Rail: Detail Inspector, Role Guide, Lifecycle Tracker & Audit Log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Selected Facility Detail Inspector (or placeholder prompt) */}
              {selectedFacility ? (
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
              ) : (
                <div
                  className="panel"
                  style={{
                    padding: '1.25rem',
                    backgroundColor: '#ffffff',
                    border: '1px dashed var(--border-subtle)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--accent-teal)' }}>⬡</div>
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--ink-primary)', marginBottom: '0.25rem' }}>
                    Facility Detail Inspector
                  </h4>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
                    Select a facility row from the priority table or queue card to inspect web evidence verification digests, consensus findings, and inspector assignment state.
                  </p>
                </div>
              )}

              {/* Role & Available Operations Guide */}
              <div
                className="panel"
                style={{
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Role & Authorization
                  </span>
                  <span className={`badge ${isOperator ? 'badge-hazard' : walletState.isConnected ? 'badge-teal' : 'badge-slate'}`}>
                    {isOperator ? 'OPERATOR' : walletState.isConnected ? 'OBSERVER / INSPECTOR' : 'DISCONNECTED'}
                  </span>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                  {isOperator ? (
                    <div>
                      <strong style={{ color: 'var(--accent-seismic)' }}>Operator Controls Enabled:</strong> You can register candidate facilities, lock registration cohorts, finalize triage allocations, and offer inspection queue slots.
                    </div>
                  ) : walletState.isConnected ? (
                    <div>
                      <strong>Observer Mode:</strong> Evaluation and expiration reclamation are permissionless on Studionet. Assigned inspectors can acknowledge offers matching their wallet address.
                    </div>
                  ) : (
                    <div>
                      <strong>Observer (Read-Only):</strong> Connect an injected wallet (MetaMask, OKX, Rabby) to execute consensus evaluations or manage assignments.
                    </div>
                  )}
                </div>
              </div>

              {/* 5-Step Consensus Lifecycle Status */}
              <div
                className="panel"
                style={{
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                  Consensus Lifecycle Progress
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {LIFECYCLE_STEPS.map((step) => {
                    const isStepActive =
                      (step.num === '1' && selectedIncident.status === 'DRAFT') ||
                      (step.num === '2' && selectedIncident.status === 'COHORT_LOCKED') ||
                      (step.num === '3' && selectedIncident.status === 'EVALUATING') ||
                      ((step.num === '4' || step.num === '5') && selectedIncident.status === 'ALLOCATED');

                    return (
                      <div
                        key={step.num}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.625rem',
                          padding: '0.5rem 0.625rem',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: isStepActive ? 'var(--accent-seismic-subtle)' : 'var(--canvas-subtle)',
                          border: isStepActive ? '1px solid var(--accent-seismic-border)' : '1px solid var(--border-hairline)',
                        }}
                      >
                        <span
                          style={{
                            width: '1.25rem',
                            height: '1.25rem',
                            borderRadius: '50%',
                            backgroundColor: isStepActive ? 'var(--accent-seismic)' : 'var(--border-strong)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {step.num}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: isStepActive ? 'var(--accent-seismic)' : 'var(--ink-primary)' }}>
                            {step.name}
                          </div>
                          <div style={{ fontSize: 'var(--text-3xs)', color: 'var(--ink-secondary)', marginTop: '0.125rem', lineHeight: 1.4 }}>
                            {step.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operational Audit History */}
              <HistorySection
                history={history}
                totalCount={historyTotalCount}
                offset={historyOffset}
                limit={20}
                isLoading={isLoading}
                onPageChange={(newOffset) => setHistoryOffset(newOffset)}
              />
            </div>
          </div>
        ) : (
          /* Production Empty State (Authoritative Zero Active Incidents on Record) */
          <div
            className="panel"
            style={{
              padding: '2.5rem 2rem',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Header Briefing */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  backgroundColor: 'var(--accent-teal)',
                  color: '#ffffff',
                  borderRadius: 'var(--radius-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 900,
                }}
              >
                ⬡
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--ink-primary)', margin: 0 }}>
                  Earthquake Inspection Priority Board • Incident Coordination Center
                </h2>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-teal)', fontWeight: 700, marginTop: '0.125rem' }}>
                  Decentralized Seismic Triage & Autonomous Policy Evaluation on GenLayer Studionet
                </div>
              </div>
            </div>

            {/* 2-3 Concise Lines of Operational Purpose */}
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: '1.75rem', maxWidth: '64rem' }}>
              Post-earthquake triage coordination engine deployed on GenLayer Studionet. Evaluates web evidence and applies incident inspection policies without publishing exact facility coordinates. Allocates deterministic dispatch queue slots and tracks fail-closed inspector assignments on-chain.
            </p>

            {/* 5-Step Consensus Lifecycle Workflow */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--ink-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                Intelligent Contract Workflow Lifecycle
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {LIFECYCLE_STEPS.map((step) => (
                  <div
                    key={step.num}
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--canvas-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <span
                        style={{
                          width: '1.375rem',
                          height: '1.375rem',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-seismic)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                        }}
                      >
                        {step.num}
                      </span>
                      <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-primary)' }}>
                        {step.name}
                      </strong>
                    </div>
                    <p style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification & Role Action Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
                gap: '1.25rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              {/* Protocol Verification Box */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--canvas-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-primary)', marginBottom: '0.5rem' }}>
                  Contract & Network Verification
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', lineHeight: 1.5 }}>
                  <div><strong>Network:</strong> GenLayer Studionet (Chain ID {STUDIONET_CHAIN_ID})</div>
                  <div><strong>RPC Endpoint:</strong> <code>{STUDIONET_RPC_URL}</code></div>
                  <div>
                    <strong>Contract Address:</strong>{' '}
                    <a
                      href={getExplorerAddressUrl(contractAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="mono"
                      style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}
                    >
                      {formatAddress(contractAddress, 8)} ↗
                    </a>
                  </div>
                  <div>
                    <strong>Contract Operator:</strong>{' '}
                    <span className="mono">{contractOperator ? formatAddress(contractOperator, 8) : 'Unverified'}</span>
                  </div>
                  <div><strong>Status:</strong> Live on Studionet • Zero Active Incidents</div>
                </div>
              </div>

              {/* Role Action Guide */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--canvas-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-secondary)' }}>
                      Operator Action Guide
                    </span>
                    <span className={`badge ${isOperator ? 'badge-hazard' : walletState.isConnected ? 'badge-teal' : 'badge-slate'}`}>
                      {isOperator ? 'OPERATOR' : walletState.isConnected ? 'OBSERVER' : 'DISCONNECTED'}
                    </span>
                  </div>

                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                    {isOperator
                      ? 'Operator Role Active. Click below to initialize a new seismic incident cohort with a verified USGS event URL and SHA-256 evidence digest.'
                      : walletState.isConnected
                      ? `Connected as ${formatAddress(walletState.address)}. Incident creation is restricted to the contract operator address.`
                      : 'Connect an authorized operator wallet via EIP-6963 to create a new earthquake triage incident.'}
                  </p>
                </div>

                <div>
                  {isOperator ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setIsCreateIncidentOpen(true)}
                    >
                      + Create Incident
                    </button>
                  ) : !walletState.isConnected ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={openChooser}
                    >
                      Connect Wallet
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
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
