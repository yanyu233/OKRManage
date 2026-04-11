import { LoadingOutlined } from '@ant-design/icons';
import { Alert, Card, Space, Spin, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/api/http';
import { authStart, redirectToWecom } from '../../shared/api/auth';

const TEXT = {
  title: '\u6b63\u5728\u8fdb\u5165 OKR \u7cfb\u7edf',
  description: '\u6211\u4eec\u6b63\u5728\u6839\u636e\u5f53\u524d\u73af\u5883\u9009\u62e9\u5408\u9002\u7684\u767b\u5f55\u65b9\u5f0f\uff0c\u8bf7\u7a0d\u5019\u3002',
  errorTitle: '\u8ba4\u8bc1\u5165\u53e3\u4e0d\u53ef\u7528',
  errorDescription: '\u8ba4\u8bc1\u5165\u53e3\u521d\u59cb\u5316\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  loading: '\u6b63\u5728\u68c0\u67e5\u5f53\u524d\u4f1a\u8bdd\u5e76\u51c6\u5907\u767b\u5f55\u5165\u53e3...'
} as const;

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

        const message = error instanceof ApiError ? error.message : TEXT.errorDescription;
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
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {TEXT.description}
            </Typography.Paragraph>
          </div>

          {errorMessage ? (
            <Alert type="error" showIcon message={TEXT.errorTitle} description={errorMessage} />
          ) : (
            <Card size="small" className="auth-hint-card">
              <Space align="center" size={12}>
                <Spin indicator={<LoadingOutlined spin />} />
                <Typography.Text type="secondary">{TEXT.loading}</Typography.Text>
              </Space>
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
}
