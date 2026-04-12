import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Avatar, Button, Dropdown, Layout, Menu, Skeleton, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, logout, switchActiveRole } from '../../shared/api/auth';
import { formatAssignedRoleSummary, getRoleLabel } from '../../shared/i18n/labels';
import { useSessionStore } from '../../shared/store/session-store';
import { canAccessRoute, menuItemsForUser, resolveTargetRoleForPath, selectedMenuKeyForPath } from './routing';

const { Header, Sider, Content } = Layout;

export function AppShell() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((state) => state.setUser);
  const siderCollapsed = useSessionStore((state) => state.siderCollapsed);
  const toggleSider = useSessionStore((state) => state.toggleSider);

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getCurrentSession
  });

  useEffect(() => {
    setUser(sessionQuery.data?.authenticated ? sessionQuery.data.user : null);
  }, [sessionQuery.data, setUser]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      setUser(null);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate('/auth/entry', { replace: true });
    },
    onError: () => {
      message.error('\u9000\u51fa\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    }
  });

  const activeRoleMutation = useMutation({
    mutationFn: switchActiveRole,
    onSuccess: (payload) => {
      setUser(payload.user);
      queryClient.setQueryData(['session'], {
        authenticated: true,
        user: payload.user
      });
    },
    onError: () => {
      message.error('\u5207\u6362\u89d2\u8272\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5');
    }
  });

  const currentUser = sessionQuery.data?.authenticated ? sessionQuery.data.user : null;
  const requiredRole = currentUser ? resolveTargetRoleForPath(currentUser, location.pathname) : null;
  const needsRoleAlignment = Boolean(currentUser && requiredRole && requiredRole !== currentUser.activeRole);

  useEffect(() => {
    if (!currentUser || !requiredRole || requiredRole === currentUser.activeRole || activeRoleMutation.isPending) {
      return;
    }

    if (!canAccessRoute(currentUser, [requiredRole])) {
      return;
    }

    activeRoleMutation.mutate(requiredRole);
  }, [activeRoleMutation, currentUser, requiredRole]);

  const menuItems = useMemo(() => (currentUser ? menuItemsForUser(currentUser) : []), [currentUser]);
  const assignedRoleSummary = useMemo(() => {
    if (!currentUser) {
      return '';
    }

    return formatAssignedRoleSummary(currentUser.roles.map((item) => item.role));
  }, [currentUser]);

  if (sessionQuery.isLoading) {
    return (
      <div className="shell-loading">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!currentUser) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth/entry?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  const authedUser = currentUser;

  const menu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '\u9000\u51fa\u767b\u5f55',
        onClick: () => logoutMutation.mutate()
      }
    ]
  };

  async function handleMenuClick(path: string) {
    const targetRole = resolveTargetRoleForPath(authedUser, path);

    if (targetRole && targetRole !== authedUser.activeRole) {
      const payload = await activeRoleMutation.mutateAsync(targetRole);
      navigate(path, {
        replace: location.pathname === path && payload.user.activeRole === targetRole
      });
      return;
    }

    navigate(path);
  }

  return (
    <Layout className="app-shell">
      <Sider
        breakpoint="lg"
        collapsedWidth={88}
        width={248}
        collapsed={siderCollapsed}
        onBreakpoint={(broken) => useSessionStore.getState().setSiderCollapsed(broken)}
        className="app-shell__sider"
      >
        <div className="app-shell__brand">
          <Typography.Title level={4} style={{ color: '#eff6ff', margin: 0 }}>
            {siderCollapsed ? 'OKR' : 'OKR \u7cfb\u7edf'}
          </Typography.Title>
          {!siderCollapsed ? (
            <Typography.Text className="app-shell__brand-subtitle">Route C / React \u524d\u53f0</Typography.Text>
          ) : null}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedMenuKeyForPath(location.pathname)]}
          items={menuItems}
          onClick={(info) => void handleMenuClick(String(info.key))}
        />
      </Sider>

      <Layout>
        <Header className="app-shell__header">
          <Space align="center" size={16}>
            <Button
              type="text"
              size="large"
              icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSider}
            />
            <div className="app-shell__identity">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {currentUser.name}
              </Typography.Title>
              <Typography.Text type="secondary">
                {'\u5f53\u524d\u89d2\u8272\uff1a'}
                {assignedRoleSummary}
              </Typography.Text>
            </div>
          </Space>

          <Space align="center" size={16}>
            <Tag color="blue">{assignedRoleSummary || getRoleLabel(currentUser.activeRole)}</Tag>
            <Dropdown menu={menu} trigger={['click']}>
              <Button type="text" size="large">
                <Space>
                  <Avatar icon={<UserOutlined />} />
                  <Typography.Text>{currentUser.loginName}</Typography.Text>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-shell__content">
          {needsRoleAlignment || activeRoleMutation.isPending ? (
            <div className="shell-loading">
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          ) : (
            <Outlet />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
