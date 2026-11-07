import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button/Button";
import { FullPageMessage } from "../features/workspace/FullPageMessage";

export function ProtectedRoute() {
  const { isAuthenticated, profile, profileError, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Signed in to Cognito, but the API does not know this account, or it is
  // disabled: nothing inside would work.
  if (profileError && !profile) {
    return (
      <FullPageMessage
        title="Your account can't use Rivo yet"
        message={`${profileError}. Ask an administrator of this installation to check your account.`}
        action={<Button size="sm" variant="secondary" onClick={logout}>Sign out</Button>}
      />
    );
  }

  return <Outlet />;
}
