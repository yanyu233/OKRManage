import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { getLeaderRanking } from '../../shared/api/leader';
import { formatQuarterScore, resolveRankingSelection } from './leader-ranking.helpers';
import './leader.css';

const YEAR = 2026;
const QUARTER = 1;

export function LeaderRankingPage() {
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const rankingQuery = useQuery({
    queryKey: ['leader-ranking', YEAR, QUARTER, reviewGroupId, employeeId],
    queryFn: () =>
      getLeaderRanking({
        year: YEAR,
        quarter: QUARTER,
        reviewGroupId,
        employeeId
      })
  });

  useEffect(() => {
    if (!rankingQuery.data) {
      return;
    }

    const nextSelection = resolveRankingSelection(rankingQuery.data, { reviewGroupId, employeeId });
    if (nextSelection.reviewGroupId !== reviewGroupId) {
      setReviewGroupId(nextSelection.reviewGroupId);
    }
    if (nextSelection.employeeId !== employeeId) {
      setEmployeeId(nextSelection.employeeId);
    }
  }, [employeeId, rankingQuery.data, reviewGroupId]);

  if (rankingQuery.isLoading) {
    return <Card className="leader-detail-card">Loading ranking view...</Card>;
  }

  if (rankingQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert type="error" showIcon message="Failed to load ranking view." />
      </Card>
    );
  }

  const payload = rankingQuery.data;
  const selectedEmployee = payload?.selectedEmployee ?? null;

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              Score Ranking
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Review the current ranking for the active review group and inspect score composition employee by employee.
            </Typography.Paragraph>
          </div>
          <Space>
            <Tag color="blue">{YEAR} Q{QUARTER}</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => rankingQuery.refetch()}>
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}>
          <Card className="leader-side-card" variant="borderless" title="Ranking List">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Select
                value={reviewGroupId ?? undefined}
                options={(payload?.reviewGroups ?? []).map((reviewGroup) => ({
                  label: reviewGroup.name,
                  value: reviewGroup.id
                }))}
                placeholder="Select review group"
                onChange={(nextReviewGroupId) => {
                  setReviewGroupId(nextReviewGroupId);
                  setEmployeeId(null);
                }}
              />

              <div className="leader-seat-summary">
                {(payload?.seatSummary ?? []).map((seat) => (
                  <div key={seat.gradeCode} className="leader-seat-chip">
                    <Typography.Text strong>{seat.gradeCode}</Typography.Text>
                    <Typography.Text type="secondary"> {seat.occupiedCount}/{seat.seatCount}</Typography.Text>
                  </div>
                ))}
              </div>

              <div className="leader-ranking-list">
                {(payload?.ranking ?? []).map((entry, index) => (
                  <Card
                    key={entry.employeeId}
                    className={`leader-selectable-card ${entry.employeeId === selectedEmployee?.employeeId ? 'leader-selectable-card--active' : ''}`}
                    onClick={() => setEmployeeId(entry.employeeId)}
                  >
                    <div className="leader-ranking-entry">
                      <div>
                        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                          #{index + 1} {entry.employeeName}
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                          {entry.sectionName ?? 'No section'}
                        </Typography.Paragraph>
                        <Space wrap size={[8, 8]}>
                          <Tag>{entry.goalCount} goals</Tag>
                          <Tag>{entry.keyResultCount} KRs</Tag>
                          <Tag>{entry.scoredKeyResultCount} scored</Tag>
                        </Space>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className={entry.currentGrade ? 'leader-grade-badge' : 'leader-grade-badge leader-grade-badge--empty'}>
                          {entry.currentGrade ?? 'TBD'}
                        </div>
                        <Typography.Title level={2} style={{ margin: '12px 0 4px' }}>
                          {formatQuarterScore(entry.quarterScore)}
                        </Typography.Title>
                        <Typography.Text type="secondary">{entry.status}</Typography.Text>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless">
              <div className="page-hero">
                <div>
                  <Typography.Title level={2} style={{ marginBottom: 8 }}>
                    {selectedEmployee?.employeeName ?? 'No employee selected'}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {selectedEmployee?.sectionName ?? 'No section'} / {selectedEmployee?.reviewGroupName ?? 'No review group'}
                  </Typography.Paragraph>
                </div>
                <div className={selectedEmployee?.currentGrade ? 'leader-grade-badge' : 'leader-grade-badge leader-grade-badge--empty'}>
                  {selectedEmployee?.currentGrade ?? 'TBD'}
                </div>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title="Quarter score" value={selectedEmployee?.quarterScore ?? 0} precision={1} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="Goals" value={selectedEmployee?.goalBreakdown.length ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic
                    title="Scored KRs"
                    value={selectedEmployee?.goalBreakdown.reduce((sum, goal) => sum + goal.scoredKeyResultCount, 0) ?? 0}
                  />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless" title="Goal Score Breakdown">
              {selectedEmployee ? (
                <div className="leader-goal-breakdown">
                  {selectedEmployee.goalBreakdown.map((goal) => (
                    <Card key={goal.goalId} className="leader-goal-breakdown-card" variant="borderless">
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <div className="page-hero">
                          <div>
                            <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                              {goal.goalCode} {goal.goalName}
                            </Typography.Title>
                            <Typography.Text type="secondary">
                              {goal.scoredKeyResultCount}/{goal.keyResultCount} key results scored
                            </Typography.Text>
                          </div>
                          <Tag icon={<BarChartOutlined />}>Goal score {formatQuarterScore(goal.goalScore)}</Tag>
                        </div>

                        <div className="leader-proof-list">
                          {goal.keyResults.map((keyResult) => (
                            <Card key={keyResult.keyResultId} size="small">
                              <div className="leader-proof-row">
                                <div className="leader-proof-meta">
                                  <Typography.Text strong>{keyResult.code} {keyResult.name}</Typography.Text>
                                  <Typography.Text type="secondary">{keyResult.points} pts</Typography.Text>
                                </div>
                                <Typography.Text strong>{formatQuarterScore(keyResult.reviewScore)}</Typography.Text>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </Space>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No ranking detail available" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
