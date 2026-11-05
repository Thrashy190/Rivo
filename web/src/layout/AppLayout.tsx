import { Outlet } from "react-router";
import { Navbar } from "../features/navbar/Navbar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-page">
      <Navbar />
      <Outlet />
    </div>
  );
}
