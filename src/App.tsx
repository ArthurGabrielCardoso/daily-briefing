import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BriefingPage } from '@/pages/BriefingPage';
import { ArchivePage } from '@/pages/ArchivePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BriefingPage />} />
        <Route path="/briefing/:date" element={<BriefingPage />} />
        <Route path="/arquivo" element={<ArchivePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
