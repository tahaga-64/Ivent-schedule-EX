/** Worker の canSendNotificationType と同期すること（workers/push/src/index.ts） */
export const EDITOR_ONLY_PUSH_TYPES = new Set([
  'member_added',
]);

export const AUTHENTICATED_PUSH_TYPES = new Set([
  'event_created',
  'event_updated',
  'event_deleted',
  'fish_added',
  'photo_added',
  'schedule_updated',
  'prep_updated',
]);

export function canSendPushNotificationType(
  type: string,
  email: string | undefined,
  editorEmails: readonly string[]
): boolean {
  if (EDITOR_ONLY_PUSH_TYPES.has(type)) {
    const editors = editorEmails.map(v => v.trim().toLowerCase()).filter(Boolean);
    return !!email && editors.includes(email.toLowerCase());
  }
  if (AUTHENTICATED_PUSH_TYPES.has(type)) {
    return true;
  }
  return false;
}
