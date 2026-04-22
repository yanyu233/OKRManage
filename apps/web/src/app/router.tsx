import { Spin } from 'antd';
import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../modules/layout/AppShell';
import { RoleRoute } from '../modules/layout/RoleRoute';
import { defaultPathForRole } from '../modules/layout/routing';
import { useSessionStore } from '../shared/store/session-store';

const AdminOrgPage = lazy(async () => ({ default: (await import('../modules/admin/AdminOrgPage')).AdminOrgPage }));
const AdminHistoricalPerformancePage = lazy(async () => ({
  default: (await import('../modules/admin/AdminHistoricalPerformancePage')).AdminHistoricalPerformancePage
}));
const AuthEntryPage = lazy(async () => ({ default: (await import('../modules/auth/AuthEntryPage')).AuthEntryPage }));
const LoginPage = lazy(async () => ({ default: (await import('../modules/auth/LoginPage')).LoginPage }));
const UnauthorizedPage = lazy(async () => ({ default: (await import('../modules/auth/UnauthorizedPage')).UnauthorizedPage }));
const AllOkrPage = lazy(async () => ({ default: (await import('../modules/overview/AllOkrPage')).AllOkrPage }));
const EmployeeGoalPage = lazy(async () => ({ default: (await import('../modules/employee/EmployeeGoalPage')).EmployeeGoalPage }));
const EmployeeOkrPage = lazy(async () => ({ default: (await import('../modules/employee/EmployeeOkrPage')).EmployeeOkrPage }));
const ProofArchivePage = lazy(async () => ({ default: (await import('../modules/proofs/ProofArchivePage')).ProofArchivePage }));
const KnowledgeAssetArchivePage = lazy(async () => ({
  default: (await import('../modules/leader/KnowledgeAssetArchivePage')).KnowledgeAssetArchivePage
}));
const LeaderAnnualRankingPage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderAnnualRankingPage')).LeaderAnnualRankingPage
}));
const LeaderKnowledgeBasePage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderKnowledgeBasePage')).LeaderKnowledgeBasePage
}));
const LeaderRankingPage = lazy(async () => ({ default: (await import('../modules/leader/LeaderRankingPage')).LeaderRankingPage }));
const LeaderObjectiveWorkbenchPage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderWorkbenchPage')).LeaderObjectiveWorkbenchPage
}));
const LeaderSubjectiveWorkbenchPage = lazy(async () => ({
  default: (await import('../modules/leader/LeaderWorkbenchPage')).LeaderSubjectiveWorkbenchPage
}));

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

function LeaderWorkbenchRedirect() {
  const user = useSessionStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login?returnTo=%2Fleader%2Fworkbench" replace />;
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
      {
        path: 'okr/all',
        element: (
          <RoleRoute allow={['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin']}>
            {withSuspense(<AllOkrPage />)}
          </RoleRoute>
        )
      },
      { path: 'admin/org', element: <RoleRoute allow={['system-admin']}>{withSuspense(<AdminOrgPage />)}</RoleRoute> },
      {
        path: 'admin/historical-performance',
        element: <RoleRoute allow={['system-admin']}>{withSuspense(<AdminHistoricalPerformancePage />)}</RoleRoute>
      },
      {
        path: 'leader/workbench',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader']}>{<LeaderWorkbenchRedirect />}</RoleRoute>
      },
      {
        path: 'leader/workbench/objective',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader']}>{withSuspense(<LeaderObjectiveWorkbenchPage />)}</RoleRoute>
      },
      {
        path: 'leader/workbench/subjective',
        element: <RoleRoute allow={['section-leader']}>{withSuspense(<LeaderSubjectiveWorkbenchPage />)}</RoleRoute>
      },
      {
        path: 'leader/ranking',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<LeaderRankingPage />)}</RoleRoute>
      },
      {
        path: 'leader/annual-ranking',
        element: <RoleRoute allow={['department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<LeaderAnnualRankingPage />)}</RoleRoute>
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
      },
      {
        path: 'knowledge-base/archive/:assetId',
        element: <RoleRoute allow={['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin']}>{withSuspense(<KnowledgeAssetArchivePage />)}</RoleRoute>
      }
    ]
  }
]);
