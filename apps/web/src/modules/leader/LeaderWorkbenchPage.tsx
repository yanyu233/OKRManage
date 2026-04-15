import { FileTextOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Statistic, Tag, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { bulkLeaderKrScore, getLeaderWorkbench, updateLeaderKrScore, updateLeaderProofKnowledge } from '../../shared/api/leader';
import { formatNullableScore, formatQuarterLabel, getCompletionStateLabel, getGoalStatusLabel, getLeaderEmployeeStatusLabel, getScoreTypeLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { LeaderKeyResult } from '../../shared/types/leader';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import { ALL_FILTER_VALUE, buildBulkScorePreview, buildWorkbenchFilterOptions, createScoreDrafts, filterBulkScoreEmployees, filterWorkbenchEmployees, filterWorkbenchGoals, filterWorkbenchKeyResults, resolveObjectiveBulkEmployeeIds, resolveWorkbenchSelection, selectAllBulkEmployeeIds, selectAllObjectiveKeyResultIds, type ScoreDraft } from './leader-workbench.helpers';
import './leader.css';

const START_YEAR = 2026;
const T = {
  title: '\u8bc4\u5206\u5de5\u4f5c\u53f0',
  desc: '\u6309\u8d23\u4efb\u8303\u56f4\u67e5\u770b\u5458\u5de5\u5b63\u5ea6 OKR\uff0c\u53ef\u5207\u6362\u65f6\u95f4\u3001\u641c\u7d22\u5173\u952e\u5bf9\u8c61\uff0c\u5e76\u9010\u6761\u4e3a\u5173\u952e\u7ed3\u679c\u8bc4\u5206\u3002',
  loading: '\u6b63\u5728\u52a0\u8f7d\u8bc4\u5206\u5de5\u4f5c\u53f0...',
  loadFailed: '\u8bc4\u5206\u5de5\u4f5c\u53f0\u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  search: '\u641c\u7d22\u5458\u5de5\u3001\u76ee\u6807\u6216\u5173\u952e\u7ed3\u679c',
  employeeList: '\u4eba\u5458\u961f\u5217',
  employeeEmpty: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u5458\u5de5',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  groupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  goalFallback: '\u6682\u65e0\u76ee\u6807\u8bf4\u660e',
  krFallback: '\u6682\u65e0\u5173\u952e\u7ed3\u679c\u8bf4\u660e',
  noEmployee: '\u672a\u9009\u62e9\u5458\u5de5',
  noGoals: '\u5f53\u524d\u5458\u5de5\u6682\u65e0\u76ee\u6807',
  score: '\u8bc4\u5206',
  comment: '\u8bc4\u5206\u5907\u6ce8',
  commentPlaceholder: '\u8f93\u5165\u8bc4\u5206\u5907\u6ce8',
  proofEmpty: '\u5f53\u524d\u8fd8\u6ca1\u6709\u4e0a\u4f20\u8bc1\u660e\u6750\u6599',
  previewFile: '\u9884\u89c8',
  downloadFile: '\u4e0b\u8f7d',
  markKnowledge: '\u6807\u8bb0\u4e3a\u77e5\u8bc6',
  knowledgeMarked: '\u5df2\u6536\u5f55\u5230\u77e5\u8bc6\u5e93',
  knowledgeUnmarked: '\u5df2\u4ece\u77e5\u8bc6\u5e93\u79fb\u9664',
  knowledgeFailed: '\u77e5\u8bc6\u6807\u8bb0\u66f4\u65b0\u5931\u8d25\u3002',
  goalCount: '\u76ee\u6807\u6570',
  krCount: '\u5173\u952e\u7ed3\u679c\u6570',
  scoredKrCount: '\u5df2\u8bc4\u5206\u5173\u952e\u7ed3\u679c',
  proofCount: '\u8bc1\u660e\u6750\u6599',
  quarterScore: '\u5b63\u5ea6\u603b\u5206',
  readonly: '\u5f53\u524d\u5458\u5de5\u4e0d\u5728\u4f60\u7684\u8bc4\u5206\u8303\u56f4\u5185\uff0c\u53ef\u67e5\u770b\u76ee\u6807\u3001\u5173\u952e\u7ed3\u679c\u4e0e\u6750\u6599\uff0c\u4f46\u4e0d\u53ef\u4fee\u6539\u8bc4\u5206\u3002',
  batchTitle: '\u5ba2\u89c2\u9879\u6279\u91cf\u8bc4\u5206',
  batchDesc: '\u5148\u6309\u79d1\u5ba4\u3001\u5c0f\u7ec4\u548c\u5458\u5de5\u8fc7\u6ee4\u8bc4\u5206\u5bf9\u8c61\uff0c\u518d\u7528\u5feb\u6377\u6309\u94ae\u5feb\u901f\u9009\u4e2d\u9700\u8981\u6279\u91cf\u5904\u7406\u7684\u5ba2\u89c2\u8bc4\u5206\u9879\u3002',
  sectionFilter: '\u6309\u79d1\u5ba4\u7b5b\u9009',
  groupFilter: '\u6309\u5c0f\u7ec4\u7b5b\u9009',
  employeeFilter: '\u9009\u62e9\u5458\u5de5',
  employeeFilterPlaceholder: '\u53ef\u591a\u9009\u8981\u6279\u91cf\u8bc4\u5206\u7684\u5458\u5de5',
  selectAllKrs: '\u5168\u9009\u5ba2\u89c2\u9879\u5173\u952e\u7ed3\u679c',
  batchHint: '\u70b9\u51fb\u201c\u5168\u9009\u5ba2\u89c2\u9879\u5173\u952e\u7ed3\u679c\u201d\u540e\uff0c\u4f1a\u6309\u5f53\u524d\u79d1\u5ba4\u3001\u5c0f\u7ec4\u4e0e\u5458\u5de5\u7b5b\u9009\u8303\u56f4\u751f\u6210\u6279\u91cf\u9884\u89c8\u3002',
  batchObjectiveOnly: '\u6279\u91cf\u8bc4\u5206\u4ec5\u5904\u7406\u5ba2\u89c2\u8bc4\u5206\u9879\uff0c\u4e3b\u89c2\u8bc4\u5206\u9879\u4f1a\u4fdd\u7559\u5728\u5de5\u4f5c\u53f0\u4e2d\u9010\u6761\u8bc4\u5206\u3002',
  batchFullScore: '\u672c\u6b21\u4f1a\u5c06\u547d\u4e2d\u7684\u5ba2\u89c2\u8bc4\u5206\u9879\u76f4\u63a5\u8d4b\u4e3a\u5404\u81ea\u914d\u7f6e\u7684\u6ee1\u5206\u5206\u503c\u3002',
  noScopedEmployees: '\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u5185\u6ca1\u6709\u5339\u914d\u5458\u5de5',
  overwrite: '\u8986\u76d6\u5df2\u6709\u8bc4\u5206',
  batchCommentPlaceholder: '\u8f93\u5165\u6279\u91cf\u8bc4\u5206\u5907\u6ce8',
  batchSave: '\u6279\u91cf\u8d4b\u6ee1\u5206',
  batchNeedScope: '\u8bf7\u5148\u9009\u62e9\u5458\u5de5\uff0c\u6216\u4f7f\u7528\u5168\u9009\u6309\u94ae\u751f\u6210\u6279\u91cf\u8303\u56f4\u3002',
  batchSaved: '\u6279\u91cf\u8bc4\u5206\u5df2\u4fdd\u5b58',
  batchSavedSkip: '\u6279\u91cf\u8bc4\u5206\u5b8c\u6210\uff0c\u5df2\u66f4\u65b0',
  batchSkipSuffix: '\u9879\u5df2\u81ea\u52a8\u8df3\u8fc7',
  employeeGoalsTag: '\u4e2a\u76ee\u6807',
  employeeKrsTag: '\u6761\u5173\u952e\u7ed3\u679c',
  employeeScoredTag: '\u5df2\u8bc4',
  employeeProofTag: '\u4efd\u6750\u6599',
  goalKrsTag: '\u6761\u5173\u952e\u7ed3\u679c',
  goalProofTag: '\u4efd\u6750\u6599',
  currentScore: '\u5f53\u524d\u5f97\u5206',
  selectedEmployees: '\u5df2\u9009\u5458\u5de5',
  selectedGoals: '\u5df2\u9009\u76ee\u6807',
  selectedKrs: '\u5df2\u9009\u5173\u952e\u7ed3\u679c',
  previewEmpty: '\u5f53\u524d\u8303\u56f4\u5185\u6682\u65e0\u53ef\u6279\u91cf\u8d4b\u6ee1\u5206\u7684\u5ba2\u89c2\u8bc4\u5206\u9879',
  templateGoal: '\u6a21\u677f\u76ee\u6807',
  readonlyRows: '\u9884\u89c8\u5217\u8868\u4ec5\u5c55\u793a\u4f60\u6709\u8bc4\u5206\u6743\u9650\u7684\u5ba2\u89c2\u9879\uff0c\u5176\u4ed6\u5458\u5de5\u53ef\u5728\u4e3b\u754c\u9762\u7ee7\u7eed\u67e5\u770b\u3002',
  readonlySuffix: '\uff08\u53ea\u8bfb\uff09',
  canScoreEmployees: '\u53ef\u8bc4\u5206\u5458\u5de5',
  cancel: '\u53d6\u6d88'
} as const;

export function LeaderWorkbenchPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: 8
  });
  const [keyword, setKeyword] = useState('');
  const [queueSectionId, setQueueSectionId] = useState<string | null>(null);
  const [queueReviewGroupId, setQueueReviewGroupId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkSectionId, setBulkSectionId] = useState<string | null>(null);
  const [bulkReviewGroupId, setBulkReviewGroupId] = useState<string | null>(null);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [bulkGoalIds, setBulkGoalIds] = useState<string[]>([]);
  const [bulkKrIds, setBulkKrIds] = useState<string[]>([]);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkExcludeTemplates, setBulkExcludeTemplates] = useState(false);
  const workbenchQuery = useQuery({ queryKey: ['leader-workbench', year, quarter, employeeId, goalId], queryFn: () => getLeaderWorkbench({ year, quarter, employeeId, goalId }) });

  useEffect(() => {
    if (!workbenchQuery.data) return;
    const nextSelection = resolveWorkbenchSelection(workbenchQuery.data, { employeeId, goalId });
    if (nextSelection.employeeId !== employeeId) setEmployeeId(nextSelection.employeeId);
    if (nextSelection.goalId !== goalId) setGoalId(nextSelection.goalId);
    setDrafts(createScoreDrafts(workbenchQuery.data.selectedGoal));
  }, [employeeId, goalId, workbenchQuery.data]);

  const scoreMutation = useMutation({
    mutationFn: ({ krId, draft }: { krId: string; draft: ScoreDraft }) => updateLeaderKrScore(krId, { score: draft.score ?? 0, comment: draft.comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '\u8bc4\u5206\u4fdd\u5b58\u5931\u8d25\u3002')
  });
  const bulkMutation = useMutation({
    mutationFn: () => bulkLeaderKrScore({ year, quarter, sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId, employeeIds: bulkEmployeeIds.length ? bulkEmployeeIds : undefined, goalIds: bulkGoalIds.length ? bulkGoalIds : undefined, keyResultIds: bulkKrIds.length ? bulkKrIds : undefined, comment: bulkComment.trim() || undefined, overwriteExisting: bulkOverwrite, excludeTemplateGoals: bulkExcludeTemplates }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
      if (payload.skippedCount > 0) message.warning(`${T.batchSavedSkip} ${payload.updatedCount} \u9879\uff0c${payload.skippedCount} ${T.batchSkipSuffix}`);
      else message.success(`${T.batchSaved} (${payload.updatedCount} \u9879)`);
      setIsBulkOpen(false);
      resetBulk();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '\u6279\u91cf\u8bc4\u5206\u4fdd\u5b58\u5931\u8d25\u3002')
  });
  const knowledgeMutation = useMutation({
    mutationFn: ({ proofId, isKnowledge }: { proofId: string; isKnowledge: boolean }) =>
      updateLeaderProofKnowledge(proofId, { isKnowledge }),
    onSuccess: async (proof) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-knowledge-base'] });
      message.success(proof.isKnowledge ? T.knowledgeMarked : T.knowledgeUnmarked);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.knowledgeFailed)
  });

  const selectedEmployee = workbenchQuery.data?.selectedEmployee ?? null;
  const selectedGoal = workbenchQuery.data?.selectedGoal ?? null;
  const queueSectionOptions = useMemo(
    () => buildWorkbenchFilterOptions(workbenchQuery.data?.employees ?? []).sections,
    [workbenchQuery.data?.employees]
  );
  const queueReviewGroupOptions = useMemo(
    () =>
      buildWorkbenchFilterOptions(
        filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
          sectionId: queueSectionId
        })
      ).reviewGroups,
    [queueSectionId, workbenchQuery.data?.employees]
  );
  const filteredEmployees = useMemo(
    () =>
      filterWorkbenchEmployees(
        filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
          sectionId: queueSectionId,
          reviewGroupId: queueReviewGroupId
        }),
        keyword
      ),
    [keyword, queueReviewGroupId, queueSectionId, workbenchQuery.data?.employees]
  );
  const selectedEmployeeVisible = filteredEmployees.some((employee) => employee.id === selectedEmployee?.id);
  const displaySelectedEmployee = selectedEmployeeVisible ? selectedEmployee : null;
  const displaySelectedGoal = selectedEmployeeVisible ? selectedGoal : null;
  const filteredGoals = useMemo(
    () => (displaySelectedEmployee ? filterWorkbenchGoals(workbenchQuery.data?.goals ?? [], keyword) : []),
    [displaySelectedEmployee, keyword, workbenchQuery.data?.goals]
  );
  const visibleGoals = useMemo(() => {
    if (!displaySelectedGoal) return filteredGoals;
    if (!keyword.trim()) return displaySelectedEmployee ? workbenchQuery.data?.goals ?? [] : [];
    return filteredGoals.some((goal) => goal.id === displaySelectedGoal.id)
      ? filteredGoals
      : [displaySelectedGoal, ...filteredGoals];
  }, [displaySelectedEmployee, displaySelectedGoal, filteredGoals, keyword, workbenchQuery.data?.goals]);
  useEffect(() => {
    if (queueReviewGroupId && !queueReviewGroupOptions.some((option) => option.value === queueReviewGroupId)) {
      setQueueReviewGroupId(null);
    }
  }, [queueReviewGroupId, queueReviewGroupOptions]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      return;
    }

    if (!selectedEmployeeVisible && employeeId !== filteredEmployees[0]?.id) {
      setEmployeeId(filteredEmployees[0]?.id ?? null);
      setGoalId(null);
    }
  }, [employeeId, filteredEmployees, selectedEmployeeVisible]);
  const filteredKeyResults = useMemo(
    () => filterWorkbenchKeyResults(displaySelectedGoal?.keyResults ?? [], keyword),
    [displaySelectedGoal, keyword]
  );
  const goalTabs = useMemo(() => visibleGoals.map((goal) => ({ key: goal.id, label: `${goal.code} ${goal.name}` })), [visibleGoals]);
  const { sections: bulkSectionOptions, reviewGroups: bulkReviewGroupOptions } = useMemo(() => buildWorkbenchFilterOptions(workbenchQuery.data?.employees ?? []), [workbenchQuery.data?.employees]);
  const bulkVisibleEmployees = useMemo(() => filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId }), [bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.employees]);
  const bulkScopedEmployeeIds = useMemo(() => selectAllBulkEmployeeIds(workbenchQuery.data?.employees ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId }), [bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.employees]);
  const bulkScorableEmployeeIds = useMemo(() => bulkVisibleEmployees.filter((employee) => employee.canScore).map((employee) => employee.id), [bulkVisibleEmployees]);
  const bulkPreview = useMemo(() => buildBulkScorePreview(workbenchQuery.data?.bulkCatalog ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId, employeeIds: bulkEmployeeIds, goalIds: bulkGoalIds, keyResultIds: bulkKrIds, excludeTemplateGoals: bulkExcludeTemplates }), [bulkEmployeeIds, bulkExcludeTemplates, bulkGoalIds, bulkKrIds, bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.bulkCatalog]);
  const canScoreCount = useMemo(() => bulkPreview.employees.filter((employee) => employee.canScore).length, [bulkPreview.employees]);
  const isReadonlyEmployee = Boolean(displaySelectedEmployee && !displaySelectedEmployee.canScore);
  const selectedEmployeeCount = bulkPreview.employees.length;

  if (workbenchQuery.isLoading) return <Card className="leader-detail-card">{T.loading}</Card>;
  if (workbenchQuery.isError) return <Card className="leader-detail-card"><Alert type="error" showIcon message={T.loadFailed} /></Card>;

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless"><div className="page-toolbar"><div><Typography.Title level={1} style={{ marginBottom: 8 }}>{T.title}</Typography.Title><Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{T.desc}</Typography.Paragraph></div><div className="page-toolbar__controls"><Input allowClear prefix={<SearchOutlined />} className="page-toolbar__search" placeholder={T.search} value={keyword} onChange={(event) => setKeyword(event.target.value)} /><YearQuarterPickerPopover year={year} quarter={quarter} yearOptions={yearOptions} quarterOptions={quarterOptions} onChange={(nextYear, nextQuarter) => { setPeriod(nextYear, nextQuarter); setEmployeeId(null); setGoalId(null); }} /><Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>{T.refresh}</Button></div></div></Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div className="leader-side-card__head">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {T.employeeList}
                </Typography.Title>
                <div className="leader-side-card__filters">
                  <Select
                    aria-label={T.sectionFilter}
                    size="small"
                    style={{ width: '100%' }}
                    value={queueSectionId ?? ALL_FILTER_VALUE}
                    options={queueSectionOptions}
                    onChange={(value) => {
                      setQueueSectionId(value === ALL_FILTER_VALUE ? null : value);
                    }}
                  />
                  <Select
                    aria-label={T.groupFilter}
                    size="small"
                    style={{ width: '100%' }}
                    value={queueReviewGroupId ?? ALL_FILTER_VALUE}
                    options={queueReviewGroupOptions}
                    onChange={(value) => {
                      setQueueReviewGroupId(value === ALL_FILTER_VALUE ? null : value);
                    }}
                  />
                </div>
              </div>

              <div className="leader-employee-list">
                {filteredEmployees.length ? (
                  filteredEmployees.map((employee) => (
                    <Card
                      key={employee.id}
                      className={`leader-selectable-card ${employee.id === displaySelectedEmployee?.id ? 'leader-selectable-card--active' : ''}`}
                      onClick={() => {
                        setEmployeeId(employee.id);
                        setGoalId(null);
                      }}
                    >
                      <div className="leader-ranking-entry">
                        <div>
                          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                            {employee.name}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                            {`${employee.sectionName ?? T.sectionFallback} / ${employee.reviewGroupName ?? T.groupFallback}`}
                          </Typography.Paragraph>
                        </div>
                        <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                          {getLeaderEmployeeStatusLabel(employee.status)}
                        </Tag>
                      </div>
                      <Space wrap size={[8, 8]}>
                        <Tag>{`${employee.goalCount} ${T.employeeGoalsTag}`}</Tag>
                        <Tag>{`${employee.keyResultCount} ${T.employeeKrsTag}`}</Tag>
                        <Tag>{`${T.employeeScoredTag} ${employee.scoredKeyResultCount} \u6761`}</Tag>
                        <Tag>{`${employee.proofCount} ${T.employeeProofTag}`}</Tag>
                      </Space>
                    </Card>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.employeeEmpty} />
                )}
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless"><div className="page-hero"><div><Typography.Title level={2} style={{ marginBottom: 8 }}>{displaySelectedEmployee?.name ?? T.noEmployee}</Typography.Title><Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{`${displaySelectedEmployee?.sectionName ?? T.sectionFallback} / ${displaySelectedEmployee?.reviewGroupName ?? T.groupFallback} / ${formatQuarterLabel(year, quarter)}`}</Typography.Paragraph></div><Space size={16}><Button type="primary" onClick={openBulkModal} disabled={!workbenchQuery.data?.employees.length}>{T.batchTitle}</Button><Tag color="blue">{getLeaderEmployeeStatusLabel(displaySelectedEmployee?.status ?? 'pending')}</Tag><Tag icon={<TrophyOutlined />}>{`${T.quarterScore} ${formatNullableScore(displaySelectedEmployee?.quarterScore ?? null)}`}</Tag></Space></div><div className="leader-summary-grid" style={{ marginTop: 20 }}><Card variant="borderless"><Statistic title={T.goalCount} value={displaySelectedEmployee?.goalCount ?? 0} /></Card><Card variant="borderless"><Statistic title={T.krCount} value={displaySelectedEmployee?.keyResultCount ?? 0} /></Card><Card variant="borderless"><Statistic title={T.scoredKrCount} value={displaySelectedEmployee?.scoredKeyResultCount ?? 0} /></Card><Card variant="borderless"><Statistic title={T.proofCount} value={displaySelectedEmployee?.proofCount ?? 0} /></Card></div></Card>
            <Card className="leader-detail-card" variant="borderless"><Tabs activeKey={displaySelectedGoal?.id ?? undefined} items={goalTabs} onChange={(nextGoalId) => setGoalId(nextGoalId)} />{displaySelectedGoal ? <Space direction="vertical" size={18} style={{ width: '100%' }}>{isReadonlyEmployee ? <Alert type="info" showIcon message={T.readonly} /> : null}<div className="page-hero"><div><Typography.Title level={3} style={{ marginBottom: 6 }}>{displaySelectedGoal.code} {displaySelectedGoal.name}</Typography.Title><Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{displaySelectedGoal.description ?? T.goalFallback}</Typography.Paragraph></div><Space wrap size={[8, 8]}><Tag color={displaySelectedGoal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(displaySelectedGoal.status)}</Tag><Tag>{`${displaySelectedGoal.totalPoints} \u5206`}</Tag><Tag>{`${displaySelectedGoal.keyResultCount} ${T.goalKrsTag}`}</Tag><Tag>{`${displaySelectedGoal.proofCount} ${T.goalProofTag}`}</Tag><Tag>{`${T.currentScore} ${formatNullableScore(displaySelectedGoal.currentScore)}`}</Tag></Space></div><div className="leader-kr-grid">{filteredKeyResults.length ? filteredKeyResults.map((keyResult) => { const draft = drafts[keyResult.id] ?? { score: keyResult.reviewScore, comment: keyResult.reviewComment ?? '' }; return <Card key={keyResult.id} className="leader-kr-card" variant="borderless"><Space direction="vertical" size={16} style={{ width: '100%' }}><div className="page-hero"><div><Typography.Title level={4} style={{ marginBottom: 6 }}>{keyResult.code} {keyResult.name}</Typography.Title><Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{keyResult.description ?? T.krFallback}</Typography.Paragraph></div><Space wrap size={[8, 8]}><Tag>{`${keyResult.points} \u5206`}</Tag><Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>{getScoreTypeLabel(keyResult.scoreType)}</Tag><Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>{getCompletionStateLabel(keyResult.completionState)}</Tag><Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} ${T.goalProofTag}`}</Tag></Space></div><Row gutter={[16, 16]}><Col xs={24} lg={8}><Typography.Text strong>{T.score}</Typography.Text><InputNumber style={{ width: '100%', marginTop: 8 }} min={0} max={keyResult.points} step={0.5} value={draft.score ?? undefined} disabled={!keyResult.canScore} onChange={(value) => updateDraft(keyResult.id, { score: typeof value === 'number' ? value : null })} onBlur={() => commitDraft(keyResult)} /></Col><Col xs={24} lg={16}><Typography.Text strong>{T.comment}</Typography.Text><Input.TextArea rows={3} style={{ marginTop: 8 }} placeholder={T.commentPlaceholder} value={draft.comment} disabled={!keyResult.canScore} onChange={(event) => updateDraft(keyResult.id, { comment: event.target.value })} onBlur={() => commitDraft(keyResult)} /></Col></Row><div className="leader-proof-list">{keyResult.proofs.length ? keyResult.proofs.map((proof) => <Card key={proof.id} size="small"><div className="leader-proof-row"><div className="leader-proof-meta"><Typography.Link href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer">{proof.fileName}</Typography.Link><Typography.Text type="secondary">{proof.note ?? '-'}</Typography.Text><Typography.Text type="secondary">{new Date(proof.uploadedAt).toLocaleString()}</Typography.Text></div><Space size={8} className="leader-proof-actions"><Checkbox checked={proof.isKnowledge} disabled={knowledgeMutation.isPending} onChange={(event) => toggleProofKnowledge(proof.id, event.target.checked)}>{T.markKnowledge}</Checkbox><Button type="link" size="small" href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer">{T.previewFile}</Button><Button type="link" size="small" href={resolveProofDownloadUrl(proof)} target="_blank" rel="noreferrer">{T.downloadFile}</Button></Space></div></Card>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.proofEmpty} />}</div></Space></Card>; }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.proofEmpty} />}</div></Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.noGoals} />}</Card>
          </Space>
        </Col>
      </Row>
      <Modal open={isBulkOpen} title={T.batchTitle} okText={T.batchSave} cancelText={T.cancel} onOk={submitBulkScore} okButtonProps={{ loading: bulkMutation.isPending, disabled: !bulkPreview.rows.length }} onCancel={() => { setIsBulkOpen(false); resetBulk(); }} destroyOnHidden width={860}><Space direction="vertical" size={18} style={{ width: '100%' }}><Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{T.batchDesc}</Typography.Paragraph><Alert type="info" showIcon message={T.batchObjectiveOnly} /><Alert type="success" showIcon message={T.batchFullScore} /><Row gutter={[16, 16]}><Col xs={24} md={12}><Typography.Text strong>{T.sectionFilter}</Typography.Text><Select style={{ width: '100%', marginTop: 8 }} options={bulkSectionOptions} value={bulkSectionId ?? ALL_FILTER_VALUE} onChange={(value) => { setBulkSectionId(value === ALL_FILTER_VALUE ? null : value); setBulkEmployeeIds([]); setBulkGoalIds([]); setBulkKrIds([]); setBulkExcludeTemplates(false); }} /></Col><Col xs={24} md={12}><Typography.Text strong>{T.groupFilter}</Typography.Text><Select style={{ width: '100%', marginTop: 8 }} options={bulkReviewGroupOptions} value={bulkReviewGroupId ?? ALL_FILTER_VALUE} onChange={(value) => { setBulkReviewGroupId(value === ALL_FILTER_VALUE ? null : value); setBulkEmployeeIds([]); setBulkGoalIds([]); setBulkKrIds([]); setBulkExcludeTemplates(false); }} /></Col><Col span={24}><Typography.Text strong>{T.employeeFilter}</Typography.Text><Select mode="multiple" style={{ width: '100%', marginTop: 8 }} placeholder={T.employeeFilterPlaceholder} value={bulkEmployeeIds} onChange={(value) => { setBulkEmployeeIds(value.filter((id) => bulkVisibleEmployees.some((employee) => employee.id === id && employee.canScore))); setBulkGoalIds([]); setBulkKrIds([]); setBulkExcludeTemplates(false); }} options={bulkVisibleEmployees.map((employee) => ({ value: employee.id, label: `${employee.name} / ${employee.sectionName ?? T.sectionFallback} / ${employee.reviewGroupName ?? T.groupFallback}${employee.canScore ? '' : T.readonlySuffix}`, disabled: !employee.canScore }))} optionFilterProp="label" /></Col></Row><Space wrap><Button onClick={handleSelectAllKeyResults} disabled={!bulkScorableEmployeeIds.length}>{T.selectAllKrs}</Button></Space><Typography.Text type="secondary">{T.batchHint}</Typography.Text>{bulkVisibleEmployees.length ? null : <Alert type="warning" showIcon message={T.noScopedEmployees} />}<Space wrap size={[8, 8]}><Tag>{`\u5df2\u9009\u5458\u5de5 ${selectedEmployeeCount} \u4eba`}</Tag><Tag>{`\u5df2\u9009\u76ee\u6807 ${bulkPreview.goals.length} \u4e2a`}</Tag><Tag>{`\u5df2\u9009\u5173\u952e\u7ed3\u679c ${bulkPreview.keyResults.length} \u6761`}</Tag><Tag color={canScoreCount ? 'green' : 'default'}>{`${T.canScoreEmployees} ${canScoreCount} \u4eba`}</Tag></Space><div className="leader-bulk-preview-grid"><Card size="small" title={T.selectedEmployees}>{bulkPreview.employees.length ? <Space wrap size={[8, 8]}>{bulkPreview.employees.map((employee) => <Tag key={employee.id} color={employee.canScore ? 'blue' : 'default'}>{`${employee.name}${employee.canScore ? '' : T.readonlySuffix}`}</Tag>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />}</Card><Card size="small" title={T.selectedGoals}>{bulkPreview.goals.length ? <Space wrap size={[8, 8]}>{bulkPreview.goals.map((goal) => <Tag key={`${goal.employeeId}:${goal.goalId}`} color={goal.isTemplateGoal ? 'gold' : 'default'}>{`${goal.employeeName} / ${goal.goalCode} ${goal.goalName}`}</Tag>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />}</Card></div><Card size="small" title={T.selectedKrs}>{bulkPreview.rows.length ? <div className="leader-bulk-kr-preview">{bulkPreview.rows.map((entry) => <div key={`${entry.employeeId}:${entry.goalId}:${entry.keyResultId}`} className="leader-bulk-kr-row"><div className="leader-bulk-kr-row__main"><Typography.Text strong>{`${entry.employeeName} / ${entry.goalCode} ${entry.goalName}`}</Typography.Text><Typography.Text type="secondary">{`${entry.keyResultCode} ${entry.keyResultName}`}</Typography.Text></div><Space wrap size={[8, 8]} className="leader-bulk-kr-row__tags">{entry.isTemplateGoal ? <Tag color="gold">{T.templateGoal}</Tag> : null}<Tag>{`${entry.points} \u5206`}</Tag><Tag color="blue">{getScoreTypeLabel(entry.scoreType)}</Tag><Tag>{`${T.currentScore} ${formatNullableScore(entry.reviewScore)}`}</Tag></Space></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />}</Card>{bulkPreview.readonlyRows > 0 ? <Alert type="warning" showIcon message={T.readonlyRows} /> : null}<div><Typography.Text strong>{T.comment}</Typography.Text><Input.TextArea rows={3} style={{ marginTop: 8 }} placeholder={T.batchCommentPlaceholder} value={bulkComment} onChange={(event) => setBulkComment(event.target.value)} /></div><Checkbox checked={bulkOverwrite} onChange={(event) => setBulkOverwrite(event.target.checked)}>{T.overwrite}</Checkbox></Space></Modal>
    </Space>
  );

  function updateDraft(krId: string, patch: Partial<ScoreDraft>) { setDrafts((current) => ({ ...current, [krId]: { score: current[krId]?.score ?? null, comment: current[krId]?.comment ?? '', ...patch } })); }
  function commitDraft(keyResult: LeaderKeyResult) {
    if (!keyResult.canScore) return;
    const draft = drafts[keyResult.id];
    if (!draft || draft.score === null) return;
    if (draft.score === keyResult.reviewScore && draft.comment === (keyResult.reviewComment ?? '')) return;
    scoreMutation.mutate({ krId: keyResult.id, draft });
  }
  function openBulkModal() { setIsBulkOpen(true); setBulkEmployeeIds([]); setBulkGoalIds([]); setBulkKrIds([]); setBulkComment(''); setBulkOverwrite(false); setBulkExcludeTemplates(false); setBulkSectionId(null); setBulkReviewGroupId(null); }
  function resetBulk() { setBulkSectionId(null); setBulkReviewGroupId(null); setBulkEmployeeIds([]); setBulkGoalIds([]); setBulkKrIds([]); setBulkComment(''); setBulkOverwrite(false); setBulkExcludeTemplates(false); }
  function handleSelectAllKeyResults() {
    const nextEmployeeIds = resolveObjectiveBulkEmployeeIds(bulkEmployeeIds.length ? bulkEmployeeIds : bulkScopedEmployeeIds, bulkScorableEmployeeIds);
    if (!nextEmployeeIds.length) return;
    setBulkEmployeeIds(nextEmployeeIds);
    setBulkKrIds(selectAllObjectiveKeyResultIds(workbenchQuery.data?.bulkCatalog ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId, employeeIds: nextEmployeeIds, goalIds: bulkGoalIds, excludeTemplateGoals: bulkExcludeTemplates }));
  }
  function toggleProofKnowledge(proofId: string, isKnowledge: boolean) { knowledgeMutation.mutate({ proofId, isKnowledge }); }
  function resolveProofPreviewUrl(proof: LeaderKeyResult['proofs'][number]) { return resolveApiUrl(proof.previewUrl ?? proof.fileUrl); }
  function resolveProofDownloadUrl(proof: LeaderKeyResult['proofs'][number]) { return resolveApiUrl(proof.downloadUrl ?? proof.fileUrl); }
  function submitBulkScore() { if (!bulkPreview.rows.length) { message.warning(T.batchNeedScope); return; } bulkMutation.mutate(); }
}
