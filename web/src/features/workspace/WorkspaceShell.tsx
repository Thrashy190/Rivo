import { Outlet } from "react-router";
import { AppHeader } from "./AppHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspaceShell() {
  return (
    <div className="h-screen flex flex-col bg-page overflow-hidden">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <WorkspaceSidebar />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
