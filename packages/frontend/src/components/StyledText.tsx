import { useEffect, useMemo, useState } from "react";

import type { GeneralLog } from "@/types/messages.ts";

export const TypewriterStyledText = ({ className, text }: { className?: string; text: string }) => {
  const [letters, setLetters] = useState<string>("");

  useEffect(() => {
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        const letter = text[index];
        if (letter === undefined) return;

        setLetters((s) => s + letter);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => {
      clearInterval(interval);
    };
  }, [text]);

  return <div className={className}>{letters}</div>;
};

export const ShakingText = ({ className = "text-small", text }: { className?: string; text: string }) => {
  const chars = useMemo(() => text.split(""), [text]);
  const mappedChars = chars.map((item) => ({ id: crypto.randomUUID(), text: item }));

  const speed = 0.1;

  return (
    <div className={`inline-flex flex-wrap ${className}`}>
      {mappedChars.map((char, index) => {
        const delay = (index % 7) * -(speed * 0.3);
        const duration = speed + (index % 5) * (speed * 0.1);

        return (
          <span
            className="inline-block custom-shake-letter select-none"
            key={char.id}
            style={{
              animationDelay: `${delay.toString()}s`,
              animationDuration: `${duration.toString()}s`,
            }}
          >
            {char.text === " " ? "\u{A0}" : char.text}
          </span>
        );
      })}
    </div>
  );
};

export const TextRenderer = ({ className = "text-small", log }: { className?: string; log: GeneralLog }) => {
  if (log.content.type !== "text") return;
  if (log.content.text === "\n") return <br />;

  const content = log.content;
  const text = (content.prefix ?? "") + content.text;

  switch (log.content.style) {
    case "default": {
      return <div className={`text-${log.status} ${className} whitespace-pre-line`}>{log.content.text}</div>;
    }
    case "shaking": {
      return <ShakingText className={`text-${log.status} ${className} whitespace-pre-line`} text={text} />;
    }
    case "typewriter": {
      return <TypewriterStyledText className={`text-${log.status} ${className} whitespace-pre-line`} text={text} />;
    }
  }
};
