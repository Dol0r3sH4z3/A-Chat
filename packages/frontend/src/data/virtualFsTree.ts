import type { VirtualNode } from "@/types/virtualFs.ts";

/* eslint-disable unicorn/max-nested-calls,perfectionist/sort-objects */

const directory = (name: string, children: Record<string, VirtualNode> = {}): VirtualNode => {
  return { children, name, type: "directory" };
};

const file = (name: string, fileKind: "program" | "text", content?: string): VirtualNode => {
  return { content, fileKind, name, type: "file" };
};

const filesContent = {
  config: `[session]
timeout=3600
rekey=true

[storage]
persistent=true
encrypted=true

[network]
transport=websocket`,

  ideas: `Ideas

constellation loader
hidden terminal
experimental interface`,

  readme: `Welcome to A-Chat.

This directory belongs to the current user.

Nothing here is synchronized
unless explicitly requested.`,

  status: `A-Chat runtime status

connection: online
peer: connected
encryption: active
storage: ready`,

  todo: `A-Chat TODO

- improve file transfer
- redesign chat interface
- fix mobile layout
- add secret things`,

  version: `A-Chat
version: 0.4.1
runtime: web
protocol: E2EE`,

  welcome: `You found this file.

There is nothing important here.

Probably.`,
} as const;

export const rootFileSystem: VirtualNode = directory("/", {
  system: directory("system", {
    status: file("status", "text", filesContent.status),
    version: file("version", "text", filesContent.version),
    config: file("config", "text", filesContent.config),
  }),
  home: directory("home", {
    user: directory("user", {
      "readme.txt": file("readme.txt", "text", filesContent.readme),
      notes: directory("notes", {
        "todo.txt": file("todo.txt", "text", filesContent.todo),
        "ideas.txt": file("ideas.txt", "text", filesContent.ideas),
      }),
      messages: directory("messages", {
        "welcome.txt": file("welcome.txt", "text", filesContent.welcome),
      }),
    }),
  }),
  bin: directory("bin", {
    "me.sh": file("me.sh", "program"),
  }),
});
