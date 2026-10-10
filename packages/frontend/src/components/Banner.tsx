import { useIdentityStore } from "@/stores/identity.ts";

export default function Banner() {
  const { currentChatNickname } = useIdentityStore();
  return (
    <div className="flex flex-col gap-2 p-5 border-t border-surface-main">
      <div className="text-white text-body font-semibold text-center">Чат с {currentChatNickname}</div>
    </div>
  );
}
