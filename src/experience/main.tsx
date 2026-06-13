/**
 * /experience エントリポイント
 *
 * Vite の MPA（マルチページ）設定により、このファイルは
 * メインアプリ（index.html）とは完全に独立したバンドルとして生成される。
 * React / three.js の初期化コストを共有しないため、
 * 将来的に重いポストプロセスを追加してもメインアプリの
 * パフォーマンスに影響しない。
 */
import { createRoot } from 'react-dom/client';
import ExperienceApp from '../components/experience/ExperienceApp';

const container = document.getElementById('experience-root')!;
createRoot(container).render(<ExperienceApp />);
