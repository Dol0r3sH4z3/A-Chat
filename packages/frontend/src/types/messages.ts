export interface GeneralLog {
  content: LogContent;
  id: string;
  status: LogStatus;
}

export type LogStatus = "custom" | "default" | "error" | "note" | "success" | "warning";
export type LogStyle = "default" | "shaking" | "typewriter";

export interface MediaMessage extends SavedMessageBase {
  fileId: string;
  thumbnail: string;
  type: "image" | "video";
}

export type SavedMessage = MediaMessage | TextMessage;

export interface TextMessage extends SavedMessageBase {
  text: string;
  type: "text";
}

type LogContent = { fileName: string; image: Blob; type: "image" } | { prefix?: string; prefixColor?: string; style: LogStyle; text: string; type: "text" };

interface SavedMessageBase {
  id: string;
  sender: "Peer" | "You";
  timestamp: number;
}
