import type { ReactElement } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

interface ModalProps {
  children: ReactElement;
  isOpen: boolean;
  onClose?: () => void;
  padding?: string;
}

export default function Modal({ children, isOpen, onClose, padding = "p-6" }: ModalProps) {
  const modalRoot = document.querySelector("#root-modal")!;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div animate={{ opacity: 1 }} className="modal-backdrop fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} />

          <motion.div animate={{ opacity: 1, scale: 1 }} className={`fixed top-1/2 left-1/2 -translate-1/2 z-50 bg-bg-main rounded-4xl ${padding} border border-surface-main flex flex-col items-center gap-4`} exit={{ opacity: 0, scale: 0.5 }} initial={{ opacity: 0, scale: 0.5 }}>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    modalRoot,
  );
}
