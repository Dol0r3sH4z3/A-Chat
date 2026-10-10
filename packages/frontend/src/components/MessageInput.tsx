import { Plus, SendHorizonal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendMediaFile } from "@/utils/messageHandlers.ts";

interface MessageInputProperties {
  readonly currentNickname: string;
  readonly onSendMessage: (message: string) => void;
}

export default function MessageInput({ currentNickname, onSendMessage }: MessageInputProperties) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height = `${textarea.scrollHeight.toString()}px`;
  }, [text]);

  const handleSend = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    onSendMessage(trimmedText);
    setText("");

    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleSend();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) sendMediaFile(file, currentNickname).catch(console.error);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="text-input bg-[#12151A] border border-[#24282C] p-1 px-3 rounded-3xl flex items-end justify-between gap-3 m-2 mt-0">
      <div className="flex items-end gap-3 flex-1 min-w-0">
        <input
          accept="image/*,video/*"
          onChange={(event) => {
            handleFileChange(event);
          }}
          ref={fileInputRef}
          style={{ display: "none" }}
          type="file"
        />

        <button className="h-10 flex items-center justify-center shrink-0" onClick={handlePlusClick} type="button">
          <Plus className="w-6 h-6" />
        </button>

        <textarea
          className="w-full bg-transparent resize-none outline-none py-2 max-h-32 min-h-10 text-text-primary scrollbar-none"
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение..."
          ref={textareaRef}
          rows={1}
          style={{ overflowY: "auto" }}
          value={text}
        />
      </div>

      <button className="h-10 flex items-center justify-center shrink-0" onClick={handleSend} type="button">
        <SendHorizonal className="w-6 h-6" />
      </button>
    </div>
  );
}
