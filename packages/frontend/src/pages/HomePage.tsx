import { Link } from "react-router-dom";

interface ButtonEntry {
  label: string;
  path: string;
}

export default function HomePage() {
  const buttons: ButtonEntry[] = [
    { label: "Открыть чат", path: "/pre-chat" },
    { label: "Терминал", path: "/terminal" },
  ];

  return (
    <div className="home-page px-4 py-8 flex flex-col gap-8 w-full">
      <div className="banner flex flex-col gap-3">
        <div className="logo text-6xl font-semibold">A-Chat</div>
        <div className="text-body opacity-60">[частный peer-to-peer чат]</div>
      </div>

      <div className="divider h-px w-full bg-surface-main"></div>

      <div className="buttons flex flex-col gap-2">
        {buttons.map((item) => (
          <Link className="rounded-full flex justify-start gap-2 items-center" key={item.path} to={item.path}>
            <div className="text-sm">{">"}</div>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
