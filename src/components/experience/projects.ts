/**
 * 3D Experience — 案件データ定義
 *
 * PROJECTS に項目を追加すれば <Scroll html> パネルが自動で増える。
 * 3つ目以降を追加する場合:
 *   - scrollTop: '400vh'（pages=5 にも変更すること）
 *   - fadeIn/fadeOut の from/dist も新しい offset 区間に合わせて設定
 */

export interface Project {
  id: string;
  title: string;
  desc: string;
  tags: string[];
  href: string;
  /**
   * <Scroll html> コンテナ内の上端位置。
   * pages=3 のとき offset=0 で 0vh、offset=1 で 200vh がビューポート中央に来る。
   * (drei の <Scroll html> は translateY(-offset*(pages-1)*vh) でコンテンツを動かすため)
   */
  scrollTop: string;
  /** スクロール offset 0〜1 でフェードインする区間 */
  fadeIn: { from: number; dist: number };
  /** スクロール offset 0〜1 でフェードアウトする区間 */
  fadeOut: { from: number; dist: number };
}

export const PROJECTS: Project[] = [
  {
    id: 'ex-event-manager',
    title: 'EX Event Manager',
    desc: 'イベントのスケジュール管理ツール。',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Tailwind', 'Vercel'],
    href: '#',
    scrollTop: '0vh',
    // 環境1にカメラがいる間（offset 0→0.30）に表示
    fadeIn:  { from: 0,    dist: 0.08 },
    fadeOut: { from: 0.22, dist: 0.10 },
  },
  {
    id: 'eventstockmg',
    title: 'EventStockMG',
    desc: 'イベント備品の在庫管理ツール。',
    tags: ['Next.js 15', 'TypeScript', 'Supabase', 'Zustand', 'TanStack Query'],
    href: '#',
    scrollTop: '200vh',
    // 環境2にカメラが近づく間（offset 0.68→1.0）に表示
    fadeIn:  { from: 0.68, dist: 0.10 },
    fadeOut: { from: 0.92, dist: 0.08 },
  },
];
