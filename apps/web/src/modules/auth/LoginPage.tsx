import { LockOutlined, UserOutlined, WechatOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentSession, manualLogin } from '../../shared/api/auth';
import { ApiError } from '../../shared/api/http';
import { useSessionStore } from '../../shared/store/session-store';
import { defaultPathForRole } from '../layout/routing';

type LoginFormValues = {
  loginName: string;
  password: string;
};

export function LoginPage() {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((state) => state.setUser);
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnTo = search.get('returnTo');
  const reason = search.get('reason');

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getCurrentSession
  });

  const loginMutation = useMutation({
    mutationFn: manualLogin,
    onSuccess: async (payload) => {
      setUser(payload.user);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      if (payload.user) {
        navigate(returnTo || defaultPathForRole(payload.user.role), { replace: true });
      }
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : 'Login failed. Please retry.';
      message.error(description);
    }
  });

  if (sessionQuery.data?.authenticated && sessionQuery.data.user) {
    return <Navigate to={returnTo || defaultPathForRole(sessionQuery.data.user.role)} replace />;
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" variant="borderless">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              OKR Sign In
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Enterprise WeCom login remains the primary entrance. This page exists for unmapped users and local development fallback only.
            </Typography.Paragraph>
          </div>

          {reason === 'unmapped' ? (
            <Alert
              type="warning"
              showIcon
              message="WeCom user is not mapped"
              description="Use a locally assigned fallback account, or ask a system administrator to finish the WeCom to user mapping."
            />
          ) : null}

          <Card size="small" className="auth-hint-card">
            <Space align="start">
              <WechatOutlined className="auth-hint-icon" />
              <Typography.Text type="secondary">
                Production users should enter from the WeCom workbench. Local login is kept for controlled fallback and development access.
              </Typography.Text>
            </Space>
          </Card>

          <Form<LoginFormValues> layout="vertical" onFinish={(values) => loginMutation.mutate(values)} disabled={loginMutation.isPending}>
            <Form.Item label="Login name" name="loginName" rules={[{ required: true, message: 'Please enter a login name.' }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder="Enter login name" />
            </Form.Item>

            <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Please enter a password.' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="Enter password" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" loading={loginMutation.isPending} block>
              Sign in
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
