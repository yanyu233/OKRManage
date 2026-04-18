import { DownloadOutlined, FundOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../shared/api/http';
import { downloadLeaderAnnualRankingPublicNotice, getLeaderAnnualRanking } from '../../shared/api/leader';
import { downloadBlobFile, resolveDownloadFileName } from '../../shared/files/download';
import { YearPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import { buildCurrentAndFutureYearOptions } from '../../shared/ui/toolbar-options';
import {
  ALL_ANNUAL_FILTER_VALUE,
  buildAnnualRankingFilterOptions,
  filterAnnualRankingEntries,
  formatAnnualScore,
  resolveAnnualRankingSelection
} from './leader-annual-ranking.helpers';
import './leader.css';

const START_YEAR = 2026;
const TEXT = {
  title: '年度评分排名',
  description: '查看指定年度内员工四个季度实际得分的汇总排名，缺失季度按 0 分计入年度总分。',
  loading: '正在加载年度评分排名...',
  loadFailed: '年度评分排名加载失败。',
  refresh: '刷新',
  searchPlaceholder: '搜索员工、科室或小组',
  rankingListTitle: '年度排名列表',
  sectionFilter: '按科室筛选',
  groupFilter: '按小组筛选',
  allFilter: '全部',
  noEmployeeSelected: '未选择员工',
  emptyRanking: '当前条件下没有匹配的年度评分排名',
  annualScore: '年度总分',
  sectionFallback: '未分配科室',
  reviewGroupFallback: '未分配小组',
  exportNotice: '生成公示表',
  exportSuccess: '公示表已开始下载。',
  exportFailed: '公示表生成失败。'
} as const;

export function LeaderAnnualRankingPage() {
  const { message } = App.useApp();
  const [year, setYear] = useState(() => Math.max(START_YEAR, new Date().getFullYear()));
  const [keyword, setKeyword] = useState('');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => buildCurrentAndFutureYearOptions(Math.max(START_YEAR, new Date().getFullYear()), 8),
    []
  );

  const annualRankingQuery = useQuery({
    queryKey: ['leader-annual-ranking', year],
    queryFn: () => getLeaderAnnualRanking({ year })
  });

  const payload = annualRankingQuery.data;
  const filterOptions = useMemo(
    () => buildAnnualRankingFilterOptions(payload?.ranking ?? [], sectionId),
    [payload?.ranking, sectionId]
  );
  const filteredRanking = useMemo(
    () =>
      filterAnnualRankingEntries(payload?.ranking ?? [], keyword, {
        sectionId,
        reviewGroupId
      }),
    [keyword, payload?.ranking, reviewGroupId, sectionId]
  );
  const selectedEmployee = useMemo(() => {
    if (!payload) {
      return null;
    }

    if (employeeId) {
      const matched = filteredRanking.find((entry) => entry.employeeId === employeeId);
      if (matched) {
        return matched;
      }
    }

    if (payload.selectedEmployee && filteredRanking.some((entry) => entry.employeeId === payload.selectedEmployee?.employeeId)) {
      return payload.selectedEmployee;
    }

    return filteredRanking[0] ?? null;
  }, [employeeId, filteredRanking, payload]);

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadLeaderAnnualRankingPublicNotice({
        year,
        sectionId,
        reviewGroupId
      }),
    onSuccess: ({ blob, headers }) => {
      downloadBlobFile(
        blob,
        resolveDownloadFileName(headers.get('content-disposition'), `${year}年年度绩效考评结果表.docx`)
      );
      message.success(TEXT.exportSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : TEXT.exportFailed)
  });

  useEffect(() => {
    if (!reviewGroupId) {
      return;
    }

    if (!filterOptions.reviewGroups.some((option) => option.value === reviewGroupId)) {
      setReviewGroupId(null);
    }
  }, [filterOptions.reviewGroups, reviewGroupId]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const nextSelection = resolveAnnualRankingSelection(
      {
        ...payload,
        ranking: filteredRanking,
        selectedEmployee
      },
      { employeeId }
    );

    if (nextSelection.employeeId !== employeeId) {
      setEmployeeId(nextSelection.employeeId);
    }
  }, [employeeId, filteredRanking, payload, selectedEmployee]);

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
            <YearPickerPopover
              year={year}
              yearOptions={yearOptions}
              onChange={(nextYear) => {
                setYear(nextYear);
                setEmployeeId(null);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => annualRankingQuery.refetch()}>
              {TEXT.refresh}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exportMutation.isPending}
              disabled={!filteredRanking.length}
              onClick={() => void exportMutation.mutateAsync()}
            >
              {TEXT.exportNotice}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}>
          <Card className="leader-side-card" variant="borderless" title={TEXT.rankingListTitle}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Typography.Text strong>{TEXT.sectionFilter}</Typography.Text>
                  <Select
                    aria-label={TEXT.sectionFilter}
                    style={{ width: '100%', marginTop: 8 }}
                    value={sectionId ?? ALL_ANNUAL_FILTER_VALUE}
                    options={filterOptions.sections}
                    onChange={(nextSectionId) => {
                      setSectionId(nextSectionId === ALL_ANNUAL_FILTER_VALUE ? null : nextSectionId);
                      setEmployeeId(null);
                    }}
                  />
                </Col>
                <Col span={12}>
                  <Typography.Text strong>{TEXT.groupFilter}</Typography.Text>
                  <Select
                    aria-label={TEXT.groupFilter}
                    style={{ width: '100%', marginTop: 8 }}
                    value={reviewGroupId ?? ALL_ANNUAL_FILTER_VALUE}
                    options={filterOptions.reviewGroups}
                    onChange={(nextReviewGroupId) => {
                      setReviewGroupId(nextReviewGroupId === ALL_ANNUAL_FILTER_VALUE ? null : nextReviewGroupId);
                      setEmployeeId(null);
                    }}
                  />
                </Col>
              </Row>

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
