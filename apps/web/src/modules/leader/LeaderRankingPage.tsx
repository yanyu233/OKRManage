import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Input, Modal, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../shared/api/http';
import { downloadLeaderRankingPublicNotice, getLeaderRanking, saveLeaderRankingTieBreak } from '../../shared/api/leader';
import { downloadBlobFile, resolveDownloadFileName } from '../../shared/files/download';
import { formatQuarterLabel, getLeaderEmployeeStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { LeaderRankingTieGroup } from '../../shared/types/leader';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import { filterRankingEntries, filterRankingGoalBreakdown, formatQuarterScore, resolveRankingSelection } from './leader-ranking.helpers';
import './leader.css';

const START_YEAR = 2026;
const EMPTY_TIE_GROUPS: LeaderRankingTieGroup[] = [];
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
  rankingLocked: '\u5f53\u524d\u5b63\u5ea6\u4e3b\u89c2\u4e0e\u5ba2\u89c2\u8bc4\u5206\u5c1a\u672a\u5168\u90e8\u5b8c\u6210\uff0c\u6392\u540d\u7ed3\u679c\u6682\u4e0d\u5f00\u653e\u3002',
  quarterScore: '\u5b63\u5ea6\u603b\u5206',
  goalCount: '\u76ee\u6807\u6570',
  scoredKeyResultCount: '\u5df2\u8bc4\u5206\u5173\u952e\u7ed3\u679c',
  goalCountTag: '\u4e2a\u76ee\u6807',
  keyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  scoredTagPrefix: '\u5df2\u8bc4',
  goalScorePrefix: '\u76ee\u6807\u5f97\u5206',
  exportNotice: '\u751f\u6210\u516c\u793a\u8868',
  exportSuccess: '\u516c\u793a\u8868\u5df2\u5f00\u59cb\u4e0b\u8f7d\u3002',
  exportFailed: '\u516c\u793a\u8868\u751f\u6210\u5931\u8d25\u3002',
  tieBreakModalTitle: '同分待评定',
  tieBreakModalDescription:
    '系统已按“自建目标得分、目标任务综合评价、工作态度、工作能力、创优争先、学习分享”的顺序自动比较。以下人员仍完全同分，请按高等级优先顺序逐组确认。',
  tieBreakAffectedGrades: '涉及等级',
  tieBreakRankRange: '影响名次',
  tieBreakPriorityOrder: '高等级优先顺序',
  tieBreakSave: '保存本组评定',
  tieBreakSaveSuccess: '同分评定已保存。',
  tieBreakSaveFailed: '同分评定保存失败。'
} as const;

const TIE_BREAK_METRIC_LABELS: Array<{
  key:
    | 'customGoalScore'
    | 'objectiveTaskScore'
    | 'workAttitudeScore'
    | 'workCapabilityScore'
    | 'innovationScore'
    | 'learningShareScore';
  label: string;
}> = [
  { key: 'customGoalScore', label: '自建目标得分' },
  { key: 'objectiveTaskScore', label: '目标任务综合评价' },
  { key: 'workAttitudeScore', label: '工作态度' },
  { key: 'workCapabilityScore', label: '工作能力' },
  { key: 'innovationScore', label: '创优争先' },
  { key: 'learningShareScore', label: '学习分享' }
];

const TIE_BREAK_TEXT = {
  modalTitle: '\u540c\u5206\u5f85\u8bc4\u5b9a',
  modalDescription:
    '\u7cfb\u7edf\u5df2\u6309\u201c\u81ea\u5efa\u76ee\u6807\u5f97\u5206\u3001\u76ee\u6807\u4efb\u52a1\u7efc\u5408\u8bc4\u4ef7\u3001\u5de5\u4f5c\u6001\u5ea6\u3001\u5de5\u4f5c\u80fd\u529b\u3001\u521b\u4f18\u4e89\u5148\u3001\u5b66\u4e60\u5206\u4eab\u201d\u7684\u987a\u5e8f\u81ea\u52a8\u6bd4\u8f83\u3002\u4ee5\u4e0b\u4eba\u5458\u4ecd\u5b8c\u5168\u540c\u5206\uff0c\u8bf7\u6309\u9ad8\u7b49\u7ea7\u4f18\u5148\u987a\u5e8f\u9010\u7ec4\u786e\u8ba4\u3002',
  affectedGrades: '\u6d89\u53ca\u7b49\u7ea7',
  rankRange: '\u5f71\u54cd\u540d\u6b21',
  priorityOrder: '\u9ad8\u7b49\u7ea7\u4f18\u5148\u987a\u5e8f',
  save: '\u4fdd\u5b58\u672c\u7ec4\u8bc4\u5b9a',
  saveSuccess: '\u540c\u5206\u8bc4\u5b9a\u5df2\u4fdd\u5b58\u3002',
  saveFailed: '\u540c\u5206\u8bc4\u5b9a\u4fdd\u5b58\u5931\u8d25\u3002'
} as const;

