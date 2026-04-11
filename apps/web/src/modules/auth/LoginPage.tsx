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
  const isUnmappedFallback = reason === 'unmapped';

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
        navigate(returnTo || defaultPathForRole(payload.user.activeRole), { replace: true });
      }
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : '登录失败，请重试。';
      message.error(description);
    }
  });

  if (sessionQuery.data?.authenticated && sessionQuery.data.user) {
    return <Navigate to={returnTo || defaultPathForRole(sessionQuery.data.user.activeRole)} replace />;
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" variant="borderless">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              {isUnmappedFallback ? '本地兜底登录' : '本地调试登录'}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              企业微信仍然是正式入口，这个页面仅用于企业微信账号未映射时的兜底登录，以及当前本地调试。
            </Typography.Paragraph>
          </div>

          {isUnmappedFallback ? (
            <Alert
              type="warning"
              showIcon
              message="企业微信账号未识别"
              description="请使用系统管理员分配的本地兜底账号登录，或联系系统管理员补齐企业微信账号映射。"
            />
          ) : null}

          <Card size="small" className="auth-hint-card">
            <Space align="start">
              <WechatOutlined className="auth-hint-icon" />
              <Typography.Text type="secondary">
                正式用户请从企业微信工作台进入。这里保留本地账号登录，是为了少量兜底场景和当前开发调试。
              </Typography.Text>
            </Space>
          </Card>

          <Form<LoginFormValues>
            layout="vertical"
            onFinish={(values) => loginMutation.mutate(values)}
            disabled={loginMutation.isPending}
          >
            <Form.Item label="登录名" name="loginName" rules={[{ required: true, message: '请输入登录名。' }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder="请输入登录名" />
            </Form.Item>

            <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码。' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" loading={loginMutation.isPending} block>
              登录
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
