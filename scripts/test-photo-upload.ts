/**
 * Integration test: Supabase photo upload
 * Usage: tsx scripts/test-photo-upload.ts
 * Requires .env.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PHOTO_BUCKET
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually (tsx doesn't auto-load it)
function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌ .env.local が見つかりません。先に作成してください。');
    console.error('   VITE_SUPABASE_URL=https://xxxx.supabase.co');
    console.error('   VITE_SUPABASE_ANON_KEY=eyJ...');
    console.error('   VITE_SUPABASE_PHOTO_BUCKET=photo');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

// Minimal valid 1×1 white PNG (67 bytes)
function make1x1PngBuffer(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cfc00000000200016834d840000000049454e44ae426082',
    'hex',
  );
}

async function run() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const bucket = env.VITE_SUPABASE_PHOTO_BUCKET || 'photo';

  if (!url || url.includes('missing') || !key || key.includes('missing')) {
    console.error('❌ 環境変数が正しく設定されていません。');
    process.exit(1);
  }

  console.log(`\n🔌 Supabase接続確認`);
  console.log(`   URL   : ${url}`);
  console.log(`   Bucket: ${bucket}\n`);

  const supabase = createClient(url, key);

  // ── STEP 1: バケット存在確認 ──────────────────────────────
  console.log('📦 STEP 1: バケット存在確認...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    console.error('❌ バケット一覧取得失敗:', bucketsError.message);
    process.exit(1);
  }
  const found = buckets?.find(b => b.name === bucket);
  if (!found) {
    console.error(`❌ バケット "${bucket}" が存在しません。`);
    console.error('   Supabase Dashboard → Storage → New bucket で作成してください。');
    process.exit(1);
  }
  console.log(`   ✅ バケット "${bucket}" 確認済み (public: ${found.public})\n`);

  // ── STEP 2: テスト画像アップロード ───────────────────────
  const testPath = `test/integration-test-${Date.now()}.png`;
  const pngBuffer = make1x1PngBuffer();

  console.log('📤 STEP 2: テスト画像アップロード...');
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(testPath, pngBuffer, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    console.error('❌ アップロード失敗:', uploadError.message);
    process.exit(1);
  }
  console.log(`   ✅ アップロード成功: ${testPath}\n`);

  // ── STEP 3: ストレージにファイルが存在するか確認 ──────────
  console.log('🔍 STEP 3: ストレージ保存確認...');
  const { data: listData, error: listError } = await supabase.storage
    .from(bucket)
    .list('test', { limit: 100 });

  if (listError) {
    console.error('❌ ファイル一覧取得失敗:', listError.message);
    process.exit(1);
  }
  const fileName = testPath.split('/').pop()!;
  const savedFile = listData?.find(f => f.name === fileName);
  if (!savedFile) {
    console.error('❌ アップロードしたファイルが一覧に見つかりません。');
    process.exit(1);
  }
  console.log(`   ✅ ファイル確認済み: ${savedFile.name} (${savedFile.metadata?.size ?? '?'} bytes)\n`);

  // ── STEP 4: 公開URLの取得確認 ─────────────────────────────
  console.log('🌐 STEP 4: 公開URL取得...');
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(testPath);
  if (!urlData.publicUrl) {
    console.error('❌ 公開URL取得失敗');
    process.exit(1);
  }
  console.log(`   ✅ 公開URL: ${urlData.publicUrl}\n`);

  // ── STEP 5: クリーンアップ ────────────────────────────────
  console.log('🧹 STEP 5: テストファイル削除...');
  const { error: deleteError } = await supabase.storage.from(bucket).remove([testPath]);
  if (deleteError) {
    console.warn('⚠️  削除失敗 (手動で削除してください):', testPath);
  } else {
    console.log('   ✅ 削除完了\n');
  }

  console.log('═══════════════════════════════════════');
  console.log('✅ 全ステップ合格 — 写真アップロードはDBに正常に保存されます');
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('❌ 予期しないエラー:', err);
  process.exit(1);
});
