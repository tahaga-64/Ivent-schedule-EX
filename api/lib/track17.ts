type OrderStatus = 'unordered' | 'ordered' | 'shipping' | 'arrived';

const TRACK17_BASE = 'https://api.17track.net/track/v2';

export function getTrack17ApiKey(): string | null {
  return process.env.TRACK17_API_KEY ?? null;
}

export function mapTrack17ToOrderStatus(mainStatus: string | undefined): OrderStatus | null {
  if (!mainStatus) return null;
  const s = mainStatus.toLowerCase();
  if (s === 'delivered') return 'arrived';
  if (['intransit', 'pickup', 'availableforpickup', 'outfordelivery', 'expired'].includes(s)) return 'shipping';
  if (['inforeceived', 'notfound'].includes(s)) return 'ordered';
  return null;
}

export async function track17Register(numbers: Array<{ number: string; carrier?: number }>) {
  const apiKey = getTrack17ApiKey();
  if (!apiKey) return { ok: false as const, error: 'TRACK17_API_KEY not configured' };

  const res = await fetch(`${TRACK17_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      '17token': apiKey,
    },
    body: JSON.stringify(numbers.map(n => ({
      number: n.number,
      ...(n.carrier != null ? { carrier: n.carrier } : {}),
    }))),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: JSON.stringify(data) };
  }
  return { ok: true as const, data };
}

export async function track17GetInfo(numbers: Array<{ number: string; carrier?: number }>) {
  const apiKey = getTrack17ApiKey();
  if (!apiKey) return { ok: false as const, error: 'TRACK17_API_KEY not configured' };

  const res = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      '17token': apiKey,
    },
    body: JSON.stringify(numbers.map(n => ({
      number: n.number,
      ...(n.carrier != null ? { carrier: n.carrier } : {}),
    }))),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: JSON.stringify(data) };
  }
  return { ok: true as const, data };
}

export function extractMainStatus(trackItem: Record<string, unknown>): string | undefined {
  const trackInfo = trackItem.track_info as Record<string, unknown> | undefined;
  const latest = trackInfo?.latest_status as Record<string, unknown> | undefined;
  const status = latest?.status as string | undefined;
  if (status) return status;
  const latestEvent = trackInfo?.latest_event as Record<string, unknown> | undefined;
  return latestEvent?.stage as string | undefined;
}
