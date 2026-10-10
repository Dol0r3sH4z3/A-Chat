import { create } from "zustand";

import type { GeneralLog } from "@/types/messages.ts";
import type { TerminalMode, TerminalSession } from "@/types/terminal.ts";
import type { VirtualNode } from "@/types/virtualFs.ts";
import type { SyncLogFunction } from "@/utils/logger.ts";

import { rootFileSystem } from "@/data/virtualFsTree.ts";
import { cryptoManager } from "@/services/cryptoManager.ts";
import { type Command, CommandSchema } from "@/types/commands.ts";
import { buildTreeString, getNodeAtPath, pathToString, removeNodeAtPath, resolvePath } from "@/utils/pathResolver.ts";
import { handleCat, runSecretProgram } from "@/utils/utilities.ts";

interface TerminalState {
  addLog: (item: GeneralLog, sessionId?: string) => void;
  clearTerminal: (sessionId?: string) => void;

  createSession: (sessionId: string) => void;

  currentSessionId: string;

  executeCommand: (command: Command, logFunction: SyncLogFunction, sessionId: string, arguments_: string[]) => Promise<void>;
  fileSystem: VirtualNode;
  handleCommand: (command: string, logFunction: SyncLogFunction, sessionId?: string) => Promise<void>;

  promptUser: (promptText: string, sessionId?: string) => Promise<string>;
  sessions: Record<string, TerminalSession>;

  setBlockInput: (isBlock: boolean, sessionId?: string) => void;
  setCurrentSessionId: (id: string) => void;
  setTerminalMode: (mode: TerminalMode, sessionId: string) => void;
}

function updateSession(state: TerminalState, sessionId: string, updater: (session: TerminalSession) => Partial<TerminalSession>): Pick<TerminalState, "sessions"> {
  const targetSession = state.sessions[sessionId];
  if (!targetSession) {
    console.warn(`Session with id ${sessionId} not found!`);
    return { sessions: state.sessions };
  }

  return {
    sessions: {
      ...state.sessions,
      [sessionId]: { ...targetSession, ...updater(targetSession) },
    },
  };
}

