import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { memo, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { MediaMessage } from "@/types/messages.ts";

import { downloadStorage } from "@/stores/downloadStorage.ts";

const MIME_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",

  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",

  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",

  "text/plain": "txt",

  "video/3gpp": "3gp",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
};

export const MediaViewer = memo(function MediaViewer({ media }: { readonly media: MediaMessage }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className={`overflow-hidden rounded-2xl max-w-72 max-h-48 my-1 flex items-center ${media.sender === "You" ? "ml-auto" : "mr-auto"}`}>
      <button
        className="text-start w-full flex items-center justify-center relative"
        onClick={() => {
          setIsModalOpen(true);
        }}
        type="button"
      >
        <img alt={`preview-${media.id}`} className="w-full h-full object-cover object-center" src={media.thumbnail} />

        {media.type === "video" && (
          <div className="absolute inset-0 m-auto w-10 h-10 bg-black/50 rounded-full flex items-center justify-center pointer-events-none">
            <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white ml-1" />
          </div>
        )}
      </button>

      {isModalOpen && (
        <MediaModal
          media={media}
          onClose={() => {
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
});

function MediaModal({ media, onClose }: { readonly media: MediaMessage; readonly onClose: () => void }) {
  //eslint-disable-next-line @eslint-react/purity
  const modalRoot = document.querySelector("#root-modal")!;
  const fullSource = useMediaData(media.fileId);

  return createPortal(
    <AnimatePresence>
      <motion.div animate={{ opacity: 1 }} className="modal-backdrop fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose} />

      <div className="flex absolute top-2 right-2 z-60 items-center gap-2">
        <motion.button animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} initial={{ opacity: 0, scale: 0.5 }} onClick={onClose} type="button">
          <X size={24} />
        </motion.button>

        {fullSource && (
          <motion.a animate={{ opacity: 1, scale: 1 }} download={`${media.fileId}.${fullSource.extension}`} exit={{ opacity: 0, scale: 0.5 }} href={fullSource.url} initial={{ opacity: 0, scale: 0.5 }}>
            <Download size={24} />
          </motion.a>
        )}
      </div>

      <motion.div animate={{ opacity: 1, scale: 1 }} className="fixed flex items-center justify-center w-screen h-screen top-1/2 left-1/2 -translate-1/2 z-50" exit={{ opacity: 0, scale: 0.25 }} initial={{ opacity: 0, scale: 0.5 }}>
        {fullSource === null ? <img alt={`loading-${media.id}`} className="w-full h-auto object-contain opacity-50" src={media.thumbnail} /> : renderMedia(media, fullSource)}
      </motion.div>
    </AnimatePresence>,
    modalRoot,
  );
}

function useMediaData(fileId: string) {
  const [fileData, setFileData] = useState<null | { extension: string; url: string }>(null);

  useEffect(() => {
    let objectUrl: null | string = null;

    downloadStorage
      .getFileBlob(fileId)
      .then((blob) => {
        if (!blob) return;

        const mimeType = blob.type;
        const extension = MIME_MAP[mimeType] ?? "bin";

        objectUrl = URL.createObjectURL(blob);
        setFileData({ extension, url: objectUrl });
      })
      .catch(console.error);

    return () => {
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  return fileData;
}

const renderMedia = (media: MediaMessage, fullSource: { extension: string; url: string }): ReactNode => {
  if (media.type === "image") {
    return <img alt={`IMAGE: ${media.id}`} className="w-auto max-h-[80vh] object-contain" src={fullSource.url} />;
  }
  return (
    <video
      autoPlay
      className="w-screen h-full object-contain"
      controls
      onError={(event) => {
        const video = event.currentTarget;
        console.error("Video playback error:", video.error?.code, video.error?.message);
      }}
      preload="metadata"
      src={fullSource.url}
    />
  );
};
