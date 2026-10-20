import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeSiteAppearance } from "@/hooks/useSiteAppearance";
import AppRecoveryBoundary from "@/components/AppRecoveryBoundary";

initializeSiteAppearance();

createRoot(document.getElementById("root")!).render(<AppRecoveryBoundary><App /></AppRecoveryBoundary>);
