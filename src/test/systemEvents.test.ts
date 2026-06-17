import { describe, it, expect } from 'vitest';
import {
  isProposalEvent,
  isScheduleEvent,
  isObsoleteEvent,
  createDefaultProposalEvent,
  PROPOSAL_EVENT_ID,
} from '../lib/systemEvents';

describe('systemEvents', () => {
  it('identifies proposal event', () => {
    expect(isProposalEvent({ id: PROPOSAL_EVENT_ID })).toBe(true);
    expect(isProposalEvent({ id: '1' })).toBe(false);
  });

  it('excludes proposal and obsolete from schedule', () => {
    const proposal = createDefaultProposalEvent();
    const obsolete = { id: '20', venue: 'エディオンくずはモール【8月予定】', start: '', end: '', region: '', dept: '', type: '水族館', client: '', note: '' };
    const normal = { id: '1', venue: 'テスト会場', start: '2026-01-01', end: '2026-01-02', region: '関東', dept: '', type: '水族館', client: '', note: '' };
    expect(isScheduleEvent(proposal)).toBe(false);
    expect(isScheduleEvent(obsolete)).toBe(false);
    expect(isScheduleEvent(normal)).toBe(true);
  });

  it('detects obsolete edion kuzuha mall', () => {
    expect(isObsoleteEvent({ id: '20', venue: 'x' })).toBe(true);
    expect(isObsoleteEvent({ id: '99', venue: 'エディオンくずはモール（八月予定）' })).toBe(true);
    expect(isObsoleteEvent({ id: '5', venue: 'エディオン飯田インター' })).toBe(false);
  });
});
