import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { RivoLogo, UsersIcon, UserIcon, LogOutIcon } from "../../components/icons";
import { Button } from "../../components/Button/Button";
import { Avatar } from "../../components/Avatar/Avatar";
import { DropdownMenu } from "../../components/DropdownMenu/DropdownMenu";
import { ThemeToggle } from "../../components/ThemeToggle/ThemeToggle";

export function ProjectsHeader() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-13 border-b border-edge/60 flex items-center px-5 gap-4 shrink-0 bg-page">
      {/* Brand */}
      <Link to="/projects" className="flex items-center gap-2.5 shrink-0">
        <RivoLogo className="w-7 h-7" />
        <span className="text-sm font-semibold tracking-tight">rivo</span>
      </Link>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm">
          <UsersIcon className="w-3.5 h-3.5" />
          Invite members
        </Button>

        {/* Avatar + dropdown */}
        <div className="relative ml-1">
          <Avatar
            initials="J"
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
                  <p className="text-xs font-medium text-ink">Juan García</p>
                  <p className="text-[11px] text-ink-dim">juan@rivo.dev</p>
                </div>
              }
              sections={[
                {
                  items: [
                    {
                      label: "Profile",
                      icon: <UserIcon className="w-3.5 h-3.5" />,
                      onClick: () => {},
                    },
                  ],
                },
                {
                  heading: "Appearance",
                  content: <ThemeToggle />,
                },
                {
                  items: [
                    {
                      label: "Sign out",
                      icon: <LogOutIcon className="w-3.5 h-3.5" />,
                      variant: "danger",
                      onClick: () => navigate("/login"),
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
