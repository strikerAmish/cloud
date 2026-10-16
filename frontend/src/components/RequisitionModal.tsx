import React, { useState } from 'react';
import {
  X,
  Zap,
  Shield,
  Clock,
  MapPin,
  CheckCircle2,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import { createEvent } from '../api';

interface RequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newEvent: any) => void;
}

export const RequisitionModal: React.FC<RequisitionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [division, setDivision] = useState('NGP');
  const [section, setSection] = useState('Wardha-Sevagram');
  const [trackId, setTrackId] = useState('UP_MAIN');
  const [kmStart, setKmStart] = useState('142.10');
  const [kmEnd, setKmEnd] = useState('143.04');
  const [description, setDescription] = useState(
    'OHE Catenary Inspection and Contact Wire Replacement per ACTM Vol II Sec 20615'
  );

  // Impact Vector toggles
  const [powerTrip, setPowerTrip] = useState(true);
  const [trafficBlock, setTrafficBlock] = useState(true);
  const [speedRestriction, setSpeedRestriction] = useState(true);
  const [pointClamping, setPointClamping] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (isDraft: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const endTime = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

      const payload = {
        division,
        section,
        track_id: trackId,
        km_start: parseFloat(kmStart),
        km_end: parseFloat(kmEnd),
        requested_start: startTime,
        requested_end: endTime,
        impact_vector: {
          catenary_25kv_power_trip: powerTrip,
          absolute_traffic_block: trafficBlock,
          speed_restriction_kmh: speedRestriction ? 30 : 0,
          feeding_posts: ['FP-04', 'FP-06'],
          points_clamping_required: pointClamping,
          track_bonding_notice: true,
        },
        description,
        originator_id: 'SSE_OHE_WDA_04',
      };

      const result = await createEvent(payload);
      onCreated(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit requisition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-8 neo-card">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-bold text-blue-300 bg-blue-950/80 px-2.5 py-0.5 rounded border border-blue-500/40">
              SCREEN 2 • WORKFLOW REQUISITION
            </span>
            <h2 className="text-lg font-bold text-white mt-1">
              Operational Event Requisition & 7-Stage OHE Power/Traffic Block
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-slate-900 border border-blue-500/40 text-xs text-blue-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 7-Stage OHE Workflow Visualizer Guide */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 neo-pressed">
            <h4 className="text-xs font-bold text-slate-300 font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Mandatory 7-Stage OHE Power & Traffic Block Workflow (ACTM Vol. II & G&SR):
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
              {[
                { step: '1', title: 'Requisition Draft', actor: 'OHE Supervisor' },
                { step: '2', title: 'Power Block (ETR-1)', actor: 'TPC NGP Desk' },
                { step: '3', title: 'Traffic Feasibility', actor: 'Section Controller' },
                { step: '4', title: 'Point Clamping', actor: 'Station Master' },
                { step: '5', title: 'S&T Notice', actor: 'Signal Maintainer' },
                { step: '6', title: 'Permit ETR-3', actor: 'Field Earthing Crew' },
                { step: '7', title: 'Clearance & S3 Seal', actor: 'Dual Sign-off' },
              ].map((s) => (
                <div key={s.step} className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-blue-400 font-bold">Stage 0{s.step}</div>
                  <div className="text-slate-200 font-semibold">{s.title}</div>
                  <div className="text-slate-400 text-[10px]">{s.actor}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Division</label>
              <input
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Track</label>
              <select
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="UP_MAIN">UP_MAIN (Nagpur ⇄ Wardha)</option>
                <option value="DN_MAIN">DN_MAIN (Wardha ⇄ Nagpur)</option>
                <option value="LOOP_01">LOOP_01 (Wardha Yard Loop)</option>
                <option value="YARD_04">YARD_04 (Freight Siding)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">KM Start</label>
                <input
                  type="number"
                  step="0.01"
                  value={kmStart}
                  onChange={(e) => setKmStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">KM End</label>
                <input
                  type="number"
                  step="0.01"
                  value={kmEnd}
                  onChange={(e) => setKmEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description / SOP Justification</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          {/* Operational Impact Vector Toggles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
              Operational Impact Vector Toggles
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Power Trip */}
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 neo-card">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">25kV Catenary Power Trip</div>
                    <div className="text-[11px] text-slate-400">Isolate Feeding Posts FP-04 to FP-06</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={powerTrip}
                  onChange={(e) => setPowerTrip(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Traffic Block */}
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 neo-card">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Absolute Traffic Block</div>
                    <div className="text-[11px] text-slate-400">Total track possession on {trackId}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={trafficBlock}
                  onChange={(e) => setTrafficBlock(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {/* TSR */}
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 neo-card">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Adjacent Track TSR 30 km/h</div>
                    <div className="text-[11px] text-slate-400">Impose speed restriction on DN MAIN</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={speedRestriction}
                  onChange={(e) => setSpeedRestriction(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Point Clamping */}
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 neo-card">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Physical Point Clamping</div>
                    <div className="text-[11px] text-slate-400">SM padlocks crossover points #14A/B</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={pointClamping}
                  onChange={(e) => setPointClamping(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all neo-button"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 neo-button"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <FileCheck2 className="w-4 h-4" />
            {loading ? 'Validating SOP...' : 'Submit Requisition'}
          </button>
        </div>
      </div>
    </div>
  );
};
