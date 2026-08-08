import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ConfigError from "./components/ui/ConfigError";
import { isFirebaseConfigured } from "./lib/firebase";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/ThemeContext";
import "./index.css";

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
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}
