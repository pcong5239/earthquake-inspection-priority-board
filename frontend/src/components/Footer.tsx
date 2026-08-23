import React from 'react';
import type { ContractCaps, ContractInfo } from '../types/contract';
import {
  STUDIONET_RPC_URL,
  STUDIONET_EXPLORER_BASE,
  STUDIONET_CHAIN_ID,
  getContractAddress,
  getExplorerAddressUrl,
} from '../config/chain';
import { formatAddress } from '../utils/formatters';

interface FooterProps {
  contractInfo: ContractInfo | null;
  contractCaps: ContractCaps | null;
}

export const Footer: React.FC<FooterProps> = ({ contractInfo, contractCaps }) => {
  const contractAddress = getContractAddress();

  return (
    <footer
      style={{
        marginTop: '2rem',
        borderTop: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-canvas-subtle)',
        padding: '1.5rem 1rem',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-ink-muted)',
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Network & RPC */}
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: '0.375rem' }}>
            GenLayer Studionet Protocol
          </div>
          <div>Chain ID: {STUDIONET_CHAIN_ID} (0xf22f)</div>
          <div>
            RPC Endpoint:{' '}
            <a
              href={STUDIONET_RPC_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
            >
              {STUDIONET_RPC_URL}
            </a>
          </div>
          <div>
            Explorer:{' '}
            <a
              href={STUDIONET_EXPLORER_BASE}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
            >
              {STUDIONET_EXPLORER_BASE}
            </a>
          </div>
        </div>

        {/* Contract State */}
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: '0.375rem' }}>
            Intelligent Contract Metadata
          </div>
          {contractAddress ? (
            <>
              <div>
                Address:{' '}
                <a
                  href={getExplorerAddressUrl(contractAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  style={{ color: 'var(--color-verified)', textDecoration: 'underline' }}
                >
                  {contractAddress}
                </a>
              </div>
              {contractInfo && (
                <>
                  <div>Operator: {formatAddress(contractInfo.operator)}</div>
                  <div>
                    Version: v{contractInfo.version} • Incidents Created: {contractInfo.incident_count}
                  </div>
                </>
              )}
            </>
          ) : (
            <div>Contract address not configured in environment (VITE_CONTRACT_ADDRESS).</div>
          )}
        </div>

        {/* Contract Caps */}
        {contractCaps && (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-ink-primary)', marginBottom: '0.375rem' }}>
              Governance Caps & Boundaries
            </div>
            <div>Max Incidents: {contractCaps.max_incidents}</div>
            <div>Max Facilities / Incident: {contractCaps.max_facilities_per_incident}</div>
            <div>Max History / Incident: {contractCaps.max_history_per_incident}</div>
            <div>Max Retries: {contractCaps.max_facility_retries}</div>
            <div>
              Assignment Timeout: {contractCaps.min_assignment_timeout_seconds}s –{' '}
              {contractCaps.max_assignment_timeout_seconds}s
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          maxWidth: '80rem',
          margin: '1.5rem auto 0',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-border-subtle)',
          textAlign: 'center',
          fontSize: '0.6875rem',
        }}
      >
        Autonomous Emergency Coordination Demo • genlayer-js@1.1.8 • React 19 • Studionet Native
      </div>
    </footer>
  );
};
