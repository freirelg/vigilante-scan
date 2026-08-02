import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startWebVitals } from "./lib/perfSignals";
import { initPowerSaver } from "./lib/powerSaver";
import { initPwaUpdates } from "./lib/pwaUpdate";

startWebVitals();
initPowerSaver();
initPwaUpdates();

createRoot(document.getElementById("root")!).render(<App />);
