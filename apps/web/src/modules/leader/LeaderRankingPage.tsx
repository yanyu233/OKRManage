import { BarChartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getLeaderRanking } from '../../shared/api/leader';
import { formatQuarterLabel, getLeaderEmployeeStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import { filterRankingEntries, filterRankingGoalBreakdown, formatQuarterScore, resolveRankingSelection } from './leader-ranking.helpers';
import './leader.css';

const START_YEAR = 2026;
const TEXT = {
  title: '\u8bc4\u5206\u6392\u540d',
  description:
    '\u67e5\u770b\u5f53\u524d\u8bc4\u4ef7\u7ec4\u7684\u5b9e\u65f6\u6392\u540d\uff0c\u5e76\u6309\u5173\u952e\u8bcd\u7b5b\u9009\u5458\u5de5\u3001\u76ee\u6807\u4e0e\u5173\u952e\u7ed3\u679c\u660e\u7ec6\u3002',
  loading: '\u6b63\u5728\u52a0\u8f7d\u8bc4\u5206\u6392\u540d...',
  loadFailed: '\u8bc4\u5206\u6392\u540d\u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u5458\u5de5\u3001\u76ee\u6807\u6216\u5173\u952e\u7ed3\u679c',
  rankingListTitle: '\u6392\u540d\u5217\u8868',
  reviewGroupPlaceholder: '\u8bf7\u9009\u62e9\u8bc4\u4ef7\u7ec4',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  reviewGroupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  pendingGrade: '\u5f85\u5b9a',
  noEmployeeSelected: '\u672a\u9009\u62e9\u5458\u5de5',
  goalBreakdownTitle: '\u76ee\u6807\u5206\u6570\u6784\u6210',
  noBreakdown: '\u5f53\u524d\u6ca1\u6709\u53ef\u5c55\u793a\u7684\u8bc4\u5206\u660e\u7ec6',
  emptyRanking: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u6392\u540d',
  quarterScore: '\u5b63\u5ea6\u603b\u5206',
  goalCount: '\u76ee\u6807\u6570',
  scoredKeyResultCount: '\u5df2\u8bc4\u5206\u5173\u952e\u7ed3\u679c',
  goalCountTag: '\u4e2a\u76ee\u6807',
  keyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  scoredTagPrefix: '\u5df2\u8bc4',
  goalScorePrefix: '\u76ee\u6807\u5f97\u5206'
} as const;

export function LeaderRankingPage() {
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: 8
  });
  const [keyword, setKeyword] = useState('');
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const rankingQuery = useQuery({
    queryKey: ['leader-ranking', year, quarter, reviewGroupId, employeeId],
    queryFn: () =>
      getLeaderRanking({
        year,
        quarter,
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

  const payload = rankingQuery.data;
  const selectedEmployee = payload?.selectedEmployee ?? null;
  const filteredRanking = useMemo(() => filterRankingEntries(payload?.ranking ?? [], keyword), [keyword, payload?.ranking]);
  const filteredGoalBreakdown = useMemo(
    () => filterRankingGoalBreakdown(selectedEmployee?.goalBreakdown ?? [], keyword),
    [keyword, selectedEmployee?.goalBreakdown]
  );

  if (rankingQuery.isLoading) {
    return <Card className="leader-detail-card">{TEXT.loading}</Card>;
  }

  if (rankingQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert type="error" showIcon message={TEXT.loadFailed} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {TEXT.description}
            </Typography.Paragraph>
          </div>
          <div className="page-toolbar__controls">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              className="page-toolbar__search"
              placeholder={TEXT.searchPlaceholder}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <YearQuarterPickerPopover
              year={year}
              quarter={quarter}
              yearOptions={yearOptions}
              quarterOptions={quarterOptions}
              onChange={(nextYear, nextQuarter) => {
                setPeriod(nextYear, nextQuarter);
                setReviewGroupId(null);
                setEmployeeId(null);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => rankingQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}>
          <Card className="leader-side-card" variant="borderless" title={TEXT.rankingListTitle}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Select
                value={reviewGroupId ?? undefined}
                options={(payload?.reviewGroups ?? []).map((reviewGroup) => ({
                  label: reviewGroup.name,
                  value: reviewGroup.id
                }))}
                placeholder={TEXT.reviewGroupPlaceholder}
                onChange={(nextReviewGroupId) => {
                  setReviewGroupId(nextReviewGroupId);
                  setEmployeeId(null);
                }}
              />

              <div className="leader-seat-summary">
                {(payload?.seatSummary ?? []).map((seat) => (
                  <div key={seat.gradeCode} className="leader-seat-chip">
                    <Typography.Text strong>{seat.gradeCode}</Typography.Text>
                    <Typography.Text type="secondary">{` ${seat.occupiedCount}/${seat.seatCount}`}</Typography.Text>
                  </div>
                ))}
              </div>

              <div className="leader-ranking-list">
                {filteredRanking.length ? (
                  filteredRanking.map((entry, index) => (
                    <Card
                      key={entry.employeeId}
                      className={`leader-selectable-card ${entry.employeeId === selectedEmployee?.employeeId ? 'leader-selectable-card--active' : ''}`}
                      onClick={() => setEmployeeId(entry.employeeId)}
                    >
                      <div className="leader-ranking-entry">
                        <div>
                          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                            {`#${index + 1} ${entry.employeeName}`}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                            {entry.sectionName ?? TEXT.sectionFallback}
                          </Typography.Paragraph>
                          <Space wrap size={[8, 8]}>
                            <Tag>{`${entry.goalCount} ${TEXT.goalCountTag}`}</Tag>
                            <Tag>{`${entry.keyResultCount} ${TEXT.keyResultCountTag}`}</Tag>
                            <Tag>{`${TEXT.scoredTagPrefix} ${entry.scoredKeyResultCount} \u6761`}</Tag>
                          </Space>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className={entry.currentGrade ? 'leader-grade-badge' : 'leader-grade-badge leader-grade-badge--empty'}>
                            {entry.currentGrade ?? TEXT.pendingGrade}
                          </div>
                          <Typography.Title level={2} style={{ margin: '12px 0 4px' }}>
                            {formatQuarterScore(entry.quarterScore)}
                          </Typography.Title>
                          <Typography.Text type="secondary">{getLeaderEmployeeStatusLabel(entry.status)}</Typography.Text>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyRanking} />
                )}
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
                    {selectedEmployee?.employeeName ?? TEXT.noEmployeeSelected}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {`${selectedEmployee?.sectionName ?? TEXT.sectionFallback} / ${
                      selectedEmployee?.reviewGroupName ?? TEXT.reviewGroupFallback
                    } / ${formatQuarterLabel(year, quarter)}`}
                  </Typography.Paragraph>
                </div>
                <div
                  className={
                    selectedEmployee?.currentGrade ? 'leader-grade-badge' : 'leader-grade-badge leader-grade-badge--empty'
                  }
                >
                  {selectedEmployee?.currentGrade ?? TEXT.pendingGrade}
                </div>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title={TEXT.quarterScore} value={selectedEmployee?.quarterScore ?? 0} precision={1} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.goalCount} value={selectedEmployee?.goalBreakdown.length ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic
                    title={TEXT.scoredKeyResultCount}
                    value={selectedEmployee?.goalBreakdown.reduce((sum, goal) => sum + goal.scoredKeyResultCount, 0) ?? 0}
                  />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless" title={TEXT.goalBreakdownTitle}>
              {selectedEmployee ? (
                filteredGoalBreakdown.length ? (
                  <div className="leader-goal-breakdown">
                    {filteredGoalBreakdown.map((goal) => (
                      <Card key={goal.goalId} className="leader-goal-breakdown-card" variant="borderless">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <div className="page-hero">
                            <div>
                              <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                                {goal.goalCode} {goal.goalName}
                              </Typography.Title>
                              <Typography.Text type="secondary">
                                {`\u5df2\u8bc4\u5206 ${goal.scoredKeyResultCount}/${goal.keyResultCount} ${TEXT.keyResultCountTag}`}
                              </Typography.Text>
                            </div>
                            <Tag icon={<BarChartOutlined />}>{`${TEXT.goalScorePrefix} ${formatQuarterScore(goal.goalScore)}`}</Tag>
                          </div>

                          <div className="leader-proof-list">
                            {goal.keyResults.map((keyResult) => (
                              <Card key={keyResult.keyResultId} size="small">
                                <div className="leader-proof-row">
                                  <div className="leader-proof-meta">
                                    <Typography.Text strong>
                                      {keyResult.code} {keyResult.name}
                                    </Typography.Text>
                                    <Typography.Text type="secondary">{`${keyResult.points} \u5206`}</Typography.Text>
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noBreakdown} />
                )
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noBreakdown} />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
