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
        marginTop: '3rem',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: '#ffffff',
        padding: '2rem 1.25rem 1.5rem',
        fontSize: 'var(--text-xs)',
        color: 'var(--ink-secondary)',
      }}
    >
      <div
        style={{
          maxWidth: '86rem',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))',
          gap: '2rem',
        }}
      >
        {/* Protocol Network & RPC */}
        <div>
          <div style={{ fontWeight: 800, color: 'var(--ink-primary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            GenLayer Studionet Protocol
          </div>
          <div style={{ lineHeight: 1.6 }}>
            <div><strong>Chain ID:</strong> {STUDIONET_CHAIN_ID} (0xf22f)</div>
            <div>
              <strong>RPC:</strong>{' '}
              <a
                href={STUDIONET_RPC_URL}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}
              >
                {STUDIONET_RPC_URL}
              </a>
            </div>
            <div>
              <strong>Explorer:</strong>{' '}
              <a
                href={STUDIONET_EXPLORER_BASE}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-teal)', textDecoration: 'underline' }}
              >
                {STUDIONET_EXPLORER_BASE} ↗
              </a>
            </div>
          </div>
        </div>

        {/* Intelligent Contract Metadata */}
        <div>
          <div style={{ fontWeight: 800, color: 'var(--ink-primary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Intelligent Contract State
          </div>
          {contractAddress ? (
            <div style={{ lineHeight: 1.6 }}>
              <div>
                <strong>Address:</strong>{' '}
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
              {contractInfo ? (
                <>
                  <div><strong>Operator:</strong> {formatAddress(contractInfo.operator)}</div>
                  <div>
                    <strong>Version:</strong> v{contractInfo.version} • <strong>Incidents:</strong> {contractInfo.incident_count}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--ink-muted)' }}>Contract identity unverified or loading.</div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--ink-muted)' }}>Contract address not configured in environment.</div>
          )}
        </div>

        {/* Governance Caps & Constraints */}
        {contractCaps && (
          <div>
            <div style={{ fontWeight: 800, color: 'var(--ink-primary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Governance Caps & Boundaries
            </div>
            <div style={{ lineHeight: 1.6 }}>
              <div><strong>Max Incidents:</strong> {contractCaps.max_incidents}</div>
              <div><strong>Max Facilities / Incident:</strong> {contractCaps.max_facilities_per_incident}</div>
              <div><strong>Max Retries:</strong> {contractCaps.max_facility_retries}</div>
              <div>
                <strong>Assignment Timeout:</strong> {contractCaps.min_assignment_timeout_seconds}s –{' '}
                {contractCaps.max_assignment_timeout_seconds}s
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          maxWidth: '86rem',
          margin: '2rem auto 0',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: 'var(--text-2xs)',
          color: 'var(--ink-muted)',
        }}
      >
        <div>
          Autonomous Emergency Coordination Demo • genlayer-js@1.1.8 • React 19 • Studionet Native
        </div>
        <div>
          Decentralized AI Consensus Execution
        </div>
      </div>
    </footer>
  );
};
