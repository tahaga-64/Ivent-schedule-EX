// 種別の一元管理ファイル。新しい種別を追加する場合はここに追記してください。
// Sidebar のフィルターと新規イベント作成モーダルのセレクトが自動的に連動します。
export const EVENT_TYPES: { label: string; emoji: string }[] = [
  { label: '職業体験',     emoji: '🎓' },
  { label: '水族館',       emoji: '🐟' },
  { label: '忍者',         emoji: '🥷' },
  { label: 'DJI',          emoji: '🚁' },
  { label: '超メタフェス', emoji: '🎮' },
  { label: 'ワークショップ', emoji: '🛠' },
];
