import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "../context/AuthContext";
import { SnackbarProvider } from "../context/SnackbarContext";
import { SnackbarContainer } from "../components/Snackbar/SnackbarContainer";
import { ProtectedRoute } from "./ProtectedRoute";
import { AuthLayout } from "../layout/AuthLayout";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { HomePage } from "../pages/HomePage";
import { WorkspacesPage } from "../pages/WorkspacesPage";
import { CreateWorkspacePage } from "../pages/CreateWorkspacePage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { MembersPage } from "../pages/MembersPage";
import { CreateProjectPage } from "../pages/CreateProjectPage";
import { CanvasPage } from "../pages/CanvasPage";
import { WorkspaceProvider } from "../features/workspace/WorkspaceProvider";
import { WorkspaceShell } from "../features/workspace/WorkspaceShell";

const Router = () => (
  <BrowserRouter>
    <SnackbarProvider>
      <AuthProvider>
        <SnackbarContainer />
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspaces/new" element={<CreateWorkspacePage />} />

            <Route path="/workspaces/:workspaceId" element={<WorkspaceProvider />}>
              <Route element={<WorkspaceShell />}>
                <Route index element={<ProjectsPage />} />
                <Route path="folders/:folderId" element={<ProjectsPage />} />
                <Route path="members" element={<MembersPage />} />
              </Route>
              <Route path="projects/new" element={<CreateProjectPage />} />
              <Route path="projects/:projectId" element={<CanvasPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </SnackbarProvider>
  </BrowserRouter>
);

export default Router;
