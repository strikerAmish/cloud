import React from 'react';
import { Bell, X, Clock, Radio, Activity, AlertTriangle } from 'lucide-react';

interface TelemetryBellDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: string[];
}

export const TelemetryBellDrawer: React.FC<TelemetryBellDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
}) => {
  if (!isOpen) return null;

  // Filter out noise — only operational telemetry (ignore INITIAL_SNAPSHOT)
  const opNotifs = notifications.filter((n) => !n.includes('INITIAL_SNAPSHOT'));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-96 h-full bg-[#080d1a] border-l border-slate-800 shadow-2xl flex flex-col slide-in-right overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#060a12]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                Ambient Telemetry
                <span className="w-1.5 h-1.5 rounded-full status-dot-green animate-pulse" />
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Redis Pub/Sub • /ws/corridor
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter info banner */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-cyan-400" /> Filter: Operational Events Only
          </span>
          <span className="text-cyan-400 font-bold">{opNotifs.length} events</span>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2">
          {opNotifs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Activity className="w-8 h-8 text-slate-700 mb-2" />
              <div className="text-xs font-medium text-slate-400">No operational alerts yet</div>
              <div className="text-[10px] text-slate-600 mt-1">
                Breaker trips, token locks, and invariant dispatches will stream here live.
              </div>
            </div>
          ) : (
            opNotifs.map((item, idx) => {
              const isTrip = item.includes('breaker') || item.includes('trip') || item.includes('FAIL');
              const isLock = item.includes('clamp') || item.includes('locked') || item.includes('token');

              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg hover:bg-slate-800/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                      Live Feed
                    </span>
                    {isTrip && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-950/80 border border-red-500/40 text-red-300 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> OHE TRIP
                      </span>
                    )}
                    {isLock && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold">
                        INTERLOCK
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-200 leading-relaxed break-words">
                    {item}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/60 bg-[#060a12] text-center text-[10px] font-mono text-slate-600">
          Redis 7.0 Cluster • Stream: corridor:events:v1
        </div>
      </div>
    </div>
  );
};
