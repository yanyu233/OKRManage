import { Spin } from 'antd';
import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../modules/layout/AppShell';
import { RoleRoute } from '../modules/layout/RoleRoute';
import { defaultPathForRole } from '../modules/layout/routing';
import { useSessionStore } from '../shared/store/session-store';

const AdminOrgPage = lazy(async () => ({ default: (await import('../modules/admin/AdminOrgPage')).AdminOrgPage }));
const AuthEntryPage = lazy(async () => ({ default: (await import('../modules/auth/AuthEntryPage')).AuthEntryPage }));
const LoginPage = lazy(async () => ({ default: (await import('../modules/auth/LoginPage')).LoginPage }));
const UnauthorizedPage = lazy(async () => ({ default: (await import('../modules/auth/UnauthorizedPage')).UnauthorizedPage }));
const EmployeeGoalPage = lazy(async () => ({ default: (await import('../modules/employee/EmployeeGoalPage')).EmployeeGoalPage }));
const EmployeeOkrPage = lazy(async () => ({ default: (await import('../modules/employee/EmployeeOkrPage')).EmployeeOkrPage }));
const ProofArchivePage = lazy(async () => ({ default: (await import('../modules/proofs/ProofArchivePage')).ProofArchivePage }));
const LeaderAnnualRankingPage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderAnnualRankingPage')).LeaderAnnualRankingPage
}));
const LeaderKnowledgeBasePage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderKnowledgeBasePage')).LeaderKnowledgeBasePage
}));
const LeaderRankingPage = lazy(async () => ({ default: (await import('../modules/leader/LeaderRankingPage')).LeaderRankingPage }));
const LeaderWorkbenchPage = lazy(async () => ({ default: (await import('../modules/leader/LeaderWorkbenchPage')).LeaderWorkbenchPage }));

function PageFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '40vh' }}>
      <Spin size="large" />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

function HomeRedirect() {
  const user = useSessionStore((state) => state.user);
  if (!user) {
    return <Navigate to="/auth/entry" replace />;
  }

  return <Navigate to={defaultPathForRole(user.activeRole ?? user.role)} replace />;
}

export const router = createBrowserRouter([
  { path: '/auth/entry', element: withSuspense(<AuthEntryPage />) },
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/unauthorized', element: withSuspense(<UnauthorizedPage />) },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'admin/org', element: <RoleRoute allow={['system-admin']}>{withSuspense(<AdminOrgPage />)}</RoleRoute> },
      {
        path: 'leader/workbench',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader']}>{withSuspense(<LeaderWorkbenchPage />)}</RoleRoute>
      },
      {
        path: 'leader/ranking',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader']}>{withSuspense(<LeaderRankingPage />)}</RoleRoute>
      },
      {
        path: 'leader/annual-ranking',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader']}>{withSuspense(<LeaderAnnualRankingPage />)}</RoleRoute>
      },
      {
        path: 'knowledge-base',
        element: <RoleRoute allow={['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<LeaderKnowledgeBasePage />)}</RoleRoute>
      },
      {
        path: 'leader/knowledge-base',
        element: <RoleRoute allow={['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<LeaderKnowledgeBasePage />)}</RoleRoute>
      },
      { path: 'employee/okr', element: <RoleRoute allow={['employee', 'department-head']}>{withSuspense(<EmployeeOkrPage />)}</RoleRoute> },
      {
        path: 'employee/goal/:goalId',
        element: <RoleRoute allow={['employee', 'department-head']}>{withSuspense(<EmployeeGoalPage />)}</RoleRoute>
      },
      {
        path: 'proofs/archive/:proofId',
        element: <RoleRoute allow={['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<ProofArchivePage />)}</RoleRoute>
      }
    ]
  }
]);
