import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Avatar, Button, Dropdown, Layout, Menu, Skeleton, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, logout } from '../../shared/api/auth';
import { getRoleLabel } from '../../shared/i18n/labels';
import { useSessionStore } from '../../shared/store/session-store';
import { menuItemsForRole } from './routing';

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
      navigate('/login', { replace: true });
    },
    onError: () => {
      message.error('退出登录失败，请重试。');
    }
  });

  const menuItems = useMemo(
    () => (sessionQuery.data?.authenticated && sessionQuery.data.user ? menuItemsForRole(sessionQuery.data.user.role) : []),
    [sessionQuery.data]
  );

  if (sessionQuery.isLoading) {
    return (
      <div className="shell-loading">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!sessionQuery.data?.authenticated || !sessionQuery.data.user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const currentUser = sessionQuery.data.user;

  const menu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => logoutMutation.mutate()
      }
    ]
  };

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
            {siderCollapsed ? 'OKR' : 'OKR 系统'}
          </Typography.Title>
          {!siderCollapsed ? <Typography.Text className="app-shell__brand-subtitle">Route C / React 前台</Typography.Text> : null}
        </div>

        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={(info) => navigate(info.key)} />
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
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {currentUser.name}
              </Typography.Title>
              <Typography.Text type="secondary">当前角色：{getRoleLabel(currentUser.role)}</Typography.Text>
            </div>
          </Space>

          <Space align="center" size={16}>
            <Tag color="blue">{getRoleLabel(currentUser.role)}</Tag>
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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
