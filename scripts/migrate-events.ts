/**
 * 静的DATA（constants.ts）を Firestore の events コレクションへ移行するスクリプト。
 *
 * 実行方法:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON 環境変数にサービスアカウントJSONを設定
 *      export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   2. npx ts-node --esm scripts/migrate-events.ts
 *      または: node --loader ts-node/esm scripts/migrate-events.ts
 *
 * 注意:
 *   - 既にFirestoreに存在するIDのイベントはスキップ（上書きしない）
 *   - 移行完了後、App.tsx の静的マージロジックと constants.ts の DATA 配列を削除すること
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DATA = [
  { id: "1", start: "2026-05-09", end: "2026-05-10", region: "関東", dept: "", type: "職業体験", venue: "ケーズデンキピオニウォーク東松山", client: "ソフトバンク㈱", note: "" },
  { id: "2", start: "2026-05-09", end: "2026-05-10", region: "関東", dept: "", type: "職業体験", venue: "フジコ電機宇都宮本店", client: "", note: "" },
  { id: "3", start: "2026-05-16", end: "2026-05-17", region: "関東", dept: "", type: "水族館", venue: "ヤマダデンキテックランド横浜本店", client: "ソフトバンク㈱", note: "" },
  { id: "4", start: "2026-05-23", end: "2026-05-24", region: "関東", dept: "", type: "水族館", venue: "ヤマダデンキ湘南平塚", client: "ソフトバンク㈱", note: "" },
  { id: "5", start: "2026-05-18", end: "2026-05-19", region: "中部", dept: "", type: "水族館", venue: "エディオン飯田インター", client: "ソフトバンク㈱", note: "" },
  { id: "6", start: "2026-05-30", end: "2026-05-31", region: "関東", dept: "", type: "水族館", venue: "ヤマダデンキLABI高崎店", client: "ソフトバンク㈱", note: "" },
  { id: "7", start: "2026-05-23", end: "2026-05-24", region: "九州", dept: "", type: "水族館", venue: "イオンモール筑紫野店", client: "ビッグローブ㈱・サンコミュニケーションズ", note: "ガラ×400匹、ドジョウ300匹" },
  { id: "8", start: "2026-05-30", end: "2026-05-31", region: "九州", dept: "", type: "水族館", venue: "ヤマダデンキテックランドてだこ浦西", client: "沖縄セルラー電話㈱", note: "" },
  { id: "9", start: "2026-06-06", end: "2026-06-07", region: "九州", dept: "", type: "水族館", venue: "ベスト電器イオン南風原", client: "沖縄セルラー電話㈱", note: "" },
  { id: "10", start: "2026-05-22", end: "2026-05-24", region: "近畿", dept: "", type: "水族館", venue: "ヤマダデンキ茨木目垣店", client: "ソフトバンク㈱", note: "ドジョウ・セラピー・観賞魚・宝探し" },
  { id: "11", start: "2026-06-20", end: "2026-06-21", region: "近畿", dept: "", type: "職業体験", venue: "ヤマダデンキ茨木目垣店", client: "ソフトバンク㈱", note: "ネイリスト・科学者" },
  { id: "12", start: "2026-05-02", end: "2026-05-06", region: "東北", dept: "", type: "水族館", venue: "シーナシーナ花巻（docomo）", client: "", note: "" },
  { id: "13", start: "2026-05-09", end: "2026-05-10", region: "東北", dept: "", type: "水族館", venue: "イオンモール名取（コジマ）", client: "", note: "" },
  { id: "14", start: "2026-05-16", end: "2026-05-17", region: "東北", dept: "", type: "忍者", venue: "イオン上磯店", client: "㈱ティーガイア", note: "" },
  { id: "15", start: "2026-05-30", end: "2026-05-31", region: "関東", dept: "", type: "水族館", venue: "ビックカメラ藤沢", client: "ソフトバンク㈱", note: "" },
  { id: "16", start: "2026-05-30", end: "2026-05-31", region: "関東", dept: "", type: "水族館", venue: "ヤマダデンキテックランド磯子店", client: "ソフトバンク㈱", note: "" },
  { id: "17", start: "2026-06-03", end: "2026-06-07", region: "関東", dept: "", type: "水族館", venue: "モラージュ菖蒲", client: "㈱ヒトノワコーポレーション", note: "" },
  { id: "18", start: "2026-05-06", end: "2026-05-10", region: "関東", dept: "", type: "DJI", venue: "ヨドバシ秋葉原", client: "", note: "" },
  { id: "19", start: "2026-05-23", end: "2026-05-23", region: "関東", dept: "", type: "超メタフェス", venue: "秋葉原UDX 4F UDXギャラリー", client: "", note: "" },
  { id: "20", start: "", end: "", region: "近畿", dept: "", type: "水族館", venue: "エディオンくずはモール【8月予定】", client: "ソフトバンク㈱", note: "8/8-8/9 or 8/15-8/16" },
  { id: "21", start: "2026-06-03", end: "2026-06-07", region: "関東", dept: "", type: "水族館", venue: "モラージュ菖蒲（第2弾）", client: "", note: "" },
  { id: "22", start: "2026-06-06", end: "2026-06-07", region: "近畿", dept: "", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "23", start: "2026-06-13", end: "2026-06-14", region: "近畿", dept: "", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "24", start: "2026-06-20", end: "2026-06-21", region: "近畿", dept: "", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "25", start: "2026-06-27", end: "2026-06-28", region: "近畿", dept: "", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
];

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON が設定されていません');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }

  const db = getFirestore();
  const eventsRef = db.collection('events');

  let skipped = 0;
  let migrated = 0;

  for (const event of DATA) {
    const docRef = eventsRef.doc(event.id);
    const snap = await docRef.get();
    if (snap.exists) {
      console.log(`⏭️  スキップ (既存): ID=${event.id} ${event.venue}`);
      skipped++;
      continue;
    }
    await docRef.set(event);
    console.log(`✅ 移行完了: ID=${event.id} ${event.venue}`);
    migrated++;
  }

  // 移行完了フラグを設定（アプリが自動的にFirestore優先へ切り替わる）
  await db.collection('appConfig').doc('eventsMigration').set({
    done: true,
    migratedAt: new Date().toISOString(),
    migratedBy: 'migrate-events-script',
  });

  console.log(`\n📊 結果: ${migrated}件移行 / ${skipped}件スキップ`);
  console.log('✅ 移行フラグ(appConfig/eventsMigration)を設定しました。アプリはFirestore優先で動作します。');
  console.log('\n次のステップ:');
  console.log('1. Firestoreコンソールで events コレクションを確認');
  console.log('2. アプリで全イベントが表示・削除できることを確認');
}

main().catch(err => {
  console.error('❌ 移行エラー:', err);
  process.exit(1);
});
