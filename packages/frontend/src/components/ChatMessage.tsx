import type { TextMessage } from "@/types/messages.ts";

export default function Message({ sender, text }: Readonly<TextMessage>) {
  return (
    <div className={`flex my-0.5 ${sender === "You" ? "justify-end" : "justify-start"}`}>
      <div className={`message break-all text-body w-fit py-2 px-4 rounded-3xl ${sender === "Peer" ? "bg-msg-incoming-bg text-msg-incoming-text" : "bg-msg-outgoing-bg text-msg-outgoing-text"}`}>
        <span className="whitespace-pre-wrap">{text}</span>
      </div>
    </div>
  );
}
