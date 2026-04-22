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
  title: '\u5e74\u5ea6\u8bc4\u5206\u6392\u540d',
  description:
    '\u67e5\u770b\u6307\u5b9a\u5e74\u5ea6\u5185\u5458\u5de5\u56db\u4e2a\u5b63\u5ea6\u5b9e\u9645\u5f97\u5206\u7684\u6c47\u603b\u6392\u540d\uff0c\u7f3a\u5931\u5b63\u5ea6\u6309 0 \u5206\u8ba1\u5165\u5e74\u5ea6\u603b\u5206\u3002',
  loading: '\u6b63\u5728\u52a0\u8f7d\u5e74\u5ea6\u8bc4\u5206\u6392\u540d...',
  loadFailed: '\u5e74\u5ea6\u8bc4\u5206\u6392\u540d\u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u5458\u5de5\u3001\u79d1\u5ba4\u6216\u5c0f\u7ec4',
  rankingListTitle: '\u5e74\u5ea6\u6392\u540d\u5217\u8868',
  sectionFilter: '\u6309\u79d1\u5ba4\u7b5b\u9009',
  groupFilter: '\u6309\u5c0f\u7ec4\u7b5b\u9009',
  allFilter: '\u5168\u90e8',
  noEmployeeSelected: '\u672a\u9009\u62e9\u5458\u5de5',
  emptyRanking: '\u5f53\u524d\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u7684\u5e74\u5ea6\u8bc4\u5206\u6392\u540d',
  annualScore: '\u5e74\u5ea6\u603b\u5206',
  scoresLocked:
    '\u5f53\u524d\u5e74\u5ea6\u6d89\u53ca\u7684\u5b63\u5ea6\u8bc4\u5206\u5c1a\u672a\u5168\u90e8\u5b8c\u6210\uff0c\u5e74\u5ea6\u5f97\u5206\u6682\u4e0d\u5bf9\u975e\u7cfb\u7edf\u7ba1\u7406\u5458\u5f00\u653e\u3002',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  reviewGroupFallback: '\u672a\u5206\u914d\u5c0f\u7ec4',
  exportNotice: '\u751f\u6210\u516c\u793a\u8868',
  exportSuccess: '\u516c\u793a\u8868\u5df2\u5f00\u59cb\u4e0b\u8f7d\u3002',
  exportFailed: '\u516c\u793a\u8868\u751f\u6210\u5931\u8d25\u3002'
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
  const scoresVisible = payload?.scoresVisible ?? true;
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
        resolveDownloadFileName(headers.get('content-disposition'), `${year}\u5e74\u5e74\u5ea6\u7ee9\u6548\u8003\u8bc4\u7ed3\u679c\u8868.docx`)
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
              disabled={!(scoresVisible && filteredRanking.length)}
              onClick={() => void exportMutation.mutateAsync()}
            >
              {TEXT.exportNotice}
            </Button>
          </div>
        </div>
      </Card>

      {!scoresVisible ? <Alert type="info" showIcon message={TEXT.scoresLocked} /> : null}

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
                            {scoresVisible ? `#${index + 1} ${entry.employeeName}` : entry.employeeName}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                            {`${entry.sectionName ?? TEXT.sectionFallback} / ${entry.reviewGroupName ?? TEXT.reviewGroupFallback}`}
                          </Typography.Paragraph>
                          {scoresVisible ? (
                            <Space wrap size={[8, 8]}>
                              {entry.quarterScores.map((item) => (
                                <Tag key={`${entry.employeeId}-${item.quarter}`}>{`Q${item.quarter} ${formatAnnualScore(item.score)}`}</Tag>
                              ))}
                            </Space>
                          ) : null}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Typography.Title level={2} style={{ margin: '12px 0 4px' }}>
                            {scoresVisible ? formatAnnualScore(entry.annualScore) : '-'}
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
                    } / ${year} \u5e74\u5ea6`}
                  </Typography.Paragraph>
                </div>
                <Tag color="blue" icon={<FundOutlined />}>
                  {TEXT.annualScore}
                </Tag>
              </div>

              {scoresVisible ? (
                <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                  <Card variant="borderless">
                    <Statistic title={TEXT.annualScore} value={selectedEmployee?.annualScore ?? 0} precision={1} />
                  </Card>
                  {(selectedEmployee?.quarterScores ?? []).map((item) => (
                    <Card key={`quarter-${item.quarter}`} variant="borderless">
                      <Statistic title={`Q${item.quarter}`} value={item.score ?? 0} precision={1} />
                    </Card>
                  ))}
                </div>
              ) : null}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
