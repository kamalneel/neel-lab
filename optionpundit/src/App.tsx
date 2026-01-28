import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OptionPunditPage } from './pages/OptionPunditPage';
import './index.css';

// Detect if running in subdirectory (production) or root (development)
const basename = import.meta.env.PROD ? '/optionpundit' : '/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* OptionPundit is the main (and only) page - no nested landing page */}
        <Route path="/" element={<OptionPunditPage />} />
        <Route path="*" element={<OptionPunditPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
