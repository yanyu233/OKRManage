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

const TEXT = {
  titleFallback: '\u672c\u5730\u8c03\u8bd5\u767b\u5f55',
  titleUnmapped: '\u672c\u5730\u515c\u5e95\u767b\u5f55',
  description:
    '\u4f01\u4e1a\u5fae\u4fe1\u4ecd\u7136\u662f\u6b63\u5f0f\u5165\u53e3\uff0c\u8fd9\u4e2a\u9875\u9762\u4ec5\u7528\u4e8e\u4f01\u4e1a\u5fae\u4fe1\u8d26\u53f7\u672a\u6620\u5c04\u65f6\u7684\u515c\u5e95\u767b\u5f55\uff0c\u4ee5\u53ca\u5f53\u524d\u672c\u5730\u8c03\u8bd5\u3002',
  unmappedTitle: '\u4f01\u4e1a\u5fae\u4fe1\u8d26\u53f7\u672a\u8bc6\u522b',
  unmappedDescription:
    '\u8bf7\u4f7f\u7528\u7cfb\u7edf\u7ba1\u7406\u5458\u5206\u914d\u7684\u672c\u5730\u515c\u5e95\u8d26\u53f7\u767b\u5f55\uff0c\u6216\u8054\u7cfb\u7cfb\u7edf\u7ba1\u7406\u5458\u8865\u9f50\u4f01\u4e1a\u5fae\u4fe1\u8d26\u53f7\u6620\u5c04\u3002',
  hint:
    '\u6b63\u5f0f\u7528\u6237\u8bf7\u4ece\u4f01\u4e1a\u5fae\u4fe1\u5de5\u4f5c\u53f0\u8fdb\u5165\u3002\u8fd9\u91cc\u4fdd\u7559\u672c\u5730\u8d26\u53f7\u767b\u5f55\uff0c\u662f\u4e3a\u4e86\u5c11\u91cf\u515c\u5e95\u573a\u666f\u548c\u5f53\u524d\u5f00\u53d1\u8c03\u8bd5\u3002',
  loginName: '\u767b\u5f55\u540d',
  password: '\u5bc6\u7801',
  loginNamePlaceholder: '\u8bf7\u8f93\u5165\u767b\u5f55\u540d',
  passwordPlaceholder: '\u8bf7\u8f93\u5165\u5bc6\u7801',
  loginNameRequired: '\u8bf7\u8f93\u5165\u767b\u5f55\u540d\u3002',
  passwordRequired: '\u8bf7\u8f93\u5165\u5bc6\u7801\u3002',
  submit: '\u767b\u5f55',
  loginFailed: '\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002'
} as const;

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
      const description = error instanceof ApiError ? error.message : TEXT.loginFailed;
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
              {isUnmappedFallback ? TEXT.titleUnmapped : TEXT.titleFallback}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {TEXT.description}
            </Typography.Paragraph>
          </div>

          {isUnmappedFallback ? (
            <Alert type="warning" showIcon message={TEXT.unmappedTitle} description={TEXT.unmappedDescription} />
          ) : null}

          <Card size="small" className="auth-hint-card">
            <Space align="start">
              <WechatOutlined className="auth-hint-icon" />
              <Typography.Text type="secondary">{TEXT.hint}</Typography.Text>
            </Space>
          </Card>

          <Form<LoginFormValues> layout="vertical" onFinish={(values) => loginMutation.mutate(values)} disabled={loginMutation.isPending}>
            <Form.Item label={TEXT.loginName} name="loginName" rules={[{ required: true, message: TEXT.loginNameRequired }]}>
              <Input size="large" prefix={<UserOutlined />} placeholder={TEXT.loginNamePlaceholder} />
            </Form.Item>

            <Form.Item label={TEXT.password} name="password" rules={[{ required: true, message: TEXT.passwordRequired }]}>
              <Input.Password size="large" prefix={<LockOutlined />} placeholder={TEXT.passwordPlaceholder} />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" loading={loginMutation.isPending} block>
              {TEXT.submit}
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
