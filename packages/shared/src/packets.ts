import { z } from "zod";

import { Base64String, InitialEnvelopeSchema, KeysBundleSchema, MediaChunkEnvelopeSchema, MediaEndEnvelopeSchema, MediaErrorPayloadSchema, MediaInitEnvelopeSchema, MessageEnvelopeSchema } from "./common.js";
import { createMultiplyTypesPacket, createPacket, createPairTransportPacket, createSignalPacket } from "./helpers.js";

export const AuthRequestSchema = createSignalPacket("AUTH_REQUEST");
export const AuthChallengeSchema = createPacket(
  "AUTH_CHALLENGE",
  z.object({
    challenge: Base64String,
  }),
);

export const AuthVerifySchema = createPacket(
  "AUTH_VERIFY",
  z.object({
    IK_pub: Base64String,
    signature: Base64String,
    username: z.string(),
  }),
);

export const AuthStatusSchema = createMultiplyTypesPacket(
  ["AUTH_SUCCESS", "AUTH_ERROR"],
  z.object({
    areKeysUploaded: z.boolean(),
    message: z.string().optional(),
  }),
);

export const InitKeysSchema = createPacket(
  "INIT_KEYS",
  z.object({
    IK_dh_public: Base64String,
    IK_sign_public: Base64String,
    OPKs_public: z.array(z.object({ id: z.number(), pub: Base64String })).max(100),
    SPK_dh_public: Base64String,
    SPK_signature: Base64String,
  }),
);

export const InitKeysResponseSchema = createMultiplyTypesPacket(["INIT_KEYS_SUCCESS", "INIT_KEYS_ERROR"], z.object({ message: z.string() }));

export const GetKeysRequestSchema = createPacket(
  "GET_KEYS",
  z.object({
    targetNickname: z.string(),
  }),
);
export const GetKeysResponseSchema = createPacket("GET_KEYS_RESPONSE", z.discriminatedUnion("status", [z.object({ keys: KeysBundleSchema, status: z.literal("SUCCESS"), targetNickname: z.string() }), z.object({ status: z.literal("NOT_FOUND"), targetNickname: z.string() }), z.object({ message: z.string(), status: z.literal("ERROR"), targetNickname: z.string() })]));

export const UpdateSPKRequest = createPacket(
  "UPDATE_SPK",
  z.object({
    SPK_dh_public: Base64String,
    SPK_signature: Base64String,
  }),
);

export const MediaErrorSchema = createPacket("MEDIA_ERROR", MediaErrorPayloadSchema);

export const PingSchema = createSignalPacket("PING");
export const PongSchema = createSignalPacket("PONG");

export const [ClientInitialMessageSchema, ServerInitialMessageSchema] = createPairTransportPacket("INITIAL_MESSAGE", InitialEnvelopeSchema);
export const [ClientChatMessageSchema, ServerChatMessageSchema] = createPairTransportPacket("MESSAGE", MessageEnvelopeSchema);
export const [ClientMediaInitSchema, ServerMediaInitSchema] = createPairTransportPacket("MEDIA_INIT", MediaInitEnvelopeSchema);
export const [ClientMediaChunkSchema, ServerMediaChunkSchema] = createPairTransportPacket("MEDIA_CHUNK", MediaChunkEnvelopeSchema);
export const [ClientMediaEndSchema, ServerMediaEndSchema] = createPairTransportPacket("MEDIA_END", MediaEndEnvelopeSchema);

export const OPKsRequestSchema = createSignalPacket("OPK_REPLENISH_REQUEST");
export const OPKsResponseSchema = createPacket("OPK_REPLENISH_RESPONSE", z.array(z.object({ id: z.number().int().max(4_294_967_295), pub: Base64String })).max(100));

export const UserMessageSchema = z.discriminatedUnion("type", [InitKeysSchema, AuthRequestSchema, AuthVerifySchema, GetKeysRequestSchema, ClientChatMessageSchema, ClientInitialMessageSchema, OPKsResponseSchema, UpdateSPKRequest, ClientMediaInitSchema, ClientMediaChunkSchema, ClientMediaEndSchema, PingSchema]);
export const ServerMessageSchema = z.discriminatedUnion("type", [AuthChallengeSchema, AuthStatusSchema, GetKeysResponseSchema, ServerChatMessageSchema, ServerInitialMessageSchema, OPKsRequestSchema, ServerMediaInitSchema, ServerMediaChunkSchema, ServerMediaEndSchema, PongSchema, InitKeysResponseSchema, MediaErrorSchema]);

export type GetKeysResponse = z.infer<typeof GetKeysResponseSchema>;
export type InitialEnvelope = z.infer<typeof InitialEnvelopeSchema>;

export type KeysBundle = z.infer<typeof KeysBundleSchema>;

export type MediaChunk = z.infer<typeof MediaChunkEnvelopeSchema>;
export type MediaEnd = z.infer<typeof MediaEndEnvelopeSchema>;
export type MediaInit = z.infer<typeof MediaInitEnvelopeSchema>;

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type UserMessage = z.infer<typeof UserMessageSchema>;
