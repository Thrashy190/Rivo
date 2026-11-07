import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { RivoLogo, UsersIcon, LogOutIcon, ChevronDownIcon, PlusIcon } from "../../components/icons";
import { Button } from "../../components/Button/Button";
import { Avatar } from "../../components/Avatar/Avatar";
import { DropdownMenu } from "../../components/DropdownMenu/DropdownMenu";
import { ThemeToggle } from "../../components/ThemeToggle/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { hasPlatformPermission, isPlatformAdmin } from "../../services/users";
import { ROLE_LABELS } from "../../services/workspaces";
import { useOptionalWorkspace } from "./workspaceContext";

function WorkspaceSwitcher() {
  const ctx = useOptionalWorkspace();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!ctx) return null;

  const { workspace, workspaces } = ctx;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-8 px-2.5 rounded-md text-sm text-ink hover:bg-card transition-colors max-w-64"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate font-medium">{workspace.name}</span>
        <span className="text-[10px] text-ink-dim border border-edge rounded px-1.5 py-0.5 shrink-0">
          {ROLE_LABELS[workspace.role]}
        </span>
        <ChevronDownIcon className="w-3.5 h-3.5 text-ink-dim shrink-0" />
      </button>

      {open && (
        <DropdownMenu
          align="left"
          onClose={() => setOpen(false)}
          sections={[
            {
              heading: "Workspaces",
              items: workspaces.map((w) => ({
                label: w.id === workspace.id ? `${w.name}  ✓` : w.name,
                onClick: () => {
                  setOpen(false);
                  navigate(`/workspaces/${w.id}`);
                },
              })),
            },
            {
              items: [
                { label: "All workspaces", onClick: () => navigate("/workspaces") },
                ...(hasPlatformPermission(profile, "workspaces:create")
                  ? [{ label: "New workspace", icon: <PlusIcon className="w-3.5 h-3.5" />, onClick: () => navigate("/workspaces/new") }]
                  : []),
              ],
            },
          ]}
        />
      )}
    </div>
  );
}

export function AppHeader() {
  const navigate = useNavigate();
  const ctx = useOptionalWorkspace();
  const { email, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-13 border-b border-edge/60 flex items-center px-5 gap-3 shrink-0 bg-page">
      <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Rivo home">
        <RivoLogo className="w-7 h-7" />
        <span className="text-sm font-semibold tracking-tight">rivo</span>
      </Link>

      {ctx && <span className="text-ink-dim/50 text-sm">/</span>}
      <WorkspaceSwitcher />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {ctx?.can("members:manage") && (
          <Button variant="secondary" size="sm" onClick={() => navigate(`/workspaces/${ctx.workspace.id}/members`)}>
            <UsersIcon className="w-3.5 h-3.5" />
            Invite members
          </Button>
        )}

        <div className="relative ml-1">
          <Avatar
            initials={email.charAt(0).toUpperCase() || "?"}
            size="sm"
            active={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          />

          {menuOpen && (
            <DropdownMenu
              align="right"
              onClose={() => setMenuOpen(false)}
              header={
                <div>
                  <p className="text-xs font-medium text-ink truncate">{email}</p>
                  {isPlatformAdmin(profile) && (
                    <p className="text-[11px] text-ink-dim">Platform administrator</p>
                  )}
                </div>
              }
              sections={[
                { heading: "Appearance", content: <ThemeToggle /> },
                {
                  items: [
                    {
                      label: "Sign out",
                      icon: <LogOutIcon className="w-3.5 h-3.5" />,
                      variant: "danger",
                      onClick: handleLogout,
                    },
                  ],
                },
              ]}
            />
          )}
        </div>
      </div>
    </header>
  );
}
