import nacl from "tweetnacl";

import type { EventMap } from "@/types/events.ts";

import { useIdentityStore } from "@/stores/identity.ts";
import { chatLog } from "@/utils/logger.ts";
import { sendKeysToServer } from "@/utils/messageHandlers.ts";
import { uint8ArrayToBase64 } from "@/utils/utilities.ts";

import { cryptoManager } from "../cryptoManager.ts";
import { socketClient } from "../socketClient.ts";

export const handleConnected = (): void => {
  const { setIsConnected } = useIdentityStore.getState();
  setIsConnected(true);
  console.log("CONNECTED.");
  chatLog("Connected to server.");
};

export const handleDisconnected = (): void => {
  const { setIsAuthorized, setIsConnected } = useIdentityStore.getState();
  setIsConnected(false);
  setIsAuthorized(false);
  console.log("DISCONNECTED.");
  chatLog("Disconnected.", { status: "error" });
};

export const handleAuthChallenge = ({
  payload,
}: EventMap["AUTH_CHALLENGE"]): void => {
  const { challenge } = payload;
  const nickname = useIdentityStore.getState().nickname;

  const keys = cryptoManager.myKeys;

  const message = new TextEncoder().encode(challenge);
  const signature = nacl.sign.detached(message, keys.IK_sign.secretKey);

  socketClient.send({
    payload: {
      IK_pub: uint8ArrayToBase64(keys.IK_sign.publicKey),
      signature: uint8ArrayToBase64(signature),
      username: nickname,
    },
    type: "AUTH_VERIFY",
  });
};

export const handleAuthSuccess = async ({
  payload,
}: EventMap["AUTH_SUCCESS"]): Promise<void> => {
  const { setIsAuthorized } = useIdentityStore.getState();
  setIsAuthorized(true);
  console.log("Auth success:", payload.message);
  chatLog(`Authorization successfull: ${payload.message ?? ""}`, {
    status: "success",
  });
  console.log("Keys are not uploaded. Sending...");
  if (payload.areKeysUploaded === false) {
    await sendKeysToServer();
  }
  cryptoManager.checkAndRotateSPK();
};

export const handleAuthError = ({ payload }: EventMap["AUTH_ERROR"]): void => {
  const { setIsAuthorized } = useIdentityStore.getState();
  setIsAuthorized(false);
  console.log("Auth error:", payload.message);
  chatLog(`Authorization error: ${payload.message ?? ""}`, { status: "error" });
};
