import * as ExpoCrypto from 'expo-crypto';

// Polyfill crypto.getRandomValues for libraries like tweetnacl
// that expect the Web Crypto API to be available.
if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {} as Crypto;
}

if (typeof global.crypto.getRandomValues === 'undefined') {
  global.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array === null) return array;
    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    const target = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    target.set(bytes);
    return array;
  };
}
