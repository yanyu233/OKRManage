import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployeeOkr } from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getGoalStatusLabel } from '../../shared/i18n/labels';
import './employee.css';

const YEAR = 2026;
const QUARTER = 1;

export function EmployeeOkrPage() {
  const navigate = useNavigate();
  const okrQuery = useQuery({
    queryKey: ['employee-okr', YEAR, QUARTER],
    queryFn: () =>
      getEmployeeOkr({
        year: YEAR,
        quarter: QUARTER
      })
  });

  const summaryCards = useMemo(
    () =>
      okrQuery.data
        ? [
            ['目标数', okrQuery.data.employee.goalCount],
            ['关键结果数', okrQuery.data.employee.keyResultCount],
            ['已完成关键结果', okrQuery.data.employee.completedKeyResultCount],
            ['证明材料', okrQuery.data.employee.proofCount]
          ]
        : [],
    [okrQuery.data]
  );

  if (okrQuery.isLoading) {
    return <Card className="employee-toolbar-card">正在加载我的 OKR...</Card>;
  }

  if (okrQuery.isError) {
    const message = okrQuery.error instanceof ApiError ? okrQuery.error.message : '员工 OKR 加载失败。';
    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message="加载失败" description={message} />
      </Card>
    );
  }

  const payload = okrQuery.data!;

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              我的 OKR
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {payload.employee.name} · {payload.employee.sectionName ?? '未分配科室'} · {payload.employee.reviewGroupName ?? '未分配评价组'} ·{' '}
              {formatQuarterLabel(payload.year, payload.quarter)}
            </Typography.Paragraph>
          </div>
          <Space>
            <Tag color="blue">{formatQuarterLabel(payload.year, payload.quarter)}</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => okrQuery.refetch()}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      <div className="employee-summary-grid">
        {summaryCards.map(([title, value]) => (
          <Card key={title} className="employee-summary-card" variant="borderless">
            <Statistic title={title} value={value as number} />
          </Card>
        ))}
        <Card className="employee-summary-card" variant="borderless">
          <Statistic title="当前季度得分" value={formatNullableScore(payload.employee.quarterScore)} />
        </Card>
      </div>

      <Card className="employee-detail-card" variant="borderless">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div className="page-hero">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 6 }}>
                本季度目标
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                进入目标详情后可以维护关键结果完成状态并上传证明材料。
              </Typography.Paragraph>
            </div>
          </div>

          {payload.goals.length ? (
            <Row gutter={[20, 20]}>
              {payload.goals.map((goal) => (
                <Col xs={24} xl={12} key={goal.id}>
                  <Card className="employee-goal-card" variant="borderless" onClick={() => navigate(`/employee/goal/${goal.id}`)}>
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div className="employee-goal-row">
                        <div>
                          <Typography.Title level={4} style={{ marginBottom: 8 }}>
                            {goal.code} {goal.name}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            {goal.description ?? '暂无目标说明'}
                          </Typography.Paragraph>
                        </div>
                        <Tag color={goal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(goal.status)}</Tag>
                      </div>

                      <Space wrap size={[8, 8]}>
                        <Tag>{goal.totalPoints} 分</Tag>
                        <Tag>{goal.keyResultCount} 条关键结果</Tag>
                        <Tag>{goal.completedKeyResultCount} 条已完成</Tag>
                        <Tag>{goal.proofCount} 份材料</Tag>
                        <Tag>当前得分 {formatNullableScore(goal.currentScore)}</Tag>
                      </Space>

                      <Button type="link" style={{ paddingInline: 0 }} icon={<ArrowRightOutlined />}>
                        查看目标详情
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前季度暂无目标" />
          )}
        </Space>
      </Card>
    </Space>
  );
}
