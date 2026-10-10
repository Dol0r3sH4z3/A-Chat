import { handleAuthChallenge, handleAuthError, handleAuthSuccess, handleConnected, handleDisconnected } from "./handlers/auth.ts";
import { handleOpkReplenishRequest } from "./handlers/keys.ts";
import { handleMediaChunk, handleMediaEnd, handleMediaInit } from "./handlers/media.ts";
import { handleInitialMessage, handleMessage } from "./handlers/messaging.ts";
import { socketClient } from "./socketClient.ts";

export function initSubscribitions(): void {
  socketClient.on("CONNECTED", handleConnected);
  socketClient.on("DISCONNECTED", handleDisconnected);
  socketClient.on("AUTH_CHALLENGE", handleAuthChallenge);
  socketClient.on("AUTH_SUCCESS", handleAuthSuccess);
  socketClient.on("AUTH_ERROR", handleAuthError);
  socketClient.on("INITIAL_MESSAGE", handleInitialMessage);
  socketClient.on("MESSAGE", handleMessage);
  socketClient.on("OPK_REPLENISH_REQUEST", handleOpkReplenishRequest);
  socketClient.on("MEDIA_INIT", handleMediaInit);
  socketClient.on("MEDIA_CHUNK", handleMediaChunk);
  socketClient.on("MEDIA_END", handleMediaEnd);
}
