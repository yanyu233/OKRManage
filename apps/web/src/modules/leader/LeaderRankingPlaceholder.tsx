import { Card, Space, Typography } from 'antd';

export function LeaderRankingPlaceholder() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>Score Ranking</Typography.Title>
        <Typography.Paragraph type="secondary">
          This route is reserved for the migrated leader ranking page. It will show ranking, grade seat occupation, and detailed score composition.
        </Typography.Paragraph>
      </div>
      <Card className="feature-card">
        <Typography.Paragraph>Planned content:</Typography.Paragraph>
        <Typography.Paragraph>1. Real-time ranking for the selected review group</Typography.Paragraph>
        <Typography.Paragraph>2. Fixed-seat occupation for each grade</Typography.Paragraph>
        <Typography.Paragraph>3. Employee score breakdown by goal and key result</Typography.Paragraph>
      </Card>
    </Space>
  );
}
