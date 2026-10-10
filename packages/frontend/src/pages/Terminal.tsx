import { type SubmitEvent, useEffect, useRef, useState } from "react";

import { TextRenderer } from "@/components/StyledText.tsx";
import { useTerminal } from "@/stores/terminal.ts";
import { systemLog } from "@/utils/logger.ts";

export const Terminal = ({ sessionId }: { sessionId: string }) => {
  const { createSession, handleCommand } = useTerminal();
  const sessions = useTerminal((s) => s.sessions);
  const [inputValue, setInputValue] = useState("");

  const autoScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const session = sessions[sessionId];

  useEffect(() => {
    useTerminal.getState().setCurrentSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (sessionId === "") {
      console.log("EMPTY SESSION ID");
    }
    if (!session) createSession(sessionId);
  }, [sessionId, session, createSession]);

  useEffect(() => {
    autoScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!inputValue.trim()) return;

    handleCommand(inputValue, systemLog, sessionId).catch(console.error);
    setInputValue("");
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const currentPrompt = session?.terminalMode.type === "input" ? (session.terminalMode.prompt ?? "") : "[root@a-chat]~$ ";
  const history = session?.history;

  useEffect(() => {
    if (history?.length === 0) {
      systemLog("Добро пожаловать в терминал A-Chat. Введите /exit чтобы выйти.", {
        sessionId,
        style: "typewriter",
      });
    }
  }, [history, sessionId]);

  return (
    <div className="terminal p-4 w-full">
      {history?.map((log) => (
        <TextRenderer key={log.id} log={log} />
      ))}
      <button className="terminal-input w-full" onClick={handleContainerClick} type="button">
        <form className="flex justify-start gap-1" onSubmit={handleSubmit}>
          <span className="text-small">{currentPrompt}</span>
          <input
            className="text-small"
            onChange={(event) => {
              setInputValue(event.target.value);
            }}
            ref={inputRef}
            type="text"
            value={inputValue}
          />
        </form>
      </button>
      <div ref={autoScrollRef} />
    </div>
  );
};
