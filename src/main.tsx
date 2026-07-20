import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startWebVitals } from "./lib/perfSignals";

startWebVitals();

createRoot(document.getElementById("root")!).render(<App />);
