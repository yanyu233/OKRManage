import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Card, Space, Spin, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api/http';
import { authStart, redirectToWecom } from '../../shared/api/auth';

export function AuthEntryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const search = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnTo = search.get('returnTo');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void authStart(returnTo)
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.action === 'wecom') {
          redirectToWecom(result.redirectTo);
          return;
        }

        navigate(result.redirectTo, { replace: true });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const message = error instanceof ApiError ? error.message : '认证入口初始化失败，请稍后重试。';
        setErrorMessage(message);
      });

    return () => {
      active = false;
    };
  }, [navigate, returnTo]);

  return (
    <div className="auth-page">
      <Card className="auth-card" variant="borderless">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              正在进入 OKR 系统
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              我们正在根据当前环境选择合适的登录方式，请稍候。
            </Typography.Paragraph>
          </div>

          {errorMessage ? (
            <Alert
              type="error"
              showIcon
              message="认证入口不可用"
              description={errorMessage}
            />
          ) : (
            <Card size="small" className="auth-hint-card">
              <Space align="center" size={12}>
                <Spin indicator={<LoadingOutlined spin />} />
                <Typography.Text type="secondary">正在检查当前会话并准备登录入口…</Typography.Text>
              </Space>
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
}
