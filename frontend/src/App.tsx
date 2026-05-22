import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import NavBar from './components/NavBar';
import DashboardPage from './pages/DashboardPage';
import TaskListPage from './pages/TaskListPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DeveloperListPage from './pages/DeveloperListPage';
import DeveloperProfilePage from './pages/DeveloperProfilePage';
import AllocationPage from './pages/AllocationPage';

function DevRedirect() {
  const { id } = useParams();
  return <Navigate to={`/team/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/team" element={<DeveloperListPage />} />
        <Route path="/team/:id" element={<DeveloperProfilePage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/allocate" element={<AllocationPage />} />
        <Route path="/developers/:id" element={<DevRedirect />} />
        <Route path="/developers" element={<Navigate to="/team" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
