import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import PageWrapper from "./components/PageWrapper.tsx";
import Chat from "./pages/Chat.tsx";
import HomePage from "./pages/HomePage.tsx";
import PreChat from "./pages/PreChat.tsx";
import SelectChat from "./pages/SelectChat.tsx";
import { Terminal } from "./pages/Terminal.tsx";
import { initSubscribitions } from "./services/socketService.ts";
import { useIdentityStore } from "./stores/identity.ts";
import { useTerminal } from "./stores/terminal.ts";

export default function App() {
  useEffect(() => {
    const { setCurrentChat, setIsAuthorized, setIsConnected, terminalSessionIds } = useIdentityStore.getState();
    const { createSession } = useTerminal.getState();
    setIsAuthorized(false);
    setIsConnected(false);
    setCurrentChat("");
    initSubscribitions();

    createSession(terminalSessionIds.chatTerminalId);
    createSession(terminalSessionIds.mainTerminalId);
  }, []);

  return (
    <div className="main">
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const terminalSessionIds = useIdentityStore((s) => s.terminalSessionIds);

  return (
    <AnimatePresence mode="wait">
      <Routes key={location.pathname} location={location}>
        <Route
          element={
            <PageWrapper>
              <HomePage />
            </PageWrapper>
          }
          path="/"
        />
        <Route
          element={
            <PageWrapper>
              <SelectChat />
            </PageWrapper>
          }
          path="/select-chat"
        />
        <Route
          element={
            <PageWrapper>
              <PreChat />
            </PageWrapper>
          }
          path="/pre-chat"
        />
        <Route
          element={
            <PageWrapper>
              <Chat />
            </PageWrapper>
          }
          path="/chat"
        />
        <Route
          element={
            <PageWrapper>
              <Terminal sessionId={terminalSessionIds.mainTerminalId} />
            </PageWrapper>
          }
          path="/terminal"
        />
      </Routes>
    </AnimatePresence>
  );
}
