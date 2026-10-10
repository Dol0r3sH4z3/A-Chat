import nacl from "tweetnacl";

import type { EncryptedMessage, Header, MyKeysStorage, RawKeysBundle } from "@/types/crypto.ts";
import type { KeysBundle, MessageEnvelope } from "@/types/packets.ts";
import type { VirtualNode } from "@/types/virtualFs.ts";

import type { SyncLogFunction } from "./logger.ts";

import { getNodeAtPath, resolvePath } from "./pathResolver.ts";

export function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;

  for (let index = 0; index < a.byteLength; index++) {
    if (a[index] !== b[index]) return false;
  }

  return true;
}

export function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.fromBase64(base64);
}

export function buildAAD(header: Header): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(header.dh_pub.length + 8);
  buffer.set(header.dh_pub, 0);
  const view = new DataView(buffer.buffer);
  view.setUint32(header.dh_pub.length, header.pn);
  view.setUint32(header.dh_pub.length + 4, header.n);

  return buffer;
}

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const finalArray = new Uint8Array(totalLength);

  let offset = 0;
  for (const array of arrays) {
    finalArray.set(array, offset);
    offset += array.length;
  }

  return finalArray;
}

export function extractKeys(keys: KeysBundle): RawKeysBundle {
  const baseKeysBundle: RawKeysBundle = {
    IK_dh_public: base64ToUint8Array(keys.IK_dh_public),
    IK_sign_public: base64ToUint8Array(keys.IK_sign_public),
    SPK_dh_public: base64ToUint8Array(keys.SPK_dh_public),
    SPK_signature: base64ToUint8Array(keys.SPK_signature),
  };
  return {
    ...baseKeysBundle,
    ...(keys.OPK_public && {
      OPK_public: {
        id: keys.OPK_public.id,
        pub: base64ToUint8Array(keys.OPK_public.pub),
      },
    }),
  };
}

export async function generateKeys(): Promise<MyKeysStorage> {
  const seed = crypto.getRandomValues(new Uint8Array(32));

  const hash = await crypto.subtle.digest("SHA-512", seed);
  const x25519PrivBytes = new Uint8Array(hash).slice(0, 32);

  x25519PrivBytes[0]! &= 248;
  x25519PrivBytes[31]! &= 127;
  x25519PrivBytes[31]! |= 64;

  const IK_sign = nacl.sign.keyPair.fromSeed(seed);
  const IK_dh = nacl.box.keyPair.fromSecretKey(x25519PrivBytes);
  const SPK_dh = nacl.box.keyPair();

  const OPKs = new Map<number, nacl.BoxKeyPair>();
  for (let index = 0; index < 100; index++) {
    OPKs.set(index, nacl.box.keyPair());
  }

  const SPK_signature = nacl.sign.detached(SPK_dh.publicKey, IK_sign.secretKey);
  const keys: MyKeysStorage = {
    IK_dh,
    IK_sign,
    OPKs,
    SPK_dh,
    SPK_signature,
  };

  return keys;
}

export function handleCat(arguments_: string[], logFunction: SyncLogFunction, sessionId: string, fileSystem: VirtualNode, cwd: string[]): void {
  const target = arguments_[0];
  if (target === undefined) {
    logFunction("cat: не указано имя файла.", { sessionId, status: "error" });
    return;
  }

  const segments = resolvePath(cwd, target);
  const node = getNodeAtPath(fileSystem, segments);

  if (!node) {
    logFunction(`cat: ${target}: Нет такого файла или каталога.`, { sessionId, status: "error" });
    return;
  }
  if (node.type === "directory") {
    logFunction(`cat: ${target}: Это каталог.`, { sessionId, status: "error" });
    return;
  }

  logFunction(node.content ?? "", { sessionId });
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  return bytes.toBase64();
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSecretProgram(logFunction: SyncLogFunction, sessionId: string): Promise<void> {
  logFunction("Initializing...", { sessionId, status: "note", style: "typewriter" });
  await wait(5000);

  logFunction("Patching system...", { sessionId, status: "error", style: "shaking" });
  await wait(2000);

  logFunction("Success.", { sessionId, status: "error", style: "shaking" });
}

export const validateNickname = (nickname: string, logFunction?: SyncLogFunction): null | string => {
  const cleaned = nickname.trim();

  if (cleaned && cleaned.length >= 2 && cleaned.length <= 15 && !cleaned.startsWith('"') && !cleaned.endsWith('"')) {
    return cleaned;
  }
  if (logFunction) logFunction("Недопустимый никнейм! Длина должна быть от 2 до 15 символов.", { status: "error" });
  return null;
};

export const serializeMessageEnvelope = (message: EncryptedMessage): MessageEnvelope => {
  return {
    cipherText: uint8ArrayToBase64(message.cipherText),
    header: {
      dh_pub: uint8ArrayToBase64(message.header.dh_pub),
      n: message.header.n,
      pn: message.header.pn,
    },
    iv: uint8ArrayToBase64(message.iv),
  };
};

export const deserializeMessageEnvelope = (message: MessageEnvelope): EncryptedMessage => {
  return {
    cipherText: base64ToUint8Array(message.cipherText),
    header: {
      dh_pub: base64ToUint8Array(message.header.dh_pub),
      n: message.header.n,
      pn: message.header.pn,
    },
    iv: base64ToUint8Array(message.iv),
  };
};

export const getFileType = (type: string): "image" | "other" | "video" => {
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  return "other";
};

export const generateThumbnail = async (blob: Blob, type: "image" | "video"): Promise<string> => {
  const THUMB_MAX_SIZE = 300;

  const bitmap = type === "image" ? await createImageBitmap(blob) : await grabVideoFrame(blob);

  const scale = Math.min(1, THUMB_MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  const THUMB_QUALITY = 0.6;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if ("close" in bitmap) bitmap.close();

  return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
};

const grabVideoFrame = (blob: Blob): Promise<ImageBitmap> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);

    video.src = url;
    video.muted = true;
    video.playsInline = true;

    let isSettled = false;

    const cleanup = (): void => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };

    const finish = (function_: () => void): void => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      function_();
    };

    const timeout = setTimeout(() => {
      finish(() => {
        reject(new Error("Video thumbnail generation timed out"));
      });
    }, 5000);

    video.addEventListener(
      "loadeddata",
      () => {
        const seekTo = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 2) : 0;
        video.currentTime = seekTo;
      },
      { once: true },
    );

    video.addEventListener(
      "seeked",
      () => {
        clearTimeout(timeout);
        if (video.readyState < 2) {
          finish(() => {
            reject(new Error("Video has no usable frame"));
          });
          return;
        }
        createImageBitmap(video)
          //eslint-disable-next-line unicorn/prefer-await
          .then((bmp) => {
            //eslint-disable-next-line sonarjs/no-nested-functions
            finish(() => {
              resolve(bmp);
            });
          })
          //eslint-disable-next-line unicorn/prefer-await
          .catch((error: unknown) => {
            //eslint-disable-next-line sonarjs/no-nested-functions
            finish(() => {
              reject(new Error(error instanceof Error ? error.message : String(error)));
            });
          });
      },
      { once: true },
    );

    video.addEventListener("error", () => {
      cleanup();
      finish(() => {
        reject(new Error("Failed to load video for thumbnail"));
      });
    });
  });
};
