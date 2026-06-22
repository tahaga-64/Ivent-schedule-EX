type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
};

type Env = {
  PUSH_SUBSCRIPTIONS: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  WEB_PUSH_PUBLIC_KEY: string;
  WEB_PUSH_PRIVATE_KEY: string;
  VAPID_SUBJECT?: string;
  EDITOR_EMAILS?: string;
  ALLOWED_ORIGINS?: string;
};

type FirebaseUser = {
  uid: string;
  email?: string;
};

type StoredSubscription = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  userAgent?: string;
  uid: string;
  email?: string;
  updatedAt: string;
};

type PushPayload = {
  type?: string;
  title?: string;
  message?: string;
  eventId?: string;
  targetEmail?: string;
  excludeEndpoint?: string;
  data?: Record<string, unknown>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = buildCorsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      if (url.pathname === '/subscribe' && request.method === 'POST') {
        return withCors(await handleSubscribe(request, env), corsHeaders);
      }
      if (url.pathname === '/send' && request.method === 'POST') {
        return withCors(await handleSend(request, env), corsHeaders);
      }
      return withCors(json({ error: 'Not found' }, 404), corsHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      return withCors(json({ error: message }, 500), corsHeaders);
    }
  },
};

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  const user = await verifyFirebaseUser(request, env);
  const body = await request.json() as {
    subscription?: PushSubscriptionJSON;
    userAgent?: string;
  };
  const subscription = body.subscription;

  if (!subscription?.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
    return json({ error: 'Invalid subscription' }, 400);
  }

  const stored: StoredSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
    userAgent: body.userAgent,
    uid: user.uid,
    ...(user.email ? { email: user.email } : {}),
    updatedAt: new Date().toISOString(),
  };

  await env.PUSH_SUBSCRIPTIONS.put(subscriptionKey(subscription.endpoint), JSON.stringify(stored));
  return json({ ok: true });
}

async function handleSend(request: Request, env: Env): Promise<Response> {
  const user = await verifyFirebaseUser(request, env);
  const payload = await request.json() as PushPayload;

  if (!payload.title || !payload.message || !payload.type) {
    return json({ error: 'Invalid payload' }, 400);
  }
  if (!canSendNotificationType(payload.type, user.email, env)) {
    return json({ error: 'Forbidden' }, 403);
  }

  const allSubscriptions = await listAllSubscriptions(env.PUSH_SUBSCRIPTIONS);

  const subscriptions = allSubscriptions.filter(subscription => {
    if (!subscription) return false;
    if (payload.excludeEndpoint && subscription.endpoint === payload.excludeEndpoint) return false;
    if (payload.targetEmail) return subscription.email === payload.targetEmail;
    return true;
  });

  const results = await Promise.allSettled(
    subscriptions.flatMap(subscription => subscription ? [sendWebPush(subscription, payload, env)] : [])
  );
  const sent = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.length - sent;

  return json({ ok: true, sent, failed });
}

