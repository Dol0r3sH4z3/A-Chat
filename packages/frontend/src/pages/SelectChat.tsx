import { ChevronLeft, Plus, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Modal from "@/components/Modal.tsx";
import { useIdentityStore } from "@/stores/identity.ts";
import { validateNickname } from "@/utils/utilities.ts";

export default function SelectChat() {
  const nicknames = useIdentityStore((s) => s.storedNicknames);
  const setCurrentChat = useIdentityStore((s) => s.setCurrentChat);
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  const handleNicknameInput = (event: React.SubmitEvent) => {
    event.preventDefault();

    const validatedNickname = validateNickname(nicknameInput);
    if (validatedNickname === null) {
      console.error("Недопустимый никнейм.");
      setIsModalOpen(false);
      setNicknameInput("");
      return;
    }
    if (nicknames.includes(validatedNickname)) {
      console.error("Chat already exists.");
      setIsModalOpen(false);
      setNicknameInput("");
      return;
    }

    setCurrentChat(validatedNickname);
    setNicknameInput("");
    void navigate("/chat");
  };

  return (
    <div className="select-chat flex flex-col w-screen p-4 gap-2">
      <div className="py-2 flex items-center gap-2">
        <ChevronLeft
          onClick={() => {
            void navigate("/");
          }}
        />
        <div className="text-h2 font-semibold">Chats</div>
        <Plus
          className="ml-auto w-6 h-6"
          onClick={() => {
            setIsModalOpen(true);
          }}
        />
      </div>
      {nicknames.length === 0 ? (
        <div>
          <div className="text-body opacity-60">Начните диалог с кем-нибудь...</div>
        </div>
      ) : (
        nicknames.map((item) => (
          <button
            className="nickname-entry py-2 px-4 flex justify-start rounded-2xl bg-surface-main"
            key={item}
            onClick={() => {
              setCurrentChat(item);
              void navigate("/chat");
            }}
            type="button"
          >
            {item}
          </button>
        ))
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
      >
        <form className="min-w-[70vw] flex flex-col gap-4 text-body" onSubmit={handleNicknameInput}>
          <div className="flex items-center justify-between">
            <div className="text-body font-semibold">Введите никнейм собеседника</div>
            <X
              onClick={() => {
                setIsModalOpen(false);
              }}
              size={20}
            />
          </div>
          <input
            className="rename-input py-2 px-4 border border-bg-main bg-surface-main rounded-2xl placeholder:text-body text-body transition-all"
            onChange={(event) => {
              setNicknameInput(event.target.value);
            }}
            placeholder="Введите никнейм..."
            type="text"
            value={nicknameInput}
          />
          <button className="w-full py-2 bg-primary rounded-full text-black" type="submit">
            Начать чат
          </button>
        </form>
      </Modal>
    </div>
  );
}
