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
          title="This role cannot access the page"
          subTitle="The account is signed in, but the current role is not allowed to open this module."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Back to home
            </Button>
          }
        />
      </Card>
    </div>
  );
}
