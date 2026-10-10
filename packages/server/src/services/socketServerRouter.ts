import { WebSocket, WebSocketServer } from "ws";
import type { AnyServerHandler, AuthenticatedSocket, ServerHandler, UserEventMap } from "../types/entities.js";
import { UserMessageSchema, type ServerMessage } from "@a-chat/shared";
import { rawDataToString } from "../utils/utils.js";
import { offlineBuffer } from "./offlineBuffer.js";

class SocketServerRouter {
  private handlers = new Map<string, AnyServerHandler[]>();
  private sockets = new Map<string, AuthenticatedSocket>();

  on<T extends keyof UserEventMap>(type: T, handler: ServerHandler<T>): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)?.push(handler as AnyServerHandler);
  }

  off<T extends keyof UserEventMap>(type: T, handler: ServerHandler<T>): void {
    const list = this.handlers.get(type);
    if (!list) return;
    this.handlers.set(
      type,
      list.filter((existing) => existing !== handler),
    );
  }

  once<T extends keyof UserEventMap>(type: T, handler: ServerHandler<T>): void {
    const wrapper: AnyServerHandler = async (socket, payload) => {
      this.off(type, handler);
      await handler(socket, payload as UserEventMap[T]);
    };
    this.on(type, wrapper);
  }

  private async dispatch(socket: AuthenticatedSocket, event: UserEventMap[keyof UserEventMap]): Promise<void> {
    const callbacks = this.handlers.get(event.type);
    if (!callbacks) return;

    await Promise.all(
      callbacks.map(async (cb) => {
        try {
          await cb(socket, event);
        } catch (e) {
          console.log(`Error handling packet: ${event.type}. Message: ${e instanceof Error ? e.message : String(e)}`);
        }
      }),
    );
  }

  attach(wss: WebSocketServer): void {
    wss.on("connection", (ws) => {
      const socket = ws as AuthenticatedSocket;
      console.log("Someone connected");

      socket.nickname = "";
      socket.id = crypto.randomUUID();
      socket.isAuthenticated = false;

      socket.on("message", (raw) => {
        try {
          const data = JSON.parse(rawDataToString(raw)) as unknown;
          const parsed = UserMessageSchema.safeParse(data);

          if (!parsed.success) {
            console.warn(`Invalid message: ${parsed.error}`);
            return;
          }

          this.dispatch(socket, parsed.data).catch(console.error);
        } catch (err) {
          console.error("Socket error: ", err);
        }
      });

      socket.on("close", () => {
        if (socket.nickname && this.sockets.get(socket.nickname) === socket) {
          this.sockets.delete(socket.nickname);
        }
      });
    });
  }

  registerSocket(socket: AuthenticatedSocket): void {
    this.sockets.get(socket.nickname)?.close();
    this.sockets.set(socket.nickname, socket);

    const pending = offlineBuffer.flush(socket.nickname);
    for (const message of pending) {
      this.send(socket, message);
    }
  }

  sendTo(targetNickname: string, message: ServerMessage, options?: { bufferIfOffline: boolean }): void {
    const bufferIfOffline = options?.bufferIfOffline ?? true;
    const socket = this.sockets.get(targetNickname);
    if (socket?.readyState !== WebSocket.OPEN) {
      if (bufferIfOffline) {
        offlineBuffer.add(targetNickname, message);
      }
      return;
    }

    this.send(socket, message);
  }

  send(socket: AuthenticatedSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  broadcast(wss: WebSocketServer, message: ServerMessage, filter?: (socket: AuthenticatedSocket) => boolean): void {
    wss.clients.forEach((client) => {
      const socket = client as AuthenticatedSocket;
      if (filter && !filter(socket)) return;
      this.send(socket, message);
    });
  }
}

export const socketServerRouter = new SocketServerRouter();
