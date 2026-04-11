import { LockOutlined } from '@ant-design/icons';
import { Button, Card, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="status-page">
      <Card className="status-card" variant="borderless">
        <Result
          status="403"
          icon={<LockOutlined />}
          title="当前角色无权访问此页面"
          subTitle="账号已经登录，但当前角色不允许打开这个模块。"
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          }
        />
      </Card>
    </div>
  );
}
