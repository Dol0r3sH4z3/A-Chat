import type { ReactNode } from "react";

import type { KeyExchangeStatus } from "@/types/crypto.ts";

interface ChatStatusBarProps {
  readonly children: ReactNode;
  readonly status: KeyExchangeStatus;
}

export default function ChatStatusBar({ children, status }: ChatStatusBarProps) {
  const baseClassName = "w-full p-3 text-body text-center border-t border-surface-main";
  switch (status) {
    case "error": {
      return <div className={baseClassName}>Возникла ошибка.</div>;
    }
    case "exchanging": {
      return <div className={baseClassName}>Обмен ключами шифрования...</div>;
    }
    case "idle":
    case "ready": {
      return <div>{children}</div>;
    }
  }
}
