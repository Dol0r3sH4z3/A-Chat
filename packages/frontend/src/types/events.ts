import type { ServerMessage } from "@a-chat/shared";

export type EmitEvent = ServerMessage | SystemEvent;

export type EventMap = { [E in EmitEvent as E["type"]]: E };

export type PacketCallback = (payload: EmitEvent) => Promise<void> | void;

export type SystemEvent = { payload: null; type: "CONNECTED" } | { payload: null; type: "DISCONNECTED" };
