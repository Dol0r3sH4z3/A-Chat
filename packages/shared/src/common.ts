import { z } from "zod";

export const Base64String = z.string().regex(/^[a-zA-Z0-9+/]*={0,2}$/, "Invalid Base64");

export const KeysBundleSchema = z.object({
  IK_dh_public: Base64String,
  IK_sign_public: Base64String,
  SPK_dh_public: Base64String,
  SPK_signature: Base64String,
  OPK_public: z.object({ id: z.number(), pub: Base64String }).optional(),
});

export const InitialEnvelopeSchema = z.object({
  cipherText: Base64String,
  iv: Base64String,
  EK_pub: Base64String,
  IK_dh_pub: Base64String,
  OPK_id: z.number().optional(),
  header: z.object({
    dh_pub: Base64String,
    n: z.number(),
    pn: z.number(),
  }),
});

export const MessageEnvelopeSchema = z.object({
  cipherText: Base64String,
  iv: Base64String,
  header: z.object({
    dh_pub: Base64String,
    n: z.number(),
    pn: z.number(),
  }),
});

export const MediaInitPayloadSchema = z.object({
  fileMasterKey: Base64String,
  fileName: z.string(),
  fileSize: z.number(),
});

export const MediaInitEnvelopeSchema = z.object({
  ...MessageEnvelopeSchema.shape,
  fileID: z.string(),
});

export const MediaChunkEnvelopeSchema = z.object({
  chunkData: Base64String,
  chunkIndex: z.number(),

  iv: Base64String,
  fileID: z.string(),
});

export const MediaEndEnvelopeSchema = z.object({
  fileID: z.string(),
  mimeType: z.string(),
  sha256sum: Base64String,
});

export const MediaErrorPayloadSchema = z.object({
  fileID: z.string(),
  reason: z.enum(["FILE_TOO_LARGE"]),
});

export type MediaInitPayload = z.infer<typeof MediaInitPayloadSchema>;
