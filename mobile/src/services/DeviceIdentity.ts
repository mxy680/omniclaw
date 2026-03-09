import nacl from 'tweetnacl';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// React Native doesn't provide crypto.getRandomValues, so configure tweetnacl's PRNG
(nacl as any).setPRNG((x: Uint8Array, n: number) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

function toBase64(arr: Uint8Array): string {
  let s = '';
  for (let i = 0; i < arr.length; i++) {
    s += String.fromCharCode(arr[i]);
  }
  return btoa(s);
}

const DEVICE_SECRET_KEY = 'omniclaw_device_secret_key';
const DEVICE_PUBLIC_KEY = 'omniclaw_device_public_key';
const DEVICE_ID_KEY = 'omniclaw_device_id';

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface DeviceKeys {
  deviceId: string;
  publicKey: string; // base64url
  secretKey: Uint8Array;
}

/**
 * Load or generate Ed25519 device identity.
 * Keys are stored in SecureStore and persist across app launches.
 */
export async function getDeviceIdentity(): Promise<DeviceKeys> {
  const stored = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
  if (stored) {
    const secretKey = new Uint8Array(JSON.parse(stored));
    const pubKey = await SecureStore.getItemAsync(DEVICE_PUBLIC_KEY);
    const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (pubKey && deviceId) {
      return { deviceId, publicKey: pubKey, secretKey };
    }
  }

  // Generate new keypair
  const keyPair = nacl.sign.keyPair();
  const publicKeyBase64Url = toBase64Url(toBase64(keyPair.publicKey));

  // deviceId = SHA256(rawPublicKeyBytes).hex
  const hashBuffer = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    keyPair.publicKey,
  );
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Store keys
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, JSON.stringify(Array.from(keyPair.secretKey)));
  await SecureStore.setItemAsync(DEVICE_PUBLIC_KEY, publicKeyBase64Url);
  await SecureStore.setItemAsync(DEVICE_ID_KEY, hashHex);

  return { deviceId: hashHex, publicKey: publicKeyBase64Url, secretKey: keyPair.secretKey };
}

export interface DeviceConnectParams {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

/**
 * Sign a connect.challenge nonce using the V3 device auth payload format.
 */
export function signChallenge(
  keys: DeviceKeys,
  nonce: string,
  token: string,
  scopes: string[],
): DeviceConnectParams {
  const signedAtMs = Date.now();
  const clientId = 'openclaw-control-ui';

  // V3 payload: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
  const payload = [
    'v3',
    keys.deviceId,
    clientId,
    'ui',
    'operator',
    scopes.join(','),
    String(signedAtMs),
    token,
    nonce,
    Platform.OS,
    '',
  ].join('|');

  const messageBytes = new TextEncoder().encode(payload);
  const signatureBytes = nacl.sign.detached(messageBytes, keys.secretKey);
  const signatureBase64Url = toBase64Url(toBase64(signatureBytes));

  return {
    id: keys.deviceId,
    publicKey: keys.publicKey,
    signature: signatureBase64Url,
    signedAt: signedAtMs,
    nonce,
  };
}
