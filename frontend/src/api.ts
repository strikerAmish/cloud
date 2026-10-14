import { OperationalEvent, AuditBlock, SreMetrics } from './types';

const API_BASE = '/api/v1';

export async function fetchCorridorStatus() {
  const res = await fetch(`${API_BASE}/corridor/status`);
  if (!res.ok) throw new Error('Failed to fetch corridor status');
  return res.json();
}

export async function fetchEvents(): Promise<OperationalEvent[]> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch operational events');
  return res.json();
}

export async function fetchEventDetail(eventId: string): Promise<OperationalEvent> {
  const res = await fetch(`${API_BASE}/events/${eventId}`);
  if (!res.ok) throw new Error(`Failed to fetch event ${eventId}`);
  return res.json();
}

export async function createEvent(payload: any): Promise<any> {
  const idempotencyKey = crypto.randomUUID();
  const res = await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create event');
  }
  return res.json();
}

export async function acquireFencingToken(eventId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/lock`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lock acquisition failed');
  }
  return res.json();
}

export async function submitApproval(
  eventId: string,
  department: string,
  role: string,
  officerId: string,
  decision: 'APPROVED' | 'REJECTED' = 'APPROVED',
  rejectionReason?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      department,
      role,
      officer_id: officerId,
      decision,
      rejection_reason: rejectionReason,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Approval submission failed');
  }
  return res.json();
}

export async function activateWork(eventId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/activate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to activate work in progress');
  return res.json();
}

export async function completeWork(eventId: string, supervisorId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supervisor_id: supervisorId,
      tools_cleared: true,
      earth_discharge_rods_removed: true,
      track_continuity_verified: true,
      completion_memo: 'Maintenance completed. Earth discharge rods removed. Track certified safe.',
    }),
  });
  if (!res.ok) throw new Error('Failed to complete work');
  return res.json();
}

export async function clearBlock(eventId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear block and lock audit');
  return res.json();
}

export async function emergencyAbort(eventId: string, officerId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/abort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officer_id: officerId,
      reason,
      immediate_power_isolate: true,
    }),
  });
  if (!res.ok) throw new Error('Failed to trigger emergency abort');
  return res.json();
}

export async function escalateSla(eventId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${eventId}/escalate?reason=${encodeURIComponent(reason)}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to escalate SLA breach');
  return res.json();
}

export async function fetchAuditLedger(): Promise<{ verification: any; total_blocks: number; blocks: AuditBlock[] }> {
  const res = await fetch(`${API_BASE}/audit/ledger`);
  if (!res.ok) throw new Error('Failed to fetch audit ledger');
  return res.json();
}

export async function fetchHealth(): Promise<any> {
  const res = await fetch('/healthz');
  if (!res.ok) throw new Error('Synthetic canary probe failed');
  return res.json();
}

export async function triggerChaos(durationSeconds: number = 5): Promise<any> {
  const res = await fetch(`${API_BASE}/chaos/trigger?duration_seconds=${durationSeconds}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger chaos injection');
  return res.json();
}
