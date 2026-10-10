import { WebSocket } from "ws";

export function rawDataToString(raw: WebSocket.RawData): string {
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf-8");
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf-8");
  }
  return Buffer.from(raw).toString("utf-8");
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binaryString = String.fromCharCode(...bytes);
  return btoa(binaryString);
}
