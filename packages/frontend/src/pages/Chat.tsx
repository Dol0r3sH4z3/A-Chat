import { useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import type { SavedMessage } from "@/types/messages.ts";

import Banner from "@/components/Banner.tsx";
import Message from "@/components/ChatMessage.tsx";
import { MediaViewer } from "@/components/FileViewer.tsx";
import MessageInput from "@/components/MessageInput.tsx";
import { useChatSessionStore } from "@/stores/chatSession.ts";
import { sendMessage } from "@/utils/messageHandlers.ts";

import ChatStatusBar from "../components/ChatStatusBar.tsx";
import Header from "../components/Header.tsx";
import { useIdentityStore } from "../stores/identity.ts";

export default function Chat() {
  const { currentChatNickname, messagesHistory } = useIdentityStore();
  const status = useChatSessionStore((s) => s.statusByNickname[currentChatNickname] ?? "idle");

  const currentMessages = messagesHistory[currentChatNickname] ?? [];
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);

  const myOwnMessageRef = useRef(false);

  return (
    <div className="chat flex flex-col h-screen w-screen">
      <div className="shrink-0">
        <Header />
      </div>

      <div className="flex-1 p-2 min-h-0">
        <Virtuoso<SavedMessage>
          alignToBottom
          atBottomStateChange={(atBottom) => {
            isAtBottomRef.current = atBottom;
          }}
          atBottomThreshold={100}
          components={{ Header: Banner }}
          computeItemKey={(_index, item) => item.id}
          data={currentMessages}
          followOutput={false}
          itemContent={(_index, item) => (item.type === "text" ? <Message {...item} /> : <MediaViewer key={item.id} media={item} />)}
          key={currentChatNickname}
          ref={virtuosoRef}
          style={{ height: "100%" }}
          totalListHeightChanged={() => {
            if (isAtBottomRef.current || myOwnMessageRef.current) {
              setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                  behavior: "smooth",
                  index: "LAST",
                });
                myOwnMessageRef.current = false;
              }, 30);
            }
          }}
        />
      </div>

      <div className="shrink-0">
        <ChatStatusBar status={status}>
          <MessageInput
            currentNickname={currentChatNickname}
            onSendMessage={(event) => {
              myOwnMessageRef.current = true;
              isAtBottomRef.current = true;

              sendMessage(currentChatNickname, event).catch(console.error);
            }}
          />
        </ChatStatusBar>
      </div>
    </div>
  );
}
