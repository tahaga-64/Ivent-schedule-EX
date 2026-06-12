import { describe, it, expect } from 'vitest';
import { canEditEvent, canUploadPhoto, canEditPreparationList, EVENT_EDITOR_EMAILS } from '../lib/permissions';
import type { User } from 'firebase/auth';

function mockUser(email: string | null): User {
  return { email, uid: 'uid-test' } as unknown as User;
}

describe('canEditEvent', () => {
  it('編集者メールはtrueを返す', () => {
    expect(canEditEvent(mockUser(EVENT_EDITOR_EMAILS[0]))).toBe(true);
  });

  it('一般ユーザーはfalseを返す', () => {
    expect(canEditEvent(mockUser('other@example.com'))).toBe(false);
  });

  it('未ログインはfalse', () => {
    expect(canEditEvent(null)).toBe(false);
  });


  it('emailなしUserはfalse', () => {
    expect(canEditEvent(mockUser(null))).toBe(false);
  });
});

describe('canUploadPhoto', () => {
  it('ログイン済みはtrue', () => {
    expect(canUploadPhoto(mockUser('anyone@example.com'))).toBe(true);
  });

  it('未ログインはfalse', () => {
    expect(canUploadPhoto(null)).toBe(false);
  });
});

describe('canEditPreparationList', () => {
  it('ログイン済みはtrue', () => {
    expect(canEditPreparationList(mockUser('anyone@example.com'))).toBe(true);
  });

  it('未ログインはfalse', () => {
    expect(canEditPreparationList(null)).toBe(false);
  });
});
