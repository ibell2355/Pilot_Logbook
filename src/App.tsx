import { Navigate, Route, Routes } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { Home } from './pages/Home';
import { LogEditor } from './pages/LogEditor';
import { NewLog } from './pages/NewLog';
import { SavedLogs } from './pages/SavedLogs';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  useTheme();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/logs" element={<SavedLogs />} />
      <Route path="/logs/new" element={<NewLog />} />
      <Route path="/logs/:logId" element={<LogEditor />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
