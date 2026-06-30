import type { VercelRequest, VercelResponse } from '@vercel/node';

// 診断用エンドポイント。各ステップの所要時間と失敗箇所をJSONで返す（秘密情報は返さない）。
// 認証不要（ブラウザで /api/driveDebug を開けば確認できる）。原因特定後に削除予定。
export const config = { maxDuration: 60 };

function race<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const out: Record<string, unknown> = {};
  const t0 = Date.now();
  const FOLDER = process.env.GOOGLE_DRIVE_FOLDER_ID || '1CsKYdRqSYrf5XzHsX4hqAalg5JFc3ieZ';

  try {
    const raw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    out.usingEnv = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
      ? 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'
      : (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'FIREBASE_SERVICE_ACCOUNT_JSON' : null);
    out.hasEnv = !!raw;
    if (!raw) return res.status(200).json(out);

    let creds: { client_email?: string; project_id?: string; private_key?: string };
    try {
      creds = JSON.parse(raw);
      out.parseOk = true;
    } catch (e) {
      out.parseOk = false;
      out.parseError = e instanceof Error ? e.message : String(e);
      return res.status(200).json(out);
    }

    out.client_email = creds.client_email ?? null;
    out.project_id = creds.project_id ?? null;
    const pk = String(creds.private_key ?? '');
    out.privateKey_present = pk.length > 0;
    out.privateKey_hasRealNewline = pk.includes('\n');         // 正常なら true
    out.privateKey_hasLiteralBackslashN = pk.includes('\\n');  // true だけなら改行が壊れている
    out.privateKey_startsCorrectly = pk.startsWith('-----BEGIN');

    const ti = Date.now();
    const { google } = await import('googleapis');
    out.importGoogleapisMs = Date.now() - ti;

    const tg = Date.now();
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const client = await race(auth.getClient(), 15000, 'getClient(token取得)');
    out.getClientMs = Date.now() - tg;

    const tm = Date.now();
    const drive = google.drive({ version: 'v3', auth: client as never });
    const meta = await race(
      drive.files.get({ fileId: FOLDER, fields: 'id,name', supportsAllDrives: true }),
      20000,
      'files.get(フォルダ参照)',
    );
    out.folderLookupMs = Date.now() - tm;
    out.folderName = meta.data.name ?? null;
    out.ok = true;
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
  }

  out.totalMs = Date.now() - t0;
  return res.status(200).json(out);
}
