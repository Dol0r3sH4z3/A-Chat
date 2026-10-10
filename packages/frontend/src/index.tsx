import { createRoot } from "react-dom/client";

import "./index.css";
import "./styles/main.scss";
//eslint-disable-next-line import-x/no-unresolved
import { registerSW } from "virtual:pwa-register";

import App from "./App.tsx";

registerSW({ immediate: true });

createRoot(document.querySelector("#root")!).render(<App />);
