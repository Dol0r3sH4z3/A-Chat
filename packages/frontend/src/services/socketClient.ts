import { ServerMessageSchema, type UserMessage } from "@a-chat/shared";

import type { EmitEvent, EventMap, PacketCallback } from "@/types/events.ts";

class SocketClient {
  private ws: null | WebSocket = null;
  private readonly listeners = new Map<string, PacketCallback[]>();
  private connectionPromise: null | Promise<void> = null;

  private readonly baseReconnectDelay = 1000;
  private readonly maxReconnectAttempts = 10;
  private readonly maxReconnectDelay = 30_000;
  private readonly pingIntervalMs = 30_000;
  private readonly pongTimeoutMs = 10_000;

  private manualClose = false;
  private reconnectAttempts = 0;

  private pongTimeout: null | ReturnType<typeof setTimeout> = null;
  private pingInterval: null | ReturnType<typeof setInterval> = null;
  private reconnectTimeout: null | ReturnType<typeof setInterval> = null;

  constructor() {
    this.on("PONG", () => {
      if (this.pongTimeout !== null) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
      console.log("PONG");
    });
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      // this.ws = new WebSocket("ws://localhost:8080");
      this.ws = new WebSocket("wss://a-chat-network.duckdns.org");
      this.ws.addEventListener("open", (): void => {
        console.log("WebSocket daemon started.");

        this.startHeartbeat();

        void this.emit({ payload: null, type: "CONNECTED" }).catch(
          console.error,
        );
        resolve();
      });

      this.ws.addEventListener("message", (event): void => {
        try {
          if (typeof event.data !== "string") return;
          const data: string = event.data;
          const parsed = ServerMessageSchema.safeParse(JSON.parse(data));

          if (!parsed.success) return;

          void this.emit(parsed.data).catch(console.error);
        } catch (error) {
          console.log("Socket parse error", error);
        }
      });

      this.ws.addEventListener("close", (): void => {
        void this.emit({ payload: null, type: "DISCONNECTED" }).catch(
          console.error,
        );
        console.log("CLOSED!");

        if (!this.manualClose) {
          this.scheduleReconnect();
        }
      });

      this.ws.addEventListener("error", (error): void => {
        this.connectionPromise = null;
        reject(new Error("Socket error.", { cause: error }));
        this.ws?.close();
      });
    });

    return this.connectionPromise;
  }

  on<K extends keyof EventMap>(
    type: K,
    callback: (payload: EventMap[K]) => Promise<void> | void,
  ): void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)?.push(callback as PacketCallback);
  }

  off<K extends keyof EventMap>(
    type: K,
    callback: (payload: EventMap[K]) => Promise<void> | void,
  ): void {
    const callbacks = this.listeners.get(type);
    if (!callbacks) return;

    this.listeners.set(
      type,
      callbacks.filter((existing) => existing !== callback),
    );
  }

  once<K extends keyof EventMap>(
    type: K,
    callback: (payload: EventMap[K]) => Promise<void> | void,
  ): void {
    const wrapper: PacketCallback = async (event) => {
      this.off(type, wrapper);
      await callback(event as EventMap[K]);
    };
    this.on(type, wrapper);
  }

  send(packet: UserMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send packet, socket not open:", packet.type);
      return;
    }
    this.ws.send(JSON.stringify(packet));
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimeout !== null) clearInterval(this.reconnectTimeout);
    if (this.pingInterval !== null) clearInterval(this.pingInterval);
    this.ws?.close();
  }

  authorize(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off("AUTH_SUCCESS", onSuccess);
        this.off("AUTH_ERROR", onError);
        reject(new Error("Превышено время ожидания от сервера."));
      }, 10_000);

      const onSuccess: PacketCallback = () => {
        clearTimeout(timeout);
        this.off("AUTH_ERROR", onError);
        resolve(true);
      };

      const onError: PacketCallback = () => {
        clearTimeout(timeout);
        this.off("AUTH_SUCCESS", onSuccess);
        this.disconnect();
        resolve(false);
      };

      this.once("AUTH_SUCCESS", onSuccess);
      this.once("AUTH_ERROR", onError);

      this.send({
        type: "AUTH_REQUEST",
      });
    });
  }

  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Maximum amount of attempts exceeded.");
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      this.maxReconnectDelay,
    );

    this.reconnectAttempts += 1;
    console.log(
      `Reconnecting in: ${(delay / 1000).toString()}s. Attempt: ${this.reconnectAttempts.toString()}`,
    );

    this.reconnectTimeout = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private async emit(event: EmitEvent): Promise<void> {
    const type = event.type;
    const callbacks = this.listeners.get(type);
    if (!callbacks) return;

    try {
      await Promise.all(
        callbacks.map(async (callback) => {
          try {
            await callback(event);
          } catch (error) {
            console.error(`Error handling event ${type}:`, error);
          }
        }),
      );
    } catch (error) {
      console.error("Critical emit error:", error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      this.send({ type: "PING" });

      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      this.pongTimeout = setTimeout(() => {
        console.error("Server is not responding.");
        this.ws?.close();
      }, this.pongTimeoutMs);
    }, this.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }
}

export const socketClient = new SocketClient();
