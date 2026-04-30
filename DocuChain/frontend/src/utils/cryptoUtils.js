import CryptoJS from 'crypto-js';

export const DOCUCHAIN_SIGN_MESSAGE = 'Authorize DocuChain Encryption';

const HEADER_MAGIC = 'DCENC';
const HEADER_VERSION = 1;
const INNER_MAGIC_BYTES = new Uint8Array([
  68, 79, 67, 85, 65, 85, 84, 72, 1,
]);

export function deriveKeyFromPassword(password) {
  return CryptoJS.SHA256(password);
}

export function deriveKeyFromSignature(signature) {
  return CryptoJS.SHA256(signature);
}

export const encryptDataUrlString = (dataUrlString, key) => {
  if (!dataUrlString) throw new Error("Encryption Failed: File data is missing or undefined.");
  if (!key) throw new Error("Encryption Failed: Key/Signature is missing or undefined.");

  // Force string conversion. If key is a CryptoJS WordArray, this converts it properly.
  const stringKey = typeof key !== 'string' ? key.toString() : key;
  const cleanDataUrl = String(dataUrlString).trim();

  return CryptoJS.AES.encrypt(cleanDataUrl, stringKey).toString();
};

export function decryptDataUrlCipherToDataUrl(encryptedText, key) {
  if (!key) throw new Error('Missing decryption key.');
  const cleanCiphertext = String(encryptedText).trim().replace(/^"|"$/g, '');
  
  // THE FIX: Mirror the encryption key formatting perfectly
  const stringKey = typeof key !== 'string' ? key.toString() : key;

  try {
    const bytes = CryptoJS.AES.decrypt(cleanCiphertext, stringKey);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Incorrect Password or Signature');
    }
    
    return decryptedText;
  } catch (error) {
    throw new Error('Decryption Failed: Incorrect Password or Signature.');
  }
}

function uint8ToWordArray(u8) {
  return CryptoJS.lib.WordArray.create(u8);
}

function wordArrayToUint8(wa) {
  const { words, sigBytes } = wa;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return u8;
}



export function decryptFileBuffer(encryptedBuffer, key) {
  const u8 = new Uint8Array(encryptedBuffer);
  const minLen = 4 + 1 + 1 + 16 + 16;
  if (u8.length < minLen) {
    return { ok: false, error: 'File too small to be encrypted DocuChain data.' };
  }

  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== HEADER_MAGIC) {
    return { ok: false, error: 'NOT_DOCUCHAIN_ENCRYPTED' };
  }
  if (u8[4] !== HEADER_VERSION) {
    return { ok: false, error: 'Unsupported encryption version.' };
  }
  const mode = u8[5];
  const iv = uint8ToWordArray(u8.slice(6, 22));
  const ct = uint8ToWordArray(u8.slice(22));

  let decryptedWA;
  try {
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ct });
    decryptedWA = CryptoJS.AES.decrypt(cipherParams, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
  } catch {
    return { ok: false, error: 'Decryption failed.' };
  }

  const plainU8 = wordArrayToUint8(decryptedWA);
  if (plainU8.length < INNER_MAGIC_BYTES.length) {
    return { ok: false, error: 'Wrong key or corrupted data.' };
  }
  for (let i = 0; i < INNER_MAGIC_BYTES.length; i++) {
    if (plainU8[i] !== INNER_MAGIC_BYTES[i]) {
      return { ok: false, error: 'Wrong key or corrupted data.' };
    }
  }

  const sub = plainU8.subarray(INNER_MAGIC_BYTES.length);
  const copy = new Uint8Array(sub);
  return {
    ok: true,
    data: copy.buffer,
    mode,
  };
}

export function isDocuChainEncryptedFile(buffer) {
  const u8 = new Uint8Array(buffer);
  if (u8.length < 4) return false;
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  return magic === HEADER_MAGIC;
}

export function isLikelyPlainMediaFile(buffer) {
  const u8 = new Uint8Array(buffer);
  if (u8.length < 12) return false;
  if (u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46) return true;
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return true;
  if (u8[0] === 0xff && u8[1] === 0xd8) return true;
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) return true;
  return false;
}
