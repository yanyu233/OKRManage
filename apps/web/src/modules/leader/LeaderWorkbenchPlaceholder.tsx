import { Card, Col, Row, Space, Typography } from 'antd';

export function LeaderWorkbenchPlaceholder() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>Scoring Workbench</Typography.Title>
        <Typography.Paragraph type="secondary">
          The leader workbench will be migrated in C2. Authentication, role routing, and layout are already in place.
        </Typography.Paragraph>
      </div>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card className="feature-card" title="Planned migration">
            <Typography.Paragraph>Browse people, goals, and key results</Typography.Paragraph>
            <Typography.Paragraph>Score each key result with immediate persistence</Typography.Paragraph>
            <Typography.Paragraph>Enter the ranking view by review group</Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="feature-card" title="Current state">
            <Typography.Paragraph>The new React shell, routing, and permissions are already wired.</Typography.Paragraph>
            <Typography.Paragraph>The next step is to move the business view itself into this shell.</Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
