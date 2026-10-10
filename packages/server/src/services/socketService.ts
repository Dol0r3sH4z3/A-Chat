import { randomBytes } from "crypto";
import { socketServerRouter } from "./socketServerRouter.js";
import nacl from "tweetnacl";
import type { ServerMessage } from "@a-chat/shared";
import { keysDB, type DataBaseEntry } from "../database.js";
import { base64ToUint8Array, uint8ArraysEqual } from "../utils/utils.js";
import { mediaTransferGuard } from "./mediaTransferGuard.js";

type TransportType = "MESSAGE" | "MEDIA_INIT" | "MEDIA_CHUNK" | "MEDIA_END";

function registerTransportHandler(packetType: TransportType): void {
  const bufferIfOffline = packetType !== "MEDIA_CHUNK";

  socketServerRouter.on(packetType, (socket, { payload }) => {
    if (!socket.isAuthenticated) return;

    socketServerRouter.sendTo(
      payload.targetNickname,
      {
        type: packetType,
        payload: { fromNickname: socket.nickname, envelope: payload.envelope },
      } as Extract<ServerMessage, { type: TransportType }>,
      { bufferIfOffline },
    );
  });
}

export const initHandlers = (): void => {
  socketServerRouter.on("AUTH_REQUEST", (socket, _packet) => {
    const challenge = randomBytes(32).toString("base64");
    socket.challenge = challenge;

    const authChallengePacket: ServerMessage = {
      type: "AUTH_CHALLENGE",
      payload: { challenge },
    };

    socketServerRouter.send(socket, authChallengePacket);
  });

  socketServerRouter.on("AUTH_VERIFY", (socket, { payload }) => {
    if (!socket.challenge) {
      socketServerRouter.send(socket, {
        type: "AUTH_ERROR",
        payload: { message: "No challenge found.", areKeysUploaded: false },
      });
      return;
    }

    if (payload.username.length <= 5 || payload.username.length > 15) {
      socketServerRouter.send(socket, {
        type: "AUTH_ERROR",
        payload: {
          message: "Nickname must be between 6 and 14 characters long.",
          areKeysUploaded: false,
        },
      });
      return;
    }

    const IK_sign_public = base64ToUint8Array(payload.IK_pub);
    const signature = base64ToUint8Array(payload.signature);

    const existingData = keysDB.getUserData(payload.username);

    if (existingData) {
      if (!uint8ArraysEqual(existingData.IK_sign_public, IK_sign_public)) {
        socketServerRouter.send(socket, {
          type: "AUTH_ERROR",
          payload: {
            message: "This nickname is already taken.",
            areKeysUploaded: false,
          },
        });
        return;
      }
    } else {
      if (keysDB.isIdentityTaken(IK_sign_public)) {
        socketServerRouter.send(socket, {
          type: "AUTH_ERROR",
          payload: {
            message:
              "This identity key is already registered under a different nickname.",
            areKeysUploaded: false,
          },
        });
        return;
      }
    }

    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(socket.challenge),
      signature,
      IK_sign_public,
    );

    if (ok) {
      socketServerRouter.send(socket, {
        type: "AUTH_SUCCESS",
        payload: {
          message: "Authorization successful.",
          areKeysUploaded: existingData !== undefined,
        },
      });
      socket.nickname = payload.username;
      socket.isAuthenticated = true;
      socketServerRouter.registerSocket(socket);
    } else {
      socketServerRouter.send(socket, {
        type: "AUTH_ERROR",
        payload: { message: "Invalid signature.", areKeysUploaded: false },
      });
    }
  });

  socketServerRouter.on("INIT_KEYS", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;

    const keys: DataBaseEntry = {
      IK_dh_public: base64ToUint8Array(payload.IK_dh_public),
      IK_sign_public: base64ToUint8Array(payload.IK_sign_public),

      SPK_dh_public: base64ToUint8Array(payload.SPK_dh_public),
      SPK_signature: base64ToUint8Array(payload.SPK_signature),

      OPKs_public: payload.OPKs_public.map((i) => ({
        id: i.id,
        pub: base64ToUint8Array(i.pub),
      })),
    };

    const result = keysDB.addUser(socket.nickname, keys);
    console.log("Saving keys result: ", result);

    if (result === "exists") {
      console.log("Error: Keys override attempt.");
      socketServerRouter.send(socket, {
        type: "INIT_KEYS_ERROR",
        payload: { message: "Error: Nickname already taken." },
      });
      return;
    }
    if (result === "identity_taken") {
      console.log(
        "Error: this identity key is already registered under a different nickname.",
      );
      socketServerRouter.send(socket, {
        type: "INIT_KEYS_ERROR",
        payload: {
          message:
            "Error: this identity key is already registered under a different nickname.",
        },
      });
      return;
    }

    socketServerRouter.send(socket, {
      type: "INIT_KEYS_SUCCESS",
      payload: { message: "Keys uploaded successfully." },
    });
    console.log("Keys saved.");
  });

  socketServerRouter.on("GET_KEYS", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;

    const keysBundle = keysDB.getUserKeys(payload.targetNickname);
    if (!keysBundle) {
      const packet: ServerMessage = {
        type: "GET_KEYS_RESPONSE",
        payload: {
          status: "NOT_FOUND",
          targetNickname: payload.targetNickname,
        },
      };
      socketServerRouter.send(socket, packet);
    } else {
      const packet: ServerMessage = {
        type: "GET_KEYS_RESPONSE",
        payload: {
          status: "SUCCESS",
          targetNickname: payload.targetNickname,
          keys: keysBundle,
        },
      };

      socketServerRouter.send(socket, packet);
    }
  });

  socketServerRouter.on("OPK_REPLENISH_RESPONSE", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;
    keysDB.addOPKs(
      socket.nickname,
      payload.map((i) => ({ id: i.id, pub: base64ToUint8Array(i.pub) })),
    );
  });

  socketServerRouter.on("UPDATE_SPK", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;
    keysDB.rotateSPK(
      socket.nickname,
      payload.SPK_dh_public,
      payload.SPK_signature,
    );
  });

  socketServerRouter.on("INITIAL_MESSAGE", (socket, { payload }) => {
    const userData = keysDB.getUserData(socket.nickname);
    if (userData && userData.OPKs_public.length < 20) {
      socketServerRouter.send(socket, { type: "OPK_REPLENISH_REQUEST" });
    }
    socketServerRouter.sendTo(payload.targetNickname, {
      type: "INITIAL_MESSAGE",
      payload: { fromNickname: socket.nickname, envelope: payload.envelope },
    });
  });

  socketServerRouter.on("PING", (socket) => {
    socketServerRouter.send(socket, { type: "PONG" });
  });

  socketServerRouter.on("MEDIA_INIT", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;
    mediaTransferGuard.startTransfer(payload.envelope.fileID, socket.nickname);
    socketServerRouter.sendTo(payload.targetNickname, {
      type: "MEDIA_INIT",
      payload: { fromNickname: socket.nickname, envelope: payload.envelope },
    });
  });

  socketServerRouter.on("MEDIA_CHUNK", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;

    const { fileID, chunkData } = payload.envelope;
    const chunkBytesLength = Buffer.byteLength(chunkData, "base64");

    const ok = mediaTransferGuard.addChunk(fileID, chunkBytesLength);
    if (!ok) {
      socketServerRouter.send(socket, {
        type: "MEDIA_ERROR",
        payload: { fileID, reason: "FILE_TOO_LARGE" },
      });
      return;
    }

    socketServerRouter.sendTo(
      payload.targetNickname,
      {
        type: "MEDIA_CHUNK",
        payload: { fromNickname: socket.nickname, envelope: payload.envelope },
      },
      { bufferIfOffline: false },
    );
  });

  socketServerRouter.on("MEDIA_END", (socket, { payload }) => {
    if (!socket.isAuthenticated) return;

    mediaTransferGuard.endTransfer(payload.envelope.fileID);

    socketServerRouter.sendTo(payload.targetNickname, {
      type: "MEDIA_END",
      payload: { fromNickname: socket.nickname, envelope: payload.envelope },
    });
  });

  registerTransportHandler("MESSAGE");
};