const TIE_BREAK_METRIC_DISPLAY_LABELS: Array<{
  key:
    | 'customGoalScore'
    | 'objectiveTaskScore'
    | 'workAttitudeScore'
    | 'workCapabilityScore'
    | 'innovationScore'
    | 'learningShareScore';
  label: string;
}> = [
  { key: 'customGoalScore', label: '\u81ea\u5efa\u76ee\u6807\u5f97\u5206' },
  { key: 'objectiveTaskScore', label: '\u76ee\u6807\u4efb\u52a1\u7efc\u5408\u8bc4\u4ef7' },
  { key: 'workAttitudeScore', label: '\u5de5\u4f5c\u6001\u5ea6' },
  { key: 'workCapabilityScore', label: '\u5de5\u4f5c\u80fd\u529b' },
  { key: 'innovationScore', label: '\u521b\u4f18\u4e89\u5148' },
  { key: 'learningShareScore', label: '\u5b66\u4e60\u5206\u4eab' }
];

void TIE_BREAK_METRIC_LABELS;

export function LeaderRankingPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: 8
  });
  const [keyword, setKeyword] = useState('');
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [tieBreakOpen, setTieBreakOpen] = useState(false);
  const [tieBreakDrafts, setTieBreakDrafts] = useState<Record<string, string[]>>({});
  const [savingTieGroupKey, setSavingTieGroupKey] = useState<string | null>(null);

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

  const exportMutation = useMutation({
    mutationFn: () =>
      downloadLeaderRankingPublicNotice({
        year,
        quarter,
        reviewGroupId: payload?.selectedReviewGroup?.id ?? reviewGroupId,
        employeeId: undefined
      }),
    onSuccess: ({ blob, headers }) => {
      downloadBlobFile(
        blob,
        resolveDownloadFileName(headers.get('content-disposition'), `${year}Q${quarter}-公示表.docx`)
      );
      message.success(TEXT.exportSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : TEXT.exportFailed)
  });

  const tieBreakMutation = useMutation({
    mutationFn: (payload: {
      year: number;
      quarter: number;
      reviewGroupId: string;
      groupKey: string;
      orderedEmployeeIds: string[];
    }) => saveLeaderRankingTieBreak(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
      message.success(TIE_BREAK_TEXT.saveSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : TIE_BREAK_TEXT.saveFailed),
    onSettled: () => setSavingTieGroupKey(null)
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
  const pendingTieGroups = payload?.pendingTieGroups ?? EMPTY_TIE_GROUPS;
  const filteredRanking = useMemo(() => filterRankingEntries(payload?.ranking ?? [], keyword), [keyword, payload?.ranking]);
  const filteredGoalBreakdown = useMemo(
    () => filterRankingGoalBreakdown(selectedEmployee?.goalBreakdown ?? [], keyword),
    [keyword, selectedEmployee?.goalBreakdown]
  );

  useEffect(() => {
    if (payload?.canManageTieBreaks && pendingTieGroups.length) {
      const nextDrafts = buildTieBreakDrafts(pendingTieGroups);
      setTieBreakDrafts((current) => (isSameTieBreakDraftMap(current, nextDrafts) ? current : nextDrafts));
      setTieBreakOpen((current) => (current ? current : true));
      return;
    }

    setTieBreakOpen((current) => (current ? false : current));
    setTieBreakDrafts((current) => (Object.keys(current).length ? {} : current));
  }, [payload?.canManageTieBreaks, pendingTieGroups]);

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
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={exportMutation.isPending}
              disabled={!(payload?.scoresVisible && payload?.ranking.length)}
              onClick={() => void exportMutation.mutateAsync()}
            >
              {TEXT.exportNotice}
            </Button>
          </div>
        </div>
      </Card>

      {payload && !payload.scoresVisible ? <Alert type="info" showIcon message={TEXT.rankingLocked} /> : null}

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

              {payload?.scoresVisible ? (
                <div className="leader-seat-summary">
                  {(payload?.seatSummary ?? []).map((seat) => (
                    <div key={seat.gradeCode} className="leader-seat-chip">
                      <Typography.Text strong>{seat.gradeCode}</Typography.Text>
                      <Typography.Text type="secondary">{` ${seat.occupiedCount}/${seat.seatCount}`}</Typography.Text>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="leader-ranking-list">
                {payload?.scoresVisible && filteredRanking.length ? (
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={payload?.scoresVisible ? TEXT.emptyRanking : TEXT.rankingLocked} />
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

              {payload?.scoresVisible ? (
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
              ) : null}
            </Card>

            <Card className="leader-detail-card" variant="borderless" title={TEXT.goalBreakdownTitle}>
              {payload?.scoresVisible && selectedEmployee ? (
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={payload?.scoresVisible ? TEXT.noBreakdown : TEXT.rankingLocked} />
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        open={tieBreakOpen}
        title={TIE_BREAK_TEXT.modalTitle}
        footer={null}
        onCancel={() => setTieBreakOpen(false)}
        width={920}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="warning" showIcon message={TIE_BREAK_TEXT.modalDescription} />

          {pendingTieGroups.map((group) => {
            const orderedEmployeeIds = tieBreakDrafts[group.groupKey] ?? group.employees.map((employee) => employee.employeeId);
            const orderedEmployees = orderedEmployeeIds
              .map((orderedEmployeeId) => group.employees.find((employee) => employee.employeeId === orderedEmployeeId) ?? null)
              .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee));

            return (
              <Card
                key={group.groupKey}
                size="small"
                title={`${group.reviewGroupName} / ${TIE_BREAK_TEXT.rankRange} #${group.rankStart}-#${group.rankEnd}`}
                extra={<Tag color="gold">{`${TIE_BREAK_TEXT.affectedGrades} ${group.affectedGradeCodes.join(' / ')}`}</Tag>}
              >
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Typography.Text strong>{TIE_BREAK_TEXT.priorityOrder}</Typography.Text>

                  <div className="leader-tie-break-list">
                    {orderedEmployees.map((employee, index) => (
                      <div key={employee.employeeId} className="leader-tie-break-row">
                        <div className="leader-tie-break-row__order">{index + 1}</div>
                        <div className="leader-tie-break-row__content">
                          <div className="leader-tie-break-row__headline">
                            <Typography.Text strong>{employee.employeeName}</Typography.Text>
                            {employee.sectionName ? (
                              <Typography.Text type="secondary">{employee.sectionName}</Typography.Text>
                            ) : null}
                            <Tag>{`${TEXT.quarterScore} ${formatQuarterScore(employee.quarterScore)}`}</Tag>
                          </div>
                          <Space wrap size={[8, 8]}>
                            {TIE_BREAK_METRIC_DISPLAY_LABELS.map((metric) => (
                              <Tag key={`${group.groupKey}:${employee.employeeId}:${metric.key}`}>
                                {`${metric.label} ${employee.tieBreakMetrics[metric.key].toFixed(1)}`}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                        <Space size={6}>
                          <Button
                            size="small"
                            icon={<ArrowUpOutlined />}
                            disabled={index === 0}
                            onClick={() => setTieBreakDrafts((current) => moveTieBreakEmployee(current, group.groupKey, index, -1))}
                          />
                          <Button
                            size="small"
                            icon={<ArrowDownOutlined />}
                            disabled={index === orderedEmployees.length - 1}
                            onClick={() => setTieBreakDrafts((current) => moveTieBreakEmployee(current, group.groupKey, index, 1))}
                          />
                        </Space>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      loading={savingTieGroupKey === group.groupKey && tieBreakMutation.isPending}
                      onClick={() => {
                        setSavingTieGroupKey(group.groupKey);
                        void tieBreakMutation.mutateAsync({
                          year,
                          quarter,
                          reviewGroupId: group.reviewGroupId,
                          groupKey: group.groupKey,
                          orderedEmployeeIds: orderedEmployeeIds
                        });
                      }}
                    >
                      {TIE_BREAK_TEXT.save}
                    </Button>
                  </div>
                </Space>
              </Card>
            );
          })}
        </Space>
      </Modal>
    </Space>
  );
}

function moveTieBreakEmployee(
  current: Record<string, string[]>,
  groupKey: string,
  index: number,
  offset: -1 | 1
) {
  const group = [...(current[groupKey] ?? [])];
  const nextIndex = index + offset;

  if (nextIndex < 0 || nextIndex >= group.length) {
    return current;
  }

  [group[index], group[nextIndex]] = [group[nextIndex], group[index]];
  return {
    ...current,
    [groupKey]: group
  };
}

function buildTieBreakDrafts(groups: LeaderRankingTieGroup[]) {
  return groups.reduce<Record<string, string[]>>((accumulator, group) => {
    accumulator[group.groupKey] = group.employees.map((employee) => employee.employeeId);
    return accumulator;
  }, {});
}

function isSameTieBreakDraftMap(current: Record<string, string[]>, next: Record<string, string[]>) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => {
    const currentGroup = current[key];
    const nextGroup = next[key];

    if (!currentGroup || currentGroup.length !== nextGroup.length) {
      return false;
    }

    return nextGroup.every((employeeId, index) => currentGroup[index] === employeeId);
  });
}
