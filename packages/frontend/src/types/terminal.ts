import type { GeneralLog } from "./messages.ts";

export type TerminalMode = { onResolve: (input: string) => void; prompt?: string; type: "input" } | { type: "command" };

export interface TerminalSession {
  blockInput: boolean;
  currentPath: string[];
  history: GeneralLog[];
  terminalMode: TerminalMode;
}
