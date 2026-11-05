import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "../context/AuthContext";
import { SnackbarProvider } from "../context/SnackbarContext";
import { SnackbarContainer } from "../components/Snackbar/SnackbarContainer";
import { ProtectedRoute } from "./ProtectedRoute";
import { AuthLayout } from "../layout/AuthLayout";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ConfirmPage } from "../pages/ConfirmPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { CreateProjectPage } from "../pages/CreateProjectPage";
import { CreateSpacePage } from "../pages/CreateSpacePage";
import { CanvasPage } from "../pages/CanvasPage";
import { SpacePage } from "../pages/SpacePage";
import { DeploysPage } from "../pages/DeploysPage";

const Router = () => (
  <BrowserRouter>
    <SnackbarProvider>
      <AuthProvider>
        <SnackbarContainer />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public — auth pages */}
          <Route element={<AuthLayout />}>
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/register"     element={<RegisterPage />} />
            <Route path="/auth/confirm" element={<ConfirmPage />} />
          </Route>

          {/* Protected — require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects"     element={<ProjectsPage />} />
            <Route path="/projects/new" element={<CreateProjectPage />} />
            <Route path="/projects/:id" element={<CanvasPage />} />
            <Route path="/deploys"      element={<DeploysPage />} />
            <Route path="/spaces/new"   element={<CreateSpacePage />} />
            <Route path="/spaces/:id"   element={<SpacePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </SnackbarProvider>
  </BrowserRouter>
);

export default Router;
