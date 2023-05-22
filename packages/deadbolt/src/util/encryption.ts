export interface EncryptionOptions {
  algorithm: string;
  hash: string;
  ivLength: number;
  key: string;
  crypto: Crypto;
}

export function encryption(options: EncryptionOptions) {
  const { subtle } = options.crypto;

  function getRandomIv() {
    return crypto.getRandomValues(new Uint8Array(options.ivLength));
  }

  function getAlgo(iv: Uint8Array = getRandomIv()) {
    return { name: options.algorithm, iv };
  }

  async function getCryptoKey() {
    const buffer = encodeText(options.key);
    const hashed = await subtle.digest(options.hash, buffer);
    return subtle.importKey("raw", hashed, options.algorithm, false, ["encrypt", "decrypt"]);
  }

  async function encrypt(value: string) {
    const algo = getAlgo();
    const key = await getCryptoKey();
    const encrypted = await subtle.encrypt(algo, key, encodeText(value));
    return btoa(bytesToString(algo.iv) + bytesToString(new Uint8Array(encrypted)));
  }

  async function decrypt(base64: string) {
    const key = await getCryptoKey();
    const encoded = atob(base64);
    const algo = getAlgo(stringToBytes(encoded.slice(0, options.ivLength)));
    const encrypted = stringToBytes(encoded.slice(options.ivLength));
    return decodeText(await subtle.decrypt(algo, key, encrypted));
  }

  return { encrypt, decrypt };
}

export function getRandomString(length: number, crypto: Crypto) {
  return bytesToString(crypto.getRandomValues(new Uint8Array(length)));
}

export function bytesToString(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map(byte => String.fromCharCode(byte))
    .join("");
}

export function stringToBytes(text: string): Uint8Array {
  return new Uint8Array(Array.from(text).map(ch => ch.charCodeAt(0)));
}

export function encodeText(text: string): ArrayBuffer {
  return new TextEncoder().encode(text);
}

export function decodeText(buffer: ArrayBuffer) {
  return new TextDecoder().decode(buffer);
}
