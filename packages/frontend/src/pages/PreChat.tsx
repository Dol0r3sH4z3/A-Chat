import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { socketClient } from "@/services/socketClient.ts";
import { useIdentityStore } from "@/stores/identity.ts";
import { useTerminal } from "@/stores/terminal.ts";
import { delayedSystemLog, type LogOptions, systemLog } from "@/utils/logger.ts";
import { validateNickname } from "@/utils/utilities.ts";

import { Terminal } from "./Terminal.tsx";

export default function PreChat() {
  const navigate = useNavigate();
  const { chatTerminalId } = useIdentityStore((s) => s.terminalSessionIds);
  const { clearTerminal, promptUser, setBlockInput } = useTerminal();
  const { setCurrentChat, setMyNickname } = useIdentityStore();

  useEffect(() => {
    const log = (text: string, options?: LogOptions) => {
      systemLog(text, { sessionId: chatTerminalId, ...options });
    };
    const delayLog = async (text: string, delayMs?: number) => {
      await delayedSystemLog(text, { delayMs, sessionId: chatTerminalId });
    };
    const ask = (text: string) => promptUser(text, chatTerminalId);

    const handleAuthAndRedirect = async () => {
      try {
        await socketClient.connect();

        setBlockInput(true, chatTerminalId);

        const isAuthorized = await socketClient.authorize();

        if (!isAuthorized) {
          log("Ошибка авторизации.", { status: "error" });
          setBlockInput(false, chatTerminalId);
          return;
        }

        await delayLog("\n", 2000);
        await navigate("/select-chat");
      } catch (error) {
        const parsedError = error instanceof Error ? error.message : String(error);
        console.log(parsedError);
        log("Ошибка авторизации: " + parsedError, { status: "error" });
        setBlockInput(false);
      }
    };

    async function askForNickname(): Promise<string> {
      for (;;) {
        const rawNickname = await ask("Введите никнейм: ");
        const validated = validateNickname(rawNickname, log);
        if (validated !== null) return validated;
      }
    }

    async function init() {
      const { isAuthorized, isConnected } = useIdentityStore.getState();
      if (isAuthorized && isConnected) {
        await navigate("/select-chat");
      }

      clearTerminal(chatTerminalId);

      await delayLog("\n", 2000);
      await delayLog("Введите ваш никнейм (Новые имена регистрируются автоматически).", 500);
      log("Никнейм нельзя будет изменить.", { status: "warning" });
      log("\n");

      const nickname = await askForNickname();
      setMyNickname(nickname);
      await handleAuthAndRedirect();
    }
    init().catch(console.error);
  }, [clearTerminal, promptUser, setMyNickname, navigate, setBlockInput, chatTerminalId, setCurrentChat]);

  return (
    <div className="start-chat flex flex-col">
      <div className="terminal fixed top-0 left-0 right-0 bottom-0 w-screen flex flex-col items-start">
        <Terminal sessionId={chatTerminalId} />
      </div>
    </div>
  );
}
