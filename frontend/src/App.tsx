import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Library from "./pages/Library";
import Sandbox from './pages/Sandbox';
import LecturePage from "./pages/LecturePage";

const UMAMI_SCRIPT_URI = import.meta.env.VITE_UMAMI_ANALYTICS_SCRIPT_URI?.trim() ?? "";
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_ANALYTICS_WEBSITE_ID?.trim() ?? "";
const UMAMI_SCRIPT_SELECTOR = 'script[data-umami-analytics="true"]';
const UMAMI_LOG_PREFIX = "[umami]";

function App() {
  useEffect(() => {
    if (!UMAMI_SCRIPT_URI || !UMAMI_WEBSITE_ID) {
      console.info(`${UMAMI_LOG_PREFIX} analytics disabled: missing script URI or website ID`);
      return;
    }

    const existingScript = document.head.querySelector<HTMLScriptElement>(UMAMI_SCRIPT_SELECTOR);

    if (existingScript) {
      console.info(`${UMAMI_LOG_PREFIX} analytics script already present`);
      return;
    }

    const script = document.createElement("script");
    script.defer = true;
    script.src = UMAMI_SCRIPT_URI;
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    script.dataset.umamiAnalytics = "true";
    script.addEventListener("load", () => {
      console.info(`${UMAMI_LOG_PREFIX} analytics script loaded successfully`, {
        scriptUri: UMAMI_SCRIPT_URI,
        websiteId: UMAMI_WEBSITE_ID,
      });
    });
    script.addEventListener("error", () => {
      console.error(`${UMAMI_LOG_PREFIX} failed to load analytics script`, {
        scriptUri: UMAMI_SCRIPT_URI,
        websiteId: UMAMI_WEBSITE_ID,
      });
    });

    console.info(`${UMAMI_LOG_PREFIX} injecting analytics script`, {
      scriptUri: UMAMI_SCRIPT_URI,
      websiteId: UMAMI_WEBSITE_ID,
    });
    document.head.appendChild(script);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/library" element={<Library />} />
        <Route path="/library/:pathSlug/:categorySlug/:lectureSlug" element={<LecturePage />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
