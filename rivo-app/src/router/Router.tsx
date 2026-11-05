import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthLayout } from "../layout/AuthLayout";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { CreateProjectPage } from "../pages/CreateProjectPage";
import { CanvasPage } from "../pages/CanvasPage";
import { SpacePage } from "../pages/SpacePage";

const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth — sin navbar */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Projects — layout Miro propio */}
        <Route path="/projects" element={<ProjectsPage />} />

        {/* Crear proyecto — wizard centrado */}
        <Route path="/projects/new" element={<CreateProjectPage />} />

        {/* Canvas — layout propio, pantalla completa */}
        <Route path="/projects/:id" element={<CanvasPage />} />

        {/* Spaces — agrupan proyectos */}
        <Route path="/spaces/:id" element={<SpacePage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
