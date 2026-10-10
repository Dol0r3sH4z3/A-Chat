import { WebSocket } from "ws";
import type { UserMessage } from "@a-chat/shared";

export interface AuthenticatedSocket extends WebSocket {
  id: string;
  nickname: string;
  isAuthenticated: boolean;
  challenge?: string;
}

export type UserEventMap = { [E in UserMessage as E["type"]]: E };

export type ServerHandler<T extends keyof UserEventMap> = (socket: AuthenticatedSocket, payload: UserEventMap[T]) => Promise<void> | void;
export type AnyServerHandler = (socket: AuthenticatedSocket, payload: UserEventMap[keyof UserEventMap]) => Promise<void> | void;
