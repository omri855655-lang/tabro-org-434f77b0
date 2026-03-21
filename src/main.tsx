import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeSiteAppearance } from "@/hooks/useSiteAppearance";

initializeSiteAppearance();

createRoot(document.getElementById("root")!).render(<App />);
