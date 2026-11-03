// Renders one page of the app with mocked data. Change the import below to
// the page you want; mock its data hooks/services in vite.config.mjs.
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import Page from "/home/user/vodiy-print-v2-yangi/src/modules/kpi/KpiPage";
import "/home/user/vodiy-print-v2-yangi/src/index.css";
if (new URLSearchParams(location.search).get("dark")) document.documentElement.classList.add("dark");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <div className="min-h-screen bg-ink-50 p-4 sm:p-6">
      <Page />
    </div>
  </BrowserRouter>,
);
