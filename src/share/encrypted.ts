// ============================================================
// sketchmark — Encrypted sharing
// Diagram DSL is encrypted in the browser.
// The server stores an opaque blob it cannot read.
// The decryption key lives only in the URL fragment (#key=...).
// ============================================================

const WORKER_URL = 'https://sketchmark.anmism7.workers.dev/';

// ── Crypto helpers ────────────────────────────────────────

async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,             // extractable so we can export to URL
    ['encrypt', 'decrypt']
  );
}

async function keyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function base64ToKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM' },
    false,             // not extractable on the receiving end
    ['decrypt']
  );
}

// ── Encrypt ───────────────────────────────────────────────

async function encryptDSL(
  dsl: string,
  key: CryptoKey,
): Promise<Uint8Array> {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(dsl);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  // prepend iv to the blob: [ iv (12 bytes) | ciphertext ]
  const result = new Uint8Array(12 + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), 12);
  return result;
}

// ── Decrypt ───────────────────────────────────────────────

async function decryptBlob(
  blob: ArrayBuffer,
  key:  CryptoKey,
): Promise<string> {
  const iv         = blob.slice(0, 12);
  const ciphertext = blob.slice(12);
  const decrypted  = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

// ── Public API ────────────────────────────────────────────

/**
 * Encrypt DSL, upload to worker, return shareable URL.
 * The URL fragment (#key=...) never reaches the server.
 */
export async function shareDiagram(dsl: string): Promise<string> {
  const key       = await generateKey();
  const blob      = await encryptDSL(dsl, key);
  const keyB64    = await keyToBase64(key);

  const res = await fetch(`${WORKER_URL}/api/blob`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob.buffer as ArrayBuffer,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

  const { id } = await res.json() as { id: string };

  // key goes into the fragment — browser never sends this to any server
  return `${window.location.origin}/playground.html?s=${id}#key=${keyB64}`;
}

/**
 * Read ?s= and #key= from the current URL, fetch + decrypt the diagram.
 * Returns null if no share params found.
 */
export async function loadSharedDiagram(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('s');
  if (!id) return null;

  // key is in the fragment — parse manually, not via URLSearchParams
  // (URLSearchParams on hash strips the #)
  const fragment = window.location.hash.slice(1);
  const keyMatch = fragment.match(/key=([^&]+)/);
  if (!keyMatch) return null;
  const keyB64   = keyMatch[1];

  const res = await fetch(`${WORKER_URL}/api/blob/${id}`);
  if (!res.ok) throw new Error('Diagram not found or expired');

  const blob = await res.arrayBuffer();
  const key  = await base64ToKey(keyB64);
  return decryptBlob(blob, key);
}