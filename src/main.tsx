import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ConfigError from "./components/ui/ConfigError";
import { isFirebaseConfigured } from "./lib/firebase";
import { AuthProvider } from "./lib/AuthContext";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!isFirebaseConfigured) {
  root.render(
    <React.StrictMode>
      <ConfigError />
    </React.StrictMode>,
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </React.StrictMode>,
  );
}
