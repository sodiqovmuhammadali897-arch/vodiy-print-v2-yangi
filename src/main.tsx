import { applyMotion } from "./lib/motion";
import { startCountUps } from "./lib/countUpDom";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TransitionRouter from "./components/layout/TransitionRouter";
import ConfigError from "./components/ui/ConfigError";
import { isFirebaseConfigured } from "./lib/firebase";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { registerServiceWorker } from "./lib/push";
import "./index.css";

// Keeps the app's code on the device (and shows push notifications) — see
// public/sw.js. Not in development, where files change all the time.
if (import.meta.env.PROD) void registerServiceWorker();

// Animations follow the person's choice (Sozlamalar), not Windows' switch.
applyMotion();
// Big numbers on every panel count up (lib/countUpDom.ts).
startCountUps();
const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!isFirebaseConfigured) {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <ConfigError />
      </ThemeProvider>
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <TransitionRouter>
            <App />
          </TransitionRouter>
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}
