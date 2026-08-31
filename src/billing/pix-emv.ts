/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) used by BR Code / PIX EMV. */
export const crc16CcittFalse = (value: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < value.length; i += 1) {
    crc ^= value.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

export const normalizePixEmvPayload = (payload: string): string =>
  String(payload ?? "")
    .replace(/\s+/g, "")
    .trim();

export const isValidPixEmvPayload = (payload: string): boolean => {
  const raw = normalizePixEmvPayload(payload);
  if (raw.length < 20) return false;
  if (!raw.startsWith("000201")) return false;
  if (!raw.toLowerCase().includes("br.gov.bcb.pix")) return false;
  const crcTag = raw.lastIndexOf("6304");
  if (crcTag < 0 || raw.length < crcTag + 8) return false;
  const computed = crc16CcittFalse(raw.slice(0, crcTag + 4));
  const expected = raw.slice(crcTag + 4, crcTag + 8).toUpperCase();
  return computed === expected;
};
