import { Card, Space, Typography } from 'antd';

export function EmployeeGoalPlaceholder() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>Goal Detail</Typography.Title>
        <Typography.Paragraph type="secondary">
          This route will host the employee goal detail and material submission workspace in C3.
        </Typography.Paragraph>
      </div>
      <Card className="feature-card">
        <Typography.Paragraph>Planned content:</Typography.Paragraph>
        <Typography.Paragraph>1. Goal summary and status</Typography.Paragraph>
        <Typography.Paragraph>2. KR material upload and completion confirmation</Typography.Paragraph>
        <Typography.Paragraph>3. Detail-level permission controls</Typography.Paragraph>
      </Card>
    </Space>
  );
}
