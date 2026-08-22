import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TopicPicker from './pages/TopicPicker';
import DiagnosticFlow from './pages/DiagnosticFlow';
import Dashboard from './pages/Dashboard';
import ExplainView from './pages/ExplainView';
import QuizFlow from './pages/QuizFlow';

export default function App(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TopicPicker />} />
        <Route path="/diagnostic" element={<DiagnosticFlow />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/explain" element={<ExplainView />} />
        <Route path="/quiz" element={<QuizFlow />} />
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
