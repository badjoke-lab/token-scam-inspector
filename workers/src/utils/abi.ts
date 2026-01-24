const HEX_PREFIX = "0x";
const WORD_HEX_LENGTH = 64;

const stripHexPrefix = (value: string): string =>
  value.startsWith(HEX_PREFIX) ? value.slice(2) : value;

const isValidHex = (value: string): boolean => /^[0-9a-fA-F]*$/.test(value);

const hexToBytes = (hex: string): Uint8Array | null => {
  if (hex.length % 2 !== 0 || !isValidHex(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

const decodeUtf8 = (hex: string): string | null => {
  const bytes = hexToBytes(hex);
  if (!bytes) {
    return null;
  }

  try {
    return new TextDecoder().decode(bytes);
  } catch (error) {
    return null;
  }
};

const cleanDecodedString = (value: string): string | null => {
  const trimmed = value.replace(/\u0000+$/g, "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const decodeBytes32String = (hex: string): string | null =>
  cleanDecodedString(decodeUtf8(hex) ?? "");

const decodeDynamicString = (hex: string): string | null => {
  if (hex.length < WORD_HEX_LENGTH * 2) {
    return null;
  }

  const offsetHex = hex.slice(0, WORD_HEX_LENGTH);
  const offsetBytes = Number.parseInt(offsetHex, 16);
  if (!Number.isFinite(offsetBytes)) {
    return null;
  }

  const offsetIndex = offsetBytes * 2;
  if (
    offsetIndex < WORD_HEX_LENGTH ||
    offsetIndex + WORD_HEX_LENGTH > hex.length
  ) {
    return null;
  }

  const lengthHex = hex.slice(offsetIndex, offsetIndex + WORD_HEX_LENGTH);
  const lengthBytes = Number.parseInt(lengthHex, 16);
  if (!Number.isFinite(lengthBytes)) {
    return null;
  }

  const dataStart = offsetIndex + WORD_HEX_LENGTH;
  const dataEnd = dataStart + lengthBytes * 2;
  if (dataEnd > hex.length) {
    return null;
  }

  const dataHex = hex.slice(dataStart, dataEnd);
  return cleanDecodedString(decodeUtf8(dataHex) ?? "");
};

const readFirstWord = (hex: string): string => hex.slice(0, WORD_HEX_LENGTH);

export const decodeAbiString = (value: string): string | null => {
  const hex = stripHexPrefix(value);
  if (!hex || !isValidHex(hex)) {
    return null;
  }

  if (hex.length === WORD_HEX_LENGTH) {
    return decodeBytes32String(hex);
  }

  return decodeDynamicString(hex) ?? decodeBytes32String(readFirstWord(hex));
};

export const decodeAbiUint8 = (value: string): number | null => {
  const hex = stripHexPrefix(value);
  if (!hex || hex.length < WORD_HEX_LENGTH || !isValidHex(hex)) {
    return null;
  }

  const parsed = Number.parseInt(hex.slice(0, WORD_HEX_LENGTH), 16);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};