export const useTerminal = create<TerminalState>((set, get) => ({
  addLog: (item, sessionId): void => {
    set((state) => {
      const targetId = sessionId !== undefined && sessionId !== "" ? sessionId : state.currentSessionId;
      return updateSession(state, targetId, (s) => ({
        history: [...s.history, item].slice(-100),
      }));
    });
  },
  clearTerminal: (sessionId): void => {
    set((state) => {
      const targetId = sessionId ?? state.currentSessionId;

      return updateSession(state, targetId, () => ({
        history: [],
      }));
    });
  },
  createSession: (sessionId): void => {
    const currentSession = get().sessions[sessionId];
    if (currentSession) {
      console.log("Session with id: " + sessionId + " exists.");
      return;
    }
    console.log(`SESSION ${sessionId} CREATED.`);
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          blockInput: false,
          currentPath: ["home", "user"],
          history: [],
          terminalMode: { type: "command" },
        },
      },
    }));
  },

  currentSessionId: "",

  //eslint-disable-next-line sonarjs/cognitive-complexity
  executeCommand: async (command, logFunction, sessionId, arguments_): Promise<void> => {
    const { setBlockInput } = get();

    switch (command) {
      case "cat": {
        const session = get().sessions[sessionId];
        if (!session) break;
        handleCat(arguments_, logFunction, sessionId, get().fileSystem, session.currentPath);
        break;
      }
      case "cd": {
        const session = get().sessions[sessionId];
        if (!session) break;

        const target = arguments_[0] ?? "";
        const newSegments = resolvePath(session.currentPath, target || "/home/user");
        const node = getNodeAtPath(get().fileSystem, newSegments);

        if (!node) {
          logFunction(`cd: ${target}: Нет такого файла или каталога.`, { sessionId, status: "error" });
          break;
        }
        if (node.type !== "directory") {
          logFunction(`cd: ${target}: Не является каталогом.`, { sessionId, status: "error" });
          break;
        }

        set((state) => updateSession(state, sessionId, () => ({ currentPath: newSegments })));
        break;
      }

      case "clear": {
        set((state) => updateSession(state, sessionId, () => ({ history: [] })));
        break;
      }
      // eslint-disable-next-line perfectionist/sort-switch-case
      case "bash":
      case "sh": {
        const fileName = arguments_[0];
        if (fileName === undefined) {
          logFunction("Expected file name.", { sessionId, status: "error" });
          return;
        }

        const session = get().sessions[sessionId];
        if (!session) return;

        const segments = resolvePath(session.currentPath, fileName);
        const node = getNodeAtPath(get().fileSystem, segments);

        if (!node) {
          logFunction(`bash: ${fileName}: Нет такого файла или каталога.`, { sessionId, status: "error" });
          return;
        }

        if (node.type === "directory") {
          logFunction(`bash: ${fileName}: Это каталог.`, { sessionId, status: "error" });
          return;
        }

        if (node.fileKind === "text") {
          logFunction("Cannot run text file. Use 'cat' instead.", { sessionId, status: "error" });
          return;
        }

        if (node.name === "me.sh") {
          setBlockInput(true, sessionId);
          await runSecretProgram(logFunction, sessionId);
          setBlockInput(false, sessionId);
          return;
        }

        logFunction(`bash: ${fileName}: Не удалось запустить.`, { sessionId, status: "error" });
        break;
      }
      case "help": {
        logFunction(`Доступные команды:\n
rm <имя файла> - удалить файл.
bash <имя файла> - запустить файл.
ls - вывести содержимое текущей директории.
sh - то же самое, что и bash.
cat <имя файла> - вывести содержимое файла.
wipe - стереть все данные.
help - справка.
pwd - выводит полный путь к текущему каталогу.
tree - выводит структуру всех файлов и директорий.
clear - очищает историю чата.
cd <имя папки> - перейти в папку.`);
        break;
      }
      case "ls": {
        const session = get().sessions[sessionId];
        if (!session) break;

        const node = getNodeAtPath(get().fileSystem, session.currentPath);
        if (node?.type !== "directory") {
          logFunction("ls: не удаётся получить доступ к текущему каталогу.", { sessionId, status: "error" });
          break;
        }

        const names = Object.values(node.children).map((child) => (child.type === "directory" ? `${child.name}/` : child.name));
        logFunction(names.join("  "), { sessionId });
        break;
      }
      case "pwd": {
        const session = get().sessions[sessionId];
        if (!session) break;
        logFunction(pathToString(session.currentPath), { sessionId });
        break;
      }
      case "rm": {
        const session = get().sessions[sessionId];
        if (!session) break;

        set((state) => {
          let newFs = state.fileSystem;
          for (const argument of arguments_) {
            const segments = resolvePath(session.currentPath, argument);
            newFs = removeNodeAtPath(newFs, segments);
          }
          return { fileSystem: newFs };
        });

        break;
      }
      case "tree": {
        logFunction(buildTreeString(get().fileSystem).trimEnd(), { sessionId });
        break;
      }
      case "wipe": {
        await cryptoManager.wipe();
        logFunction("Success.", { sessionId, status: "success", style: "shaking" });
        break;
      }

      default: {
        logFunction("Неизвестная команда.", { sessionId, status: "error" });
      }
    }
  },

  fileSystem: rootFileSystem,

  handleCommand: async (command, logFunction, sessionId): Promise<void> => {
    const { currentSessionId, executeCommand, sessions } = get();
    const targetId = sessionId ?? currentSessionId;
    const currentSession = sessions[targetId];
    if (!currentSession) return;

    if (currentSession.blockInput) return;

    const currentMode = currentSession.terminalMode;
    const currentPrompt = currentMode.type === "input" && currentMode.prompt !== undefined ? currentMode.prompt : ">> ";

    logFunction(currentPrompt + command, { sessionId: targetId });

    if (currentMode.type === "input") {
      currentMode.onResolve(command);
      return;
    }

    const commandArray = command.split(" ");

    const parsedCommand = CommandSchema.safeParse(commandArray[0]);
    if (!parsedCommand.success) {
      logFunction("Неизвестная команда.", { sessionId: targetId, status: "error" });
      return;
    }
    const commandArguments = commandArray.slice(1);

    await executeCommand(parsedCommand.data, logFunction, targetId, commandArguments);
  },

  promptUser: async (promptText, sessionId): Promise<string> => {
    return new Promise((resolve) => {
      set((state) => {
        const targetId = sessionId ?? state.currentSessionId;
        //eslint-disable-next-line sonarjs/no-nested-functions
        return updateSession(state, targetId, () => ({
          terminalMode: {
            onResolve: (input: string): void => {
              set((s) => updateSession(s, targetId, () => ({ terminalMode: { type: "command" } })));
              resolve(input);
            },
            prompt: promptText,
            type: "input",
          },
        }));
      });
    });
  },

  sessions: {},

  setBlockInput: (isBlock, sessionId): void => {
    set((state) => {
      const targetId = sessionId ?? state.currentSessionId;
      const targetSession = state.sessions[targetId];
      if (!targetSession) {
        console.warn("No session found.");
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [targetId]: {
            ...targetSession,
            blockInput: isBlock,
          },
        },
      };
    });
  },

  setCurrentSessionId: (id): void => {
    set({ currentSessionId: id });
  },

  setTerminalMode: (mode, sessionId): void => {
    set((state) => {
      const targetId = sessionId;
      return updateSession(state, targetId, () => ({
        terminalMode: mode,
      }));
    });
  },
}));
