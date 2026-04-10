import { Card, Col, Row, Space, Typography } from 'antd';

export function EmployeeOkrPlaceholder() {
  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2}>My OKR</Typography.Title>
        <Typography.Paragraph type="secondary">
          The employee experience will be migrated in C3. The current Route C shell already provides authenticated access, menu routing, and layout.
        </Typography.Paragraph>
      </div>
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={8}>
          <Card className="feature-card" title="Planned list view">
            <Typography.Paragraph>Quarter filter and OKR list</Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="feature-card" title="Planned detail view">
            <Typography.Paragraph>KR workspace, completion toggles, and material upload</Typography.Paragraph>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="feature-card" title="Account experience">
            <Typography.Paragraph>Session restore, role routing, and logout</Typography.Paragraph>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
