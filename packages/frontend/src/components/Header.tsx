import { AnimatePresence, motion } from "framer-motion";
import { Lock, Menu, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { useIdentityStore } from "../stores/identity.ts";
import ReturnButton from "./ReturnButton.tsx";

export default function Header() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { currentChatNickname, isAuthorized, isConnected, setCurrentChat } = useIdentityStore();
  const nicknames = useIdentityStore((s) => s.storedNicknames);

  const handleChatChange = (nickname: string) => {
    setIsOpen(false);
    setCurrentChat(nickname);
  };
  return (
    <header className="flex items-center justify-between p-2 px-4">
      <button
        className="burger-menu h-5 w-5"
        onClick={() => {
          setIsOpen(true);
        }}
        type="button"
      >
        <Menu className="w-full h-full text-primary" />
      </button>
      <div className="flex flex-col items-center">
        <div className="logo text-body">A_CHAT // NODE_01</div>
        <div className={`status ${isConnected && isAuthorized ? "text-success" : "text-error"}`}>
          {isConnected && isAuthorized ? (
            <div className="flex items-center gap-1">
              <div className="bg-success w-1 h-1 rounded-full"></div>
              <div className="text-small">ПОДКЛЮЧЕНО</div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="bg-error w-1 h-1 rounded-full"></div>
              <div className="text-small">ОФФЛАЙН</div>
            </div>
          )}
        </div>
      </div>
      <Lock className="w-5 h-5 text-primary" />
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="header-modal fixed w-screen h-screen bg-bg-main top-0 right-0 p-5 flex flex-col gap-8 z-50"
              exit={{ opacity: 0, x: "-100%" }}
              initial={{ opacity: 0, x: "-100%" }}
              transition={{
                damping: 50,
                duration: 0.25,
                stiffness: 400,
                type: "spring",
              }}
            >
              <button
                onClick={() => {
                  setIsOpen(false);
                }}
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-h1 font-bold">Выбор чата {"-|"}</div>
              <div className="rooms flex flex-col gap-2">
                {nicknames.map((item) => (
                  <button
                    className={`py-2 px-4 rounded-full flex justify-start w-full transition-all ${item === currentChatNickname ? "bg-primary" : "bg-surface-main"}`}
                    key={item}
                    onClick={() => {
                      handleChatChange(item);
                    }}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <ReturnButton style="outline" text="В главное меню" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </header>
  );
}
