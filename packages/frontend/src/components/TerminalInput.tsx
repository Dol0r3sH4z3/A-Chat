import { Check } from "lucide-react";
import { type SubmitEvent, useRef, useState } from "react";

interface TerminalInputProperties {
  onSubmit: (value: string) => void;
  promptText?: string;
}

export default function TerminalInput({ onSubmit, promptText = "> " }: Readonly<TerminalInputProperties>) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!inputValue.trim()) return;

    onSubmit(inputValue);
    setInputValue("");
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <button className="flex items-center gap-2 font-mono text-primary bg-surface-main p-1 px-3 rounded-xl cursor-text text-body" onClick={handleContainerClick} type="button">
      <span className="text-accent select-none">{promptText}</span>

      <form className="flex-1 flex items-center justify-start" onSubmit={handleSubmit}>
        <input
          className="w-full bg-transparent border-none outline-none text-primary font-mono caret-accent"
          onChange={(event) => {
            setInputValue(event.target.value);
          }}
          ref={inputRef}
          type="text"
          value={inputValue}
        />
        <button className="submit-btn p-1 bg-surface-main rounded-sm" type="submit">
          <Check className="w-4 h-4" />
        </button>
      </form>
    </button>
  );
}
