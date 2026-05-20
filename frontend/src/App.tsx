import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TaskListPage from './pages/TaskListPage';
import TaskCreatePage from './pages/TaskCreatePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/new" element={<TaskCreatePage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
