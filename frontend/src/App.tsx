import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sandbox from './pages/Sandbox';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sandbox" element={<Sandbox />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
