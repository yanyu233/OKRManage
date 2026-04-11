import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '../../shared/types/session';
import { useSessionStore } from '../../shared/store/session-store';
import { canAccessRoute } from './routing';

type RoleRouteProps = {
  allow: UserRole[];
  children: ReactElement;
};

export function RoleRoute({ allow, children }: RoleRouteProps) {
  const location = useLocation();
  const user = useSessionStore((state) => state.user);

  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!canAccessRoute(user, allow)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
