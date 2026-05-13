import { CalendarEvent } from '../types/index';

// スプレッドシート「イベントスケジュール管理・準備物確認」より同期
// 出典: https://docs.google.com/spreadsheets/d/1yzxFRiWRSsQp47RRcsgU_iaerYT7gznCN9GnIxw2rT0/edit
//
// Sidebar の region/type 集計や CalendarGrid のフォールバック表示に利用される。
// Firestore に events コレクションが存在する場合は src/lib/seedEvents.ts の
// INITIAL_EVENTS が同期元となる。
export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1', venue: 'シーナシーナ花巻（docomo）', client: '',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-02', end: '2026-05-06', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '2', venue: 'ヨドバシ秋葉原', client: '',
    region: '東日本', type: 'DJI', status: '準備中',
    start: '2026-05-06', end: '2026-05-10', emoji: '🚁', color: '#6366F1',
  },
  {
    id: '3', venue: 'ケーズデンキピオニウォーク東松山', client: 'ソフトバンク㈱',
    region: '東日本', type: '職業体験', status: '準備中',
    start: '2026-05-09', end: '2026-05-10', emoji: '👨‍💼', color: '#22C55E',
  },
  {
    id: '4', venue: 'フジコ電機宇都宮本店', client: '',
    region: '東日本', type: '職業体験', status: '準備中',
    start: '2026-05-09', end: '2026-05-10', emoji: '👨‍💼', color: '#22C55E',
  },
  {
    id: '5', venue: 'イオンモール名取（コジマ）', client: '',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-09', end: '2026-05-10', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '6', venue: 'ヤマダデンキテックランド横浜本店', client: 'ソフトバンク㈱',
    region: '東日本', type: '水族館', status: '完了',
    start: '2026-05-16', end: '2026-05-17', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '7', venue: 'イオン上磯店', client: '㈱ティーガイア',
    region: '東日本', dept: '北海道', type: '忍者', status: '準備中',
    start: '2026-05-16', end: '2026-05-17', emoji: '🥷', color: '#A855F7',
  },
  {
    id: '8', venue: 'ヤマダデンキ茨木目垣店', client: 'ソフトバンク㈱',
    region: '西日本', type: '水族館', status: '準備中',
    start: '2026-05-22', end: '2026-05-24', emoji: '🐠', color: '#3B82F6',
    note: 'ドジョウ・セラピー・観賞魚・宝探し',
  },
  {
    id: '9', venue: 'ヤマダデンキ湘南平塚', client: 'ソフトバンク㈱',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-23', end: '2026-05-24', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '10', venue: 'エディオン飯田インター', client: 'ソフトバンク㈱',
    region: '中日本', type: '水族館', status: '準備中',
    start: '2026-05-23', end: '2026-05-24', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '11', venue: 'イオンモール筑紫野店', client: 'ビッグローブ㈱・㈱サンコミュニケーションズ',
    region: '南日本', dept: '九州', type: '水族館', status: '準備中',
    start: '2026-05-23', end: '2026-05-24', emoji: '🐠', color: '#3B82F6',
    note: 'ガラ×400匹、ドジョウ300匹',
  },
  {
    id: '12', venue: '秋葉原UDX 4F UDXギャラリー', client: '',
    region: '東日本', type: '超メタフェス', status: '準備中',
    start: '2026-05-23', end: '2026-05-23', emoji: '🎭', color: '#F97316',
  },
  {
    id: '13', venue: 'ヤマダデンキLABI高崎店', client: 'ソフトバンク㈱',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-30', end: '2026-05-31', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '14', venue: 'ヤマダデンキテックランドてだこ浦西', client: '沖縄セルラー電話㈱',
    region: '南日本', dept: '沖縄', type: '水族館', status: '準備中',
    start: '2026-05-30', end: '2026-05-31', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '15', venue: 'ビックカメラ藤沢', client: 'ソフトバンク㈱',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-30', end: '2026-05-31', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '16', venue: 'ヤマダデンキテックランド磯子店', client: 'ソフトバンク㈱',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-05-30', end: '2026-05-31', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '17', venue: 'モラージュ菖蒲', client: '㈱ヒトノワコーポレーション',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-06-03', end: '2026-06-07', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '18', venue: 'モラージュ菖蒲（第2弾）', client: '',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-06-03', end: '2026-06-07', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '19', venue: 'ベスト電器イオン南風原', client: '沖縄セルラー電話㈱',
    region: '南日本', dept: '沖縄', type: '水族館', status: '準備中',
    start: '2026-06-06', end: '2026-06-07', emoji: '🐠', color: '#3B82F6',
  },
  {
    id: '20', venue: 'エディオン販路（高槻宮田/豊中/ららぽーとEXPOCITY/くずはモール）', client: 'KDDI×ビッグローブ',
    region: '西日本', dept: '西1部', type: 'ワークショップ', status: '準備中',
    start: '2026-06-06', end: '2026-06-07', emoji: '🛠️', color: '#F43F5E',
  },
  {
    id: '21', venue: 'エディオン販路（高槻宮田/豊中/ららぽーとEXPOCITY/くずはモール）', client: 'KDDI×ビッグローブ',
    region: '西日本', dept: '西1部', type: 'ワークショップ', status: '準備中',
    start: '2026-06-13', end: '2026-06-14', emoji: '🛠️', color: '#F43F5E',
  },
  {
    id: '22', venue: 'ヤマダデンキ茨木目垣店', client: 'ソフトバンク㈱',
    region: '西日本', type: '職業体験', status: '準備中',
    start: '2026-06-20', end: '2026-06-21', emoji: '👨‍💼', color: '#22C55E',
    note: 'ネイリスト・科学者',
  },
  {
    id: '23', venue: 'エディオン販路(高槻宮田/豊中/ららぽーとEXPOCITY/くずはモール）', client: 'KDDI×ビッグローブ',
    region: '西日本', dept: '西1部', type: 'ワークショップ', status: '準備中',
    start: '2026-06-20', end: '2026-06-21', emoji: '🛠️', color: '#F43F5E',
  },
  {
    id: '24', venue: 'エディオン販路（高槻宮田/豊中/ららぽーとEXPOCITY/くずはモール）', client: 'KDDI×ビッグローブ',
    region: '西日本', dept: '西1部', type: 'ワークショップ', status: '準備中',
    start: '2026-06-27', end: '2026-06-28', emoji: '🛠️', color: '#F43F5E',
  },
  {
    id: '25', venue: 'エディオンくずはモール【8/8-8/9 or 8/15-8/16(予定)】', client: 'ソフトバンク㈱',
    region: '西日本', type: '水族館', status: '準備中',
    start: '2026-08-08', end: '2026-08-09', emoji: '🐠', color: '#3B82F6',
    note: '（2名体制）日程: 8/8-8/9 もしくは 8/15-8/16',
  },
  {
    id: '26', venue: 'ヤマダデンキテックランド横浜泉店【6月初週】', client: '',
    region: '東日本', type: '水族館', status: '準備中',
    start: '2026-06-01', end: '2026-06-07', emoji: '🐠', color: '#3B82F6',
    note: '6月初週（仮日程）',
  },
];
