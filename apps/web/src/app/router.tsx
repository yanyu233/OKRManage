import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminOrgPage } from '../modules/admin/AdminOrgPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { UnauthorizedPage } from '../modules/auth/UnauthorizedPage';
import { EmployeeGoalPlaceholder } from '../modules/employee/EmployeeGoalPlaceholder';
import { EmployeeOkrPlaceholder } from '../modules/employee/EmployeeOkrPlaceholder';
import { LeaderRankingPage } from '../modules/leader/LeaderRankingPage';
import { LeaderWorkbenchPage } from '../modules/leader/LeaderWorkbenchPage';
import { AppShell } from '../modules/layout/AppShell';
import { RoleRoute } from '../modules/layout/RoleRoute';
import { defaultPathForRole } from '../modules/layout/routing';
import { useSessionStore } from '../shared/store/session-store';

function HomeRedirect() {
  const user = useSessionStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        path: 'admin/org',
        element: (
          <RoleRoute allow={['system-admin']}>
            <AdminOrgPage />
          </RoleRoute>
        )
      },
      {
        path: 'leader/workbench',
        element: (
          <RoleRoute allow={['section-leader', 'group-leader']}>
            <LeaderWorkbenchPage />
          </RoleRoute>
        )
      },
      {
        path: 'leader/ranking',
        element: (
          <RoleRoute allow={['section-leader', 'group-leader']}>
            <LeaderRankingPage />
          </RoleRoute>
        )
      },
      {
        path: 'employee/okr',
        element: (
          <RoleRoute allow={['employee']}>
            <EmployeeOkrPlaceholder />
          </RoleRoute>
        )
      },
      {
        path: 'employee/goal/:goalId',
        element: (
          <RoleRoute allow={['employee']}>
            <EmployeeGoalPlaceholder />
          </RoleRoute>
        )
      }
    ]
  }
]);
