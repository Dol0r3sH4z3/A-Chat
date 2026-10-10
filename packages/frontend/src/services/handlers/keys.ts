import nacl from "tweetnacl";

import { uint8ArrayToBase64 } from "@/utils/utilities.ts";

import { cryptoManager } from "../cryptoManager.ts";
import { socketClient } from "../socketClient.ts";

export const handleOpkReplenishRequest = (): void => {
  const myKeys = cryptoManager.myKeys;

  const maxId = myKeys.OPKs.size > 0 ? Math.max(...myKeys.OPKs.keys()) : -1;
  const start = maxId + 1;

  const newOPKs = new Map<number, nacl.BoxKeyPair>();
  for (let index = start; index < start + 100; index++) {
    const keyPair = nacl.box.keyPair();
    newOPKs.set(index, keyPair);
    myKeys.OPKs.set(index, keyPair);
  }

  socketClient.send({ payload: Array.from(newOPKs, ([id, keyPair]) => ({ id, pub: uint8ArrayToBase64(keyPair.publicKey) })), type: "OPK_REPLENISH_RESPONSE" });
};
