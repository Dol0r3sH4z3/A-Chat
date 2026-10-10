import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface ReturnButtonProperties {
  style?: "filled" | "outline";
  text?: string;
  to?: string;
}

export default function ReturnButton({ style = "filled", text = "Назад", to = "/" }: Readonly<ReturnButtonProperties>) {
  return (
    <Link className={`go-back px-4 py-2 flex items-center gap-1 rounded-full ${style === "filled" ? "bg-primary" : "bg-bg-main ring-primary ring-2"}`} key={to} to={to}>
      <ArrowLeft className="w-4 h-4" />
      <div className="text-body text-white">{text}</div>
    </Link>
  );
}
