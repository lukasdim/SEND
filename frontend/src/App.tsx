import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Library from "./pages/Library";
import Sandbox from './pages/Sandbox';
import LecturePage from "./pages/LecturePage";

const UMAMI_SCRIPT_URI = import.meta.env.VITE_UMAMI_ANALYTICS_SCRIPT_URI?.trim() ?? "";
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_ANALYTICS_WEBSITE_ID?.trim() ?? "";
const UMAMI_SCRIPT_SELECTOR = 'script[data-umami-analytics="true"]';

function App() {
  useEffect(() => {
    if (!UMAMI_SCRIPT_URI || !UMAMI_WEBSITE_ID) {
      return;
    }

    const existingScript = document.head.querySelector<HTMLScriptElement>(UMAMI_SCRIPT_SELECTOR);

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.defer = true;
    script.src = UMAMI_SCRIPT_URI;
    script.dataset.websiteId = UMAMI_WEBSITE_ID;
    script.dataset.umamiAnalytics = "true";
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
