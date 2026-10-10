import { z } from "zod";

/*eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types*/
export const createPacket = <K extends string, T extends z.ZodType>(type: K, payload: T) => z.object({ type: z.literal(type), payload });
/*eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types*/
export const createMultiplyTypesPacket = <K extends string, T extends z.ZodType>(type: [K, ...K[]], payload: T) => z.object({ type: z.enum(type), payload });
/*eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types*/
export const createSignalPacket = <K extends string>(type: K) => z.object({ type: z.literal(type) });
export const createPairTransportPacket = <K extends string, T extends z.ZodType>(type: K, payload: T) =>
  [
    z.object({
      payload: z.object({
        envelope: payload,
        targetNickname: z.string(),
      }),
      type: z.literal(type),
    }),
    z.object({
      payload: z.object({
        envelope: payload,
        fromNickname: z.string(),
      }),
      type: z.literal(type),
    }),
  ] as const;
