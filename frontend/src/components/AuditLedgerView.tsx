import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  Download,
  CheckCircle2,
  Lock,
  Layers,
  Database,
  RefreshCw,
  GitCommit,
  FileCode
} from 'lucide-react';
import { AuditBlock } from '../types';
import { fetchAuditLedger } from '../api';

export const AuditLedgerView: React.FC = () => {
  const [ledgerData, setLedgerData] = useState<{
    verification: any;
    total_blocks: number;
    blocks: AuditBlock[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<AuditBlock | null>(null);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLedger();
      setLedgerData(data);
      if (data.blocks && data.blocks.length > 0) {
        setSelectedBlock(data.blocks[data.blocks.length - 1]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  const handleExportJSON = () => {
    if (!ledgerData) return;
    const blob = new Blob([JSON.stringify(ledgerData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `railsync_statutory_audit_ledger_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold bg-indigo-950 text-indigo-400 px-2.5 py-0.5 rounded border border-indigo-500/40">
              SCREEN 5 • STATUTORY S3 AUDIT LEDGER
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              WORM LEGAL HOLD ACTIVE
            </span>
          </div>
          <h2 className="text-lg font-bold text-white">
            Immutable SHA-256 Hash-Chained S3 Statutory Audit Register
          </h2>
          <p className="text-xs text-slate-400">
            Compliant with Railway Statutory Inquiries. Backed by Amazon S3 Object Lock & Merkle DAG Multi-Signatures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadLedger}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Verify Hashes
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            Export Statutory Ledger (.JSON)
          </button>
        </div>
      </div>

      {/* Cryptographic Verification Status Badge */}
      {ledgerData && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                CRYPTOGRAPHIC INTEGRITY: {ledgerData.verification.status}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Total Chained Blocks: {ledgerData.total_blocks} • Latest Hash: {ledgerData.verification.latest_block_hash.substring(0, 24)}...
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            Storage Engine: <span className="text-indigo-400 font-bold">AWS S3 Object Lock (WORM Legal Hold)</span>
          </div>
        </div>
      )}

      {/* Main Ledger Split Screen: Block List & Merkle DAG Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chain Blocks List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-2 mb-2 font-mono">
            <GitCommit className="w-4 h-4 text-indigo-400" />
            Append-Only Merkle DAG Blocks
          </h3>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {ledgerData?.blocks.map((block) => {
              const isSelected = selectedBlock?.block_number === block.block_number;
              return (
                <div
                  key={block.block_number}
                  onClick={() => setSelectedBlock(block)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-indigo-300">
                      BLOCK #{block.block_number.toString().padStart(5, '0')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(block.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-white font-semibold truncate mb-1">
                    Event: {block.event_id}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    Hash: {block.block_hash.substring(0, 20)}...
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Merkle DAG Block Detail & Leaves */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
          {selectedBlock ? (
            <>
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Block Details: #{selectedBlock.block_number.toString().padStart(5, '0')}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Consensus: {selectedBlock.consensus_proof}
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                  {selectedBlock.worm_status}
                </span>
              </div>

              {/* Cryptographic Hashes Table */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-2">
                <div>
                  <span className="text-slate-400">Previous Block Hash (prev_hash):</span>
                  <div className="text-indigo-400 truncate">{selectedBlock.prev_hash}</div>
                </div>
                <div>
                  <span className="text-slate-400">Merkle Root Hash (merkle_root):</span>
                  <div className="text-emerald-400 truncate">{selectedBlock.merkle_root}</div>
                </div>
                <div>
                  <span className="text-slate-400">Sealed Block Hash (block_hash):</span>
                  <div className="text-cyan-400 truncate">{selectedBlock.block_hash}</div>
                </div>
              </div>

              {/* Merkle Leaves Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  Merkle Tree Leaves (Statutory Exhibits):
                </h4>
                <div className="space-y-2">
                  {selectedBlock.leaves.map((leaf, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-cyan-300">{leaf.leaf_id}: {leaf.title}</span>
                        {leaf.payload_summary && (
                          <span className="text-[10px] font-mono text-slate-400">{leaf.payload_summary}</span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        SHA-256: {leaf.hash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Signatures Proof */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">
                  Consensus Signatures (Ed25519 Multi-Dept Quorum):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {selectedBlock.multi_signatures.map((sig, i) => (
                    <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                      <div className="text-white font-bold">{sig.department} • {sig.role || 'SIGNATORY'}</div>
                      <div className="text-slate-400 truncate mt-0.5">Officer: {sig.officer_id}</div>
                      <div className="text-emerald-400 text-[10px] truncate">Sig: {sig.signature_hash}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-400 text-xs text-center py-10 font-mono">
              Select a block from the ledger to inspect its Merkle DAG proof.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
