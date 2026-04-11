import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminOrgPage } from '../modules/admin/AdminOrgPage';
import { AuthEntryPage } from '../modules/auth/AuthEntryPage';
import { LoginPage } from '../modules/auth/LoginPage';
import { UnauthorizedPage } from '../modules/auth/UnauthorizedPage';
import { EmployeeGoalPage } from '../modules/employee/EmployeeGoalPage';
import { EmployeeOkrPage } from '../modules/employee/EmployeeOkrPage';
import { LeaderRankingPage } from '../modules/leader/LeaderRankingPage';
import { LeaderWorkbenchPage } from '../modules/leader/LeaderWorkbenchPage';
import { AppShell } from '../modules/layout/AppShell';
import { RoleRoute } from '../modules/layout/RoleRoute';
import { defaultPathForRole } from '../modules/layout/routing';
import { useSessionStore } from '../shared/store/session-store';

function HomeRedirect() {
  const user = useSessionStore((state) => state.user);
  if (!user) {
    return <Navigate to="/auth/entry" replace />;
  }

  return <Navigate to={defaultPathForRole(user.activeRole ?? user.role)} replace />;
}

export const router = createBrowserRouter([
  { path: '/auth/entry', element: <AuthEntryPage /> },
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
            <EmployeeOkrPage />
          </RoleRoute>
        )
      },
      {
        path: 'employee/goal/:goalId',
        element: (
          <RoleRoute allow={['employee']}>
            <EmployeeGoalPage />
          </RoleRoute>
        )
      }
    ]
  }
]);
