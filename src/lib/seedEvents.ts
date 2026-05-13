import { Firestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Event } from '../types';

const INITIAL_EVENTS: Omit<Event, 'photos' | 'status'>[] = [
  { id: "1", start: "2026-05-09", end: "2026-05-10", region: "東日本", dept: "", type: "職業体験", venue: "ケーズデンキピオニウォーク東松山", client: "ソフトバンク㈱", note: "" },
  { id: "2", start: "2026-05-09", end: "2026-05-10", region: "東日本", dept: "", type: "職業体験", venue: "フジコ電機宇都宮本店", client: "", note: "" },
  { id: "3", start: "2026-05-16", end: "2026-05-17", region: "東日本", dept: "", type: "水族館", venue: "ヤマダデンキテックランド横浜本店", client: "ソフトバンク㈱", note: "" },
  { id: "4", start: "2026-05-23", end: "2026-05-24", region: "東日本", dept: "", type: "水族館", venue: "ヤマダデンキ湘南平塚", client: "ソフトバンク㈱", note: "" },
  { id: "5", start: "2026-05-18", end: "2026-05-19", region: "中日本", dept: "", type: "水族館", venue: "エディオン飯田インター", client: "ソフトバンク㈱", note: "" },
  { id: "6", start: "2026-05-30", end: "2026-05-31", region: "東日本", dept: "", type: "水族館", venue: "ヤマダデンキLABI高崎店", client: "ソフトバンク㈱", note: "" },
  { id: "7", start: "2026-05-23", end: "2026-05-24", region: "南日本", dept: "九州", type: "水族館", venue: "イオンモール筑紫野店", client: "ビッグローブ㈱・サンコミュニケーションズ", note: "ガラ×400匹、ドジョウ300匹" },
  { id: "8", start: "2026-05-30", end: "2026-05-31", region: "南日本", dept: "沖縄", type: "水族館", venue: "ヤマダデンキテックランドてだこ浦西", client: "沖縄セルラー電話㈱", note: "" },
  { id: "9", start: "2026-06-06", end: "2026-06-07", region: "南日本", dept: "沖縄", type: "水族館", venue: "ベスト電器イオン南風原", client: "沖縄セルラー電話㈱", note: "" },
  { id: "10", start: "2026-05-22", end: "2026-05-24", region: "西日本", dept: "", type: "水族館", venue: "ヤマダデンキ茨木目垣店", client: "ソフトバンク㈱", note: "ドジョウ・セラピー・観賞魚・宝探し" },
  { id: "11", start: "2026-06-20", end: "2026-06-21", region: "西日本", dept: "", type: "職業体験", venue: "ヤマダデンキ茨木目垣店", client: "ソフトバンク㈱", note: "ネイリスト・科学者" },
  { id: "12", start: "2026-05-02", end: "2026-05-06", region: "東日本", dept: "", type: "水族館", venue: "シーナシーナ花巻（docomo）", client: "", note: "" },
  { id: "13", start: "2026-05-09", end: "2026-05-10", region: "東日本", dept: "", type: "水族館", venue: "イオンモール名取（コジマ）", client: "", note: "" },
  { id: "14", start: "2026-05-16", end: "2026-05-17", region: "東日本", dept: "北海道", type: "忍者", venue: "イオン上磯店", client: "㈱ティーガイア", note: "" },
  { id: "15", start: "2026-05-30", end: "2026-05-31", region: "東日本", dept: "", type: "水族館", venue: "ビックカメラ藤沢", client: "ソフトバンク㈱", note: "" },
  { id: "16", start: "2026-05-30", end: "2026-05-31", region: "東日本", dept: "", type: "水族館", venue: "ヤマダデンキテックランド磯子店", client: "ソフトバンク㈱", note: "" },
  { id: "17", start: "2026-06-03", end: "2026-06-07", region: "東日本", dept: "", type: "水族館", venue: "モラージュ菖蒲", client: "㈱ヒトノワコーポレーション", note: "" },
  { id: "18", start: "2026-05-06", end: "2026-05-10", region: "東日本", dept: "", type: "DJI", venue: "ヨドバシ秋葉原", client: "", note: "" },
  { id: "19", start: "2026-05-23", end: "2026-05-23", region: "東日本", dept: "", type: "超メタフェス", venue: "秋葉原UDX 4F UDXギャラリー", client: "", note: "" },
  { id: "20", start: "", end: "", region: "西日本", dept: "", type: "水族館", venue: "エディオンくずはモール【8月予定】", client: "ソフトバンク㈱", note: "8/8-8/9 or 8/15-8/16" },
  { id: "21", start: "2026-06-03", end: "2026-06-07", region: "東日本", dept: "", type: "水族館", venue: "モラージュ菖蒲（第2弾）", client: "", note: "" },
  { id: "22", start: "2026-06-06", end: "2026-06-07", region: "西日本", dept: "西1部", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "23", start: "2026-06-13", end: "2026-06-14", region: "西日本", dept: "西1部", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "24", start: "2026-06-20", end: "2026-06-21", region: "西日本", dept: "西1部", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
  { id: "25", start: "2026-06-27", end: "2026-06-28", region: "西日本", dept: "西1部", type: "ワークショップ", venue: "エディオン販路（高槻宮田/豊中/EXPOCITY/くずは）", client: "KDDI×ビッグローブ", note: "" },
];

export async function seedInitialEvents(db: Firestore): Promise<void> {
  const eventsRef = collection(db, 'events');
  const snapshot = await getDocs(eventsRef);
  
  if (snapshot.size > 0) {
    return;
  }

  const batch = writeBatch(db);
  for (const event of INITIAL_EVENTS) {
    const docRef = doc(db, 'events', event.id);
    batch.set(docRef, event);
  }
  
  await batch.commit();
  console.log(`Seeded ${INITIAL_EVENTS.length} initial events to Firestore`);
}
