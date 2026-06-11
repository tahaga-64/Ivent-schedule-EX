import type { QuerySnapshot } from 'firebase/firestore';
import type { Event } from '../types';

export function eventsShallowEqual(a: Event, b: Event): boolean {
  if (a.id !== b.id) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Event>;
  for (const k of keys) {
    if (k === 'id') continue;
    const av = a[k];
    const bv = b[k];
    if (av === bv) continue;
    if (av == null && bv == null) continue;
    if (typeof av === 'object' || typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
    } else {
      return false;
    }
  }
  return true;
}

/** docChanges ベースで差分マージ。変更なしなら null を返し setState をスキップできる */
export function applyEventSnapshotChanges(
  prev: Record<string, Event>,
  snapshot: QuerySnapshot
): Record<string, Event> | null {
  const changes = snapshot.docChanges();
  if (changes.length === 0) return null;

  let changed = false;
  const next = { ...prev };
  for (const change of changes) {
    const id = change.doc.id;
    if (change.type === 'removed') {
      if (id in next) {
        delete next[id];
        changed = true;
      }
    } else {
      const event = { id, ...change.doc.data() } as Event;
      const prevEvent = prev[id];
      if (!prevEvent || !eventsShallowEqual(prevEvent, event)) {
        next[id] = event;
        changed = true;
      }
    }
  }
  return changed ? next : null;
}