function canSendNotificationType(type: string, email: string | undefined, env: Env): boolean {
  const editors = (env.EDITOR_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const isEditor = !!email && editors.includes(email.toLowerCase());

  // 担当追加のみ編集者＋メール指定配信
  if (type === 'member_added') {
    return isEditor;
  }
  // イベント系・準備物等は Firebase 認証済みなら送信可（匿名認証 PWA 含む）
  if (
    type === 'event_created' || type === 'event_updated' || type === 'event_deleted'
    || type === 'event_status_updated'
    || type === 'fish_added' || type === 'photo_added' || type === 'schedule_updated' || type === 'prep_updated'
    || type === 'container_updated'
  ) {
    return true;
  }
  return false;
}

async function sendWebPush(subscription: StoredSubscription, payload: PushPayload, env: Env): Promise<void> {
  const encrypted = await encryptPushPayload(subscription, {
    title: payload.title,
    body: payload.message,
    data: {
      type: payload.type || '',
      eventId: payload.eventId || '',
      ...payload.data,
    },
  });
  const vapidJwt = await createVapidJwt(new URL(subscription.endpoint).origin, env);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${vapidJwt}, k=${env.WEB_PUSH_PUBLIC_KEY}`,
    },
    body: encrypted,
  });

  if (response.status === 404 || response.status === 410) {
    await env.PUSH_SUBSCRIPTIONS.delete(subscriptionKey(subscription.endpoint));
    return;
  }
  if (!response.ok) {
    throw new Error(`Push service responded ${response.status}`);
  }
}

async function encryptPushPayload(subscription: StoredSubscription, payload: unknown): Promise<ArrayBuffer> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const receiverPublicKey = base64UrlToUint8Array(subscription.keys.p256dh);
  const authSecret = base64UrlToUint8Array(subscription.keys.auth);
  const senderKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const senderPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const receiverPublicCryptoKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicCryptoKey },
    senderKeys.privateKey,
    256
  ));

  const info = concatBytes(
    textEncoder.encode('WebPush: info\0'),
    receiverPublicKey,
    senderPublicKey
  );
  const prkKey = await hkdfExtract(authSecret, sharedSecret);
  const ikm = await hkdfExpand(prkKey, info, 32);
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, textEncoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, textEncoder.encode('Content-Encoding: nonce\0'), 12);
  const plaintext = concatBytes(textEncoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const cryptoKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + senderPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = senderPublicKey.length;
  header.set(senderPublicKey, 21);
  return concatBytes(header, ciphertext).buffer;
}

async function createVapidJwt(audience: string, env: Env): Promise<string> {
  const publicKey = base64UrlToUint8Array(env.WEB_PUSH_PUBLIC_KEY);
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error('Invalid Web Push public key');
  }

  const jwtHeader = base64UrlEncode(textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const jwtPayload = base64UrlEncode(textEncoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || 'mailto:admin@example.com',
  })));
  const unsignedToken = `${jwtHeader}.${jwtPayload}`;
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(publicKey.slice(1, 33)),
      y: base64UrlEncode(publicKey.slice(33, 65)),
      d: env.WEB_PUSH_PRIVATE_KEY,
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    textEncoder.encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyFirebaseUser(request: Request, env: Env): Promise<FirebaseUser> {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing auth token');

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('Invalid auth token');
  }

  const header = JSON.parse(textDecoder.decode(base64UrlToUint8Array(encodedHeader))) as { kid?: string; alg?: string };
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid auth token header');

  const jwksResponse = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  const jwks = await jwksResponse.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
  const jwk = jwks.keys?.find(key => key.kid === header.kid);
  if (!jwk) throw new Error('Unknown auth token key');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToUint8Array(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!verified) throw new Error('Invalid auth token signature');

  const payload = JSON.parse(textDecoder.decode(base64UrlToUint8Array(encodedPayload))) as {
    aud?: string;
    exp?: number;
    iss?: string;
    sub?: string;
    email?: string;
  };
  const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
  if (payload.aud !== env.FIREBASE_PROJECT_ID || payload.iss !== expectedIssuer || !payload.sub) {
    throw new Error('Invalid auth token claims');
  }
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired auth token');
  }

  return { uid: payload.sub, email: payload.email };
}

function subscriptionKey(endpoint: string): string {
  return `sub:${base64UrlEncode(textEncoder.encode(endpoint))}`;
}

async function listAllSubscriptions(kv: KVNamespace): Promise<StoredSubscription[]> {
  const subscriptions: StoredSubscription[] = [];
  let cursor: string | undefined;

  do {
    const list = await kv.list({ prefix: 'sub:', ...(cursor ? { cursor } : {}) });
    const batch = await Promise.all(
      list.keys.map(async key => {
        const raw = await kv.get(key.name);
        if (!raw) return null;
        try {
          return JSON.parse(raw) as StoredSubscription;
        } catch {
          return null;
        }
      })
    );
    subscriptions.push(...batch.filter((item): item is StoredSubscription => item !== null));
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return subscriptions;
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, ikm);
  return crypto.subtle.importKey('raw', signature, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function hkdfExpand(key: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const input = concatBytes(info, new Uint8Array([1]));
  const signature = await crypto.subtle.sign('HMAC', key, input);
  return new Uint8Array(signature).slice(0, length);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from([...binary].map(char => char.charCodeAt(0)));
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function buildCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function withCors(response: Response, headers: HeadersInit): Response {
  const nextHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => nextHeaders.set(key, value));
  return new Response(response.body, { status: response.status, headers: nextHeaders });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
