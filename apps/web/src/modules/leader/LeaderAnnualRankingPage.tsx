import { FundOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getLeaderAnnualRanking } from '../../shared/api/leader';
import { buildToolbarYearOptions } from '../../shared/ui/toolbar-options';
import { filterAnnualRankingEntries, formatAnnualScore, resolveAnnualRankingSelection } from './leader-annual-ranking.helpers';
import './leader.css';

const START_YEAR = 2026;
const DEFAULT_YEAR = 2026;
const TEXT = {
  title: '年度评分排名',
  description: '查看指定年度内员工四个季度实际得分的汇总排名，缺失季度按 0 计入年度总分。',
  loading: '正在加载年度评分排名...',
  loadFailed: '年度评分排名加载失败。',
  refresh: '刷新',
  searchPlaceholder: '搜索员工、科室或小组',
  rankingListTitle: '年度排名列表',
  noEmployeeSelected: '未选择员工',
  emptyRanking: '当前条件下没有匹配的年度排名',
  annualScore: '年度总分',
  sectionFallback: '未分配科室',
  reviewGroupFallback: '未分配小组'
} as const;

export function LeaderAnnualRankingPage() {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [keyword, setKeyword] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => buildToolbarYearOptions(START_YEAR, Math.max(START_YEAR, new Date().getFullYear() + 4)),
    []
  );

  const annualRankingQuery = useQuery({
    queryKey: ['leader-annual-ranking', year, employeeId],
    queryFn: () => getLeaderAnnualRanking({ year, employeeId })
  });

  useEffect(() => {
    if (!annualRankingQuery.data) {
      return;
    }

    const nextSelection = resolveAnnualRankingSelection(annualRankingQuery.data, { employeeId });
    if (nextSelection.employeeId !== employeeId) {
      setEmployeeId(nextSelection.employeeId);
    }
  }, [annualRankingQuery.data, employeeId]);

  const payload = annualRankingQuery.data;
  const filteredRanking = useMemo(
    () => filterAnnualRankingEntries(payload?.ranking ?? [], keyword),
    [keyword, payload?.ranking]
  );
  const selectedEmployee = payload?.selectedEmployee ?? null;

  if (annualRankingQuery.isLoading) {
    return <Card className="leader-detail-card">{TEXT.loading}</Card>;
  }

  if (annualRankingQuery.isError) {
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
            <Select
              value={year}
              options={yearOptions}
              onChange={(value) => {
                setYear(value);
                setEmployeeId(null);
              }}
              style={{ minWidth: 140 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => annualRankingQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}>
          <Card className="leader-side-card" variant="borderless" title={TEXT.rankingListTitle}>
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
                          {`${entry.sectionName ?? TEXT.sectionFallback} / ${entry.reviewGroupName ?? TEXT.reviewGroupFallback}`}
                        </Typography.Paragraph>
                        <Space wrap size={[8, 8]}>
                          {entry.quarterScores.map((item) => (
                            <Tag key={`${entry.employeeId}-${item.quarter}`}>{`Q${item.quarter} ${formatAnnualScore(item.score)}`}</Tag>
                          ))}
                        </Space>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Typography.Title level={2} style={{ margin: '12px 0 4px' }}>
                          {formatAnnualScore(entry.annualScore)}
                        </Typography.Title>
                        <Typography.Text type="secondary">{TEXT.annualScore}</Typography.Text>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyRanking} />
              )}
            </div>
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
                    } / ${year} 年度`}
                  </Typography.Paragraph>
                </div>
                <Tag color="blue" icon={<FundOutlined />}>
                  {TEXT.annualScore}
                </Tag>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title={TEXT.annualScore} value={selectedEmployee?.annualScore ?? 0} precision={1} />
                </Card>
                {(selectedEmployee?.quarterScores ?? []).map((item) => (
                  <Card key={`quarter-${item.quarter}`} variant="borderless">
                    <Statistic title={`Q${item.quarter}`} value={item.score} precision={1} />
                  </Card>
                ))}
              </div>
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
