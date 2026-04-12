import { FileTextOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tabs,
  Typography
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { bulkLeaderKrScore, getLeaderWorkbench, updateLeaderKrScore } from '../../shared/api/leader';
import {
  formatNullableScore,
  formatQuarterLabel,
  getCompletionStateLabel,
  getGoalStatusLabel,
  getLeaderEmployeeStatusLabel,
  getScoreTypeLabel
} from '../../shared/i18n/labels';
import { buildQuarterOptions, buildToolbarYearOptions } from '../../shared/ui/toolbar-options';
import type { LeaderKeyResult } from '../../shared/types/leader';
import {
  buildWorkbenchFilterOptions,
  createScoreDrafts,
  filterBulkScoreEmployees,
  filterWorkbenchEmployees,
  filterWorkbenchGoals,
  filterWorkbenchKeyResults,
  type ScoreDraft,
  resolveWorkbenchSelection,
  selectAllBulkEmployeeIds
} from './leader-workbench.helpers';
import './leader.css';

const START_YEAR = 2026;
const DEFAULT_YEAR = 2026;
const DEFAULT_QUARTER = 1;
const TEXT = {
  title: '\u8bc4\u5206\u5de5\u4f5c\u53f0',
  description:
    '\u6309\u8d23\u4efb\u8303\u56f4\u67e5\u770b\u5458\u5de5\u5b63\u5ea6 OKR\uff0c\u53ef\u5207\u6362\u65f6\u95f4\u3001\u641c\u7d22\u5173\u952e\u5bf9\u8c61\uff0c\u5e76\u9010\u6761\u4e3a\u5173\u952e\u7ed3\u679c\u8bc4\u5206\u3002',
  loading: '\u6b63\u5728\u52a0\u8f7d\u8bc4\u5206\u5de5\u4f5c\u53f0...',
  loadFailed: '\u8bc4\u5206\u5de5\u4f5c\u53f0\u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u5458\u5de5\u3001\u76ee\u6807\u6216\u5173\u952e\u7ed3\u679c',
  employeeListTitle: '\u4eba\u5458\u961f\u5217',
  employeeEmpty: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u5458\u5de5',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  reviewGroupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  goalDescriptionFallback: '\u6682\u65e0\u76ee\u6807\u8bf4\u660e',
  krDescriptionFallback: '\u6682\u65e0\u5173\u952e\u7ed3\u679c\u8bf4\u660e',
  noEmployeeSelected: '\u672a\u9009\u62e9\u5458\u5de5',
  noGoals: '\u5f53\u524d\u5458\u5de5\u6682\u65e0\u76ee\u6807',
  scoreLabel: '\u8bc4\u5206',
  commentLabel: '\u8bc4\u5206\u5907\u6ce8',
  commentPlaceholder: '\u8f93\u5165\u8bc4\u5206\u5907\u6ce8',
  proofEmpty: '\u5f53\u524d\u8fd8\u6ca1\u6709\u4e0a\u4f20\u8bc1\u660e\u6750\u6599',
  openFile: '\u6253\u5f00\u6587\u4ef6',
  goalCount: '\u76ee\u6807\u6570',
  keyResultCount: '\u5173\u952e\u7ed3\u679c\u6570',
  scoredKeyResultCount: '\u5df2\u8bc4\u5206\u5173\u952e\u7ed3\u679c',
  proofCount: '\u8bc1\u660e\u6750\u6599',
  quarterScorePrefix: '\u5b63\u5ea6\u603b\u5206',
  readonlyScopeMessage: '\u5f53\u524d\u5458\u5de5\u4e0d\u5728\u4f60\u7684\u8bc4\u5206\u8303\u56f4\u5185\uff0c\u53ef\u67e5\u770b\u76ee\u6807\u3001\u5173\u952e\u7ed3\u679c\u4e0e\u6750\u6599\uff0c\u4f46\u4e0d\u53ef\u4fee\u6539\u8bc4\u5206\u3002',
  batchScore: '\u5ba2\u89c2\u9879\u6279\u91cf\u8bc4\u5206',
  batchScoreIntro:
    '\u5148\u6309\u79d1\u5ba4\u3001\u5c0f\u7ec4\u548c\u5458\u5de5\u8fc7\u6ee4\u8bc4\u5206\u5bf9\u8c61\uff0c\u518d\u7528\u5feb\u6377\u6309\u94ae\u5feb\u901f\u9009\u4e2d\u9700\u8981\u6279\u91cf\u5904\u7406\u7684\u5ba2\u89c2\u8bc4\u5206\u9879\u3002',
  bulkSectionFilter: '\u6309\u79d1\u5ba4\u7b5b\u9009',
  bulkReviewGroupFilter: '\u6309\u5c0f\u7ec4\u7b5b\u9009',
  bulkEmployeeFilter: '\u9009\u62e9\u5458\u5de5',
  bulkEmployeePlaceholder: '\u53ef\u591a\u9009\u8981\u6279\u91cf\u8bc4\u5206\u7684\u5458\u5de5',
  selectAllEmployees: '\u5168\u9009\u5458\u5de5',
  selectAllGoals: '\u5168\u9009\u76ee\u6807',
  selectAllKeyResults: '\u5168\u9009\u5ba2\u89c2\u9879\u5173\u952e\u7ed3\u679c',
  selectAllExcludeTemplates: '\u5168\u9009\uff08\u53bb\u9664\u6a21\u677f\u76ee\u6807\uff09',
  batchScopeSummaryEmployeePrefix: '\u5df2\u9009\u5458\u5de5',
  batchScopeSummaryGoalPrefix: '\u5df2\u9009\u76ee\u6807',
  batchScopeSummaryKrPrefix: '\u5df2\u9009\u5173\u952e\u7ed3\u679c',
  batchScopeHint: '\u201c\u5168\u9009\u76ee\u6807/\u5173\u952e\u7ed3\u679c\u201d\u57fa\u4e8e\u5f53\u524d\u6b63\u5728\u67e5\u770b\u7684\u5458\u5de5\u548c\u76ee\u6807\u3002',
  batchObjectiveAlert:
    '\u6279\u91cf\u8bc4\u5206\u4ec5\u5904\u7406\u5ba2\u89c2\u8bc4\u5206\u9879\uff0c\u4e3b\u89c2\u8bc4\u5206\u9879\u4f1a\u4fdd\u7559\u5728\u5de5\u4f5c\u53f0\u4e2d\u9010\u6761\u8bc4\u5206\u3002',
  batchNoScopedEmployees: '\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u5185\u6ca1\u6709\u5339\u914d\u5458\u5de5',
  batchOverwriteExisting: '\u8986\u76d6\u5df2\u6709\u8bc4\u5206',
  batchScorePlaceholder: '\u8f93\u5165\u6279\u91cf\u8bc4\u5206',
  batchCommentPlaceholder: '\u8f93\u5165\u6279\u91cf\u8bc4\u5206\u5907\u6ce8',
  batchSave: '\u6279\u91cf\u4fdd\u5b58',
  batchNeedScore: '\u8bf7\u5148\u586b\u5199\u6279\u91cf\u8bc4\u5206\u3002',
  batchNeedScope: '\u8bf7\u5148\u9009\u62e9\u5458\u5de5\uff0c\u6216\u4f7f\u7528\u5168\u9009\u6309\u94ae\u751f\u6210\u6279\u91cf\u8303\u56f4\u3002',
  batchSuccess: '\u6279\u91cf\u8bc4\u5206\u5df2\u4fdd\u5b58',
  batchSuccessWithSkipPrefix: '\u6279\u91cf\u8bc4\u5206\u5b8c\u6210\uff0c\u5df2\u66f4\u65b0',
  batchSkipSuffix: '\u9879\u5df2\u81ea\u52a8\u8df3\u8fc7',
  employeeGoalCountTag: '\u4e2a\u76ee\u6807',
  employeeKeyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  employeeScoredTagPrefix: '\u5df2\u8bc4',
  employeeProofTag: '\u4efd\u6750\u6599',
  goalKeyResultTag: '\u6761\u5173\u952e\u7ed3\u679c',
  goalProofTag: '\u4efd\u6750\u6599',
  currentScoreTagPrefix: '\u5f53\u524d\u5f97\u5206'
} as const;

export function LeaderWorkbenchPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [quarter, setQuarter] = useState(DEFAULT_QUARTER);
  const [keyword, setKeyword] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSectionId, setBulkSectionId] = useState<string | null>(null);
  const [bulkReviewGroupId, setBulkReviewGroupId] = useState<string | null>(null);
  const [bulkEmployeeIds, setBulkEmployeeIds] = useState<string[]>([]);
  const [bulkGoalIds, setBulkGoalIds] = useState<string[]>([]);
  const [bulkKeyResultIds, setBulkKeyResultIds] = useState<string[]>([]);
  const [bulkScore, setBulkScore] = useState<number | null>(null);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkOverwriteExisting, setBulkOverwriteExisting] = useState(false);
  const [bulkExcludeTemplateGoals, setBulkExcludeTemplateGoals] = useState(false);

  const yearOptions = useMemo(
    () => buildToolbarYearOptions(START_YEAR, Math.max(START_YEAR, new Date().getFullYear() + 4)),
    []
  );
  const quarterOptions = useMemo(() => buildQuarterOptions(), []);

  const workbenchQuery = useQuery({
    queryKey: ['leader-workbench', year, quarter, employeeId, goalId],
    queryFn: () =>
      getLeaderWorkbench({
        year,
        quarter,
        employeeId,
        goalId
      })
  });

  useEffect(() => {
    if (!workbenchQuery.data) {
      return;
    }

    const nextSelection = resolveWorkbenchSelection(workbenchQuery.data, { employeeId, goalId });
    if (nextSelection.employeeId !== employeeId) {
      setEmployeeId(nextSelection.employeeId);
    }
    if (nextSelection.goalId !== goalId) {
      setGoalId(nextSelection.goalId);
    }
    setDrafts(createScoreDrafts(workbenchQuery.data.selectedGoal));
  }, [employeeId, goalId, workbenchQuery.data]);

  const scoreMutation = useMutation({
    mutationFn: ({ krId, draft }: { krId: string; draft: ScoreDraft }) =>
      updateLeaderKrScore(krId, {
        score: draft.score ?? 0,
        comment: draft.comment
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : '\u8bc4\u5206\u4fdd\u5b58\u5931\u8d25\u3002';
      message.error(description);
    }
  });
  const bulkScoreMutation = useMutation({
    mutationFn: () =>
      bulkLeaderKrScore({
        year,
        quarter,
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: bulkEmployeeIds.length ? bulkEmployeeIds : undefined,
        goalIds: bulkGoalIds.length ? bulkGoalIds : undefined,
        keyResultIds: bulkKeyResultIds.length ? bulkKeyResultIds : undefined,
        score: bulkScore ?? 0,
        comment: bulkComment.trim() || undefined,
        overwriteExisting: bulkOverwriteExisting,
        excludeTemplateGoals: bulkExcludeTemplateGoals
      }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
      if (payload.skippedCount > 0) {
        message.warning(`${TEXT.batchSuccessWithSkipPrefix} ${payload.updatedCount} \u9879\uff0c${payload.skippedCount} ${TEXT.batchSkipSuffix}`);
      } else {
        message.success(`${TEXT.batchSuccess} (${payload.updatedCount} \u9879)`);
      }
      setIsBulkModalOpen(false);
      resetBulkState();
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : '\u6279\u91cf\u8bc4\u5206\u4fdd\u5b58\u5931\u8d25\u3002';
      message.error(description);
    }
  });

  const selectedGoal = workbenchQuery.data?.selectedGoal ?? null;
  const selectedEmployee = workbenchQuery.data?.selectedEmployee ?? null;

  const filteredEmployees = useMemo(
    () => filterWorkbenchEmployees(workbenchQuery.data?.employees ?? [], keyword),
    [keyword, workbenchQuery.data?.employees]
  );
  const filteredGoals = useMemo(
    () => filterWorkbenchGoals(workbenchQuery.data?.goals ?? [], keyword),
    [keyword, workbenchQuery.data?.goals]
  );
  const visibleGoals = useMemo(() => {
    if (!selectedGoal) {
      return filteredGoals;
    }

    if (!keyword.trim()) {
      return workbenchQuery.data?.goals ?? [];
    }

    if (filteredGoals.some((goal) => goal.id === selectedGoal.id)) {
      return filteredGoals;
    }

    return [selectedGoal, ...filteredGoals];
  }, [filteredGoals, keyword, selectedGoal, workbenchQuery.data?.goals]);
  const filteredKeyResults = useMemo(
    () => filterWorkbenchKeyResults(selectedGoal?.keyResults ?? [], keyword),
    [keyword, selectedGoal]
  );

  const goalTabs = useMemo(
    () =>
      visibleGoals.map((goal) => ({
        key: goal.id,
        label: `${goal.code} ${goal.name}`
      })),
    [visibleGoals]
  );
  const { sections: bulkSectionOptions, reviewGroups: bulkReviewGroupOptions } = useMemo(
    () => buildWorkbenchFilterOptions(workbenchQuery.data?.employees ?? []),
    [workbenchQuery.data?.employees]
  );
  const bulkVisibleEmployees = useMemo(
    () => filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId }),
    [bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.employees]
  );
  const selectedBulkEmployees = useMemo(
    () => bulkVisibleEmployees.filter((employee) => bulkEmployeeIds.includes(employee.id)),
    [bulkEmployeeIds, bulkVisibleEmployees]
  );
  const inScopeBulkEmployeeCount = useMemo(
    () => selectedBulkEmployees.filter((employee) => employee.canScore).length,
    [selectedBulkEmployees]
  );
  const selectedGoalScopeCount = bulkGoalIds.length;
  const selectedKeyResultScopeCount = bulkKeyResultIds.length;
  const isSelectedEmployeeReadonly = Boolean(selectedEmployee && !selectedEmployee.canScore);

  if (workbenchQuery.isLoading) {
    return <Card className="leader-detail-card">{TEXT.loading}</Card>;
  }

  if (workbenchQuery.isError) {
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
                setGoalId(null);
              }}
              style={{ minWidth: 140 }}
            />
            <Select
              value={quarter}
              options={quarterOptions}
              onChange={(value) => {
                setQuarter(value);
                setEmployeeId(null);
                setGoalId(null);
              }}
              style={{ minWidth: 140 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless" title={TEXT.employeeListTitle}>
            <div className="leader-employee-list">
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
                  <Card
                    key={employee.id}
                    className={`leader-selectable-card ${employee.id === selectedEmployee?.id ? 'leader-selectable-card--active' : ''}`}
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
                          {`${employee.sectionName ?? TEXT.sectionFallback} / ${employee.reviewGroupName ?? TEXT.reviewGroupFallback}`}
                        </Typography.Paragraph>
                      </div>
                      <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                        {getLeaderEmployeeStatusLabel(employee.status)}
                      </Tag>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag>{`${employee.goalCount} ${TEXT.employeeGoalCountTag}`}</Tag>
                      <Tag>{`${employee.keyResultCount} ${TEXT.employeeKeyResultCountTag}`}</Tag>
                      <Tag>{`${TEXT.employeeScoredTagPrefix} ${employee.scoredKeyResultCount} \u6761`}</Tag>
                      <Tag>{`${employee.proofCount} ${TEXT.employeeProofTag}`}</Tag>
                    </Space>
                  </Card>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.employeeEmpty} />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless">
              <div className="page-hero">
                <div>
                  <Typography.Title level={2} style={{ marginBottom: 8 }}>
                    {selectedEmployee?.name ?? TEXT.noEmployeeSelected}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {`${selectedEmployee?.sectionName ?? TEXT.sectionFallback} / ${
                      selectedEmployee?.reviewGroupName ?? TEXT.reviewGroupFallback
                    } / ${formatQuarterLabel(year, quarter)}`}
                  </Typography.Paragraph>
                </div>
                <Space size={16}>
                  <Button type="primary" onClick={openBulkModal} disabled={!workbenchQuery.data?.employees.length}>
                    {TEXT.batchScore}
                  </Button>
                  <Tag color="blue">{getLeaderEmployeeStatusLabel(selectedEmployee?.status ?? 'pending')}</Tag>
                  <Tag icon={<TrophyOutlined />}>{`${TEXT.quarterScorePrefix} ${formatNullableScore(selectedEmployee?.quarterScore ?? null)}`}</Tag>
                </Space>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title={TEXT.goalCount} value={selectedEmployee?.goalCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.keyResultCount} value={selectedEmployee?.keyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.scoredKeyResultCount} value={selectedEmployee?.scoredKeyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.proofCount} value={selectedEmployee?.proofCount ?? 0} />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless">
              <Tabs activeKey={selectedGoal?.id ?? goalId ?? undefined} items={goalTabs} onChange={(nextGoalId) => setGoalId(nextGoalId)} />

              {selectedGoal ? (
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  {isSelectedEmployeeReadonly ? <Alert type="info" showIcon message={TEXT.readonlyScopeMessage} /> : null}
                  <div className="page-hero">
                    <div>
                      <Typography.Title level={3} style={{ marginBottom: 6 }}>
                        {selectedGoal.code} {selectedGoal.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {selectedGoal.description ?? TEXT.goalDescriptionFallback}
                      </Typography.Paragraph>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag color={selectedGoal.status === 'confirmed' ? 'green' : 'default'}>
                        {getGoalStatusLabel(selectedGoal.status)}
                      </Tag>
                      <Tag>{`${selectedGoal.totalPoints} \u5206`}</Tag>
                      <Tag>{`${selectedGoal.keyResultCount} ${TEXT.goalKeyResultTag}`}</Tag>
                      <Tag>{`${selectedGoal.proofCount} ${TEXT.goalProofTag}`}</Tag>
                      <Tag>{`${TEXT.currentScoreTagPrefix} ${formatNullableScore(selectedGoal.currentScore)}`}</Tag>
                    </Space>
                  </div>

                  <div className="leader-kr-grid">
                    {filteredKeyResults.length ? (
                      filteredKeyResults.map((keyResult) => {
                        const draft = drafts[keyResult.id] ?? {
                          score: keyResult.reviewScore,
                          comment: keyResult.reviewComment ?? ''
                        };

                        return (
                          <Card key={keyResult.id} className="leader-kr-card" variant="borderless">
                            <Space direction="vertical" size={16} style={{ width: '100%' }}>
                              <div className="page-hero">
                                <div>
                                  <Typography.Title level={4} style={{ marginBottom: 6 }}>
                                    {keyResult.code} {keyResult.name}
                                  </Typography.Title>
                                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                                    {keyResult.description ?? TEXT.krDescriptionFallback}
                                  </Typography.Paragraph>
                                </div>
                                <Space wrap size={[8, 8]}>
                                  <Tag>{`${keyResult.points} \u5206`}</Tag>
                                  <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                                    {getScoreTypeLabel(keyResult.scoreType)}
                                  </Tag>
                                  <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                                    {getCompletionStateLabel(keyResult.completionState)}
                                  </Tag>
                                  <Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} ${TEXT.goalProofTag}`}</Tag>
                                </Space>
                              </div>

                              <Row gutter={[16, 16]}>
                                <Col xs={24} lg={8}>
                                  <Typography.Text strong>{TEXT.scoreLabel}</Typography.Text>
                                  <InputNumber
                                    style={{ width: '100%', marginTop: 8 }}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={draft.score ?? undefined}
                                    disabled={!keyResult.canScore}
                                    onChange={(value) =>
                                      updateDraft(keyResult.id, {
                                        score: typeof value === 'number' ? value : null
                                      })
                                    }
                                    onBlur={() => commitDraft(keyResult)}
                                  />
                                </Col>
                                <Col xs={24} lg={16}>
                                  <Typography.Text strong>{TEXT.commentLabel}</Typography.Text>
                                  <Input.TextArea
                                    rows={3}
                                    style={{ marginTop: 8 }}
                                    placeholder={TEXT.commentPlaceholder}
                                    value={draft.comment}
                                    disabled={!keyResult.canScore}
                                    onChange={(event) => updateDraft(keyResult.id, { comment: event.target.value })}
                                    onBlur={() => commitDraft(keyResult)}
                                  />
                                </Col>
                              </Row>

                              <div className="leader-proof-list">
                                {keyResult.proofs.length ? (
                                  keyResult.proofs.map((proof) => (
                                    <Card key={proof.id} size="small">
                                      <div className="leader-proof-row">
                                        <div className="leader-proof-meta">
                                          <Typography.Text strong>{proof.fileName}</Typography.Text>
                                          <Typography.Text type="secondary">{proof.note ?? '-'}</Typography.Text>
                                          <Typography.Text type="secondary">
                                            {new Date(proof.uploadedAt).toLocaleString()}
                                          </Typography.Text>
                                        </div>
                                        <a href={resolveApiUrl(proof.fileUrl)} target="_blank" rel="noreferrer">
                                          {TEXT.openFile}
                                        </a>
                                      </div>
                                    </Card>
                                  ))
                                ) : (
                                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.proofEmpty} />
                                )}
                              </div>
                            </Space>
                          </Card>
                        );
                      })
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.proofEmpty} />
                    )}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noGoals} />
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        open={isBulkModalOpen}
        title={TEXT.batchScore}
        okText={TEXT.batchSave}
        onOk={submitBulkScore}
        okButtonProps={{ loading: bulkScoreMutation.isPending, disabled: bulkScore === null }}
        onCancel={() => {
          setIsBulkModalOpen(false);
          resetBulkState();
        }}
        destroyOnHidden
        width={760}
      >
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.batchScoreIntro}
          </Typography.Paragraph>
          <Alert type="info" showIcon message={TEXT.batchObjectiveAlert} />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Typography.Text strong>{TEXT.bulkSectionFilter}</Typography.Text>
              <Select
                allowClear
                style={{ width: '100%', marginTop: 8 }}
                placeholder={TEXT.bulkSectionFilter}
                options={bulkSectionOptions}
                value={bulkSectionId ?? undefined}
                onChange={(value) => {
                  setBulkSectionId(value ?? null);
                  setBulkEmployeeIds([]);
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text strong>{TEXT.bulkReviewGroupFilter}</Typography.Text>
              <Select
                allowClear
                style={{ width: '100%', marginTop: 8 }}
                placeholder={TEXT.bulkReviewGroupFilter}
                options={bulkReviewGroupOptions}
                value={bulkReviewGroupId ?? undefined}
                onChange={(value) => {
                  setBulkReviewGroupId(value ?? null);
                  setBulkEmployeeIds([]);
                }}
              />
            </Col>
            <Col span={24}>
              <Typography.Text strong>{TEXT.bulkEmployeeFilter}</Typography.Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: 8 }}
                placeholder={TEXT.bulkEmployeePlaceholder}
                value={bulkEmployeeIds}
                onChange={(value) => {
                  setBulkEmployeeIds(value);
                  setBulkGoalIds([]);
                  setBulkKeyResultIds([]);
                  setBulkExcludeTemplateGoals(false);
                }}
                options={bulkVisibleEmployees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.name} / ${employee.sectionName ?? TEXT.sectionFallback} / ${employee.reviewGroupName ?? TEXT.reviewGroupFallback}${employee.canScore ? '' : '（只读）'}`
                }))}
                optionFilterProp="label"
              />
            </Col>
          </Row>

          <Space wrap>
            <Button onClick={handleSelectAllEmployees}>{TEXT.selectAllEmployees}</Button>
            <Button onClick={handleSelectAllGoals} disabled={!selectedEmployee || !visibleGoals.length}>
              {TEXT.selectAllGoals}
            </Button>
            <Button onClick={handleSelectAllKeyResults} disabled={!selectedGoal || !filteredKeyResults.length}>
              {TEXT.selectAllKeyResults}
            </Button>
            <Button onClick={handleSelectAllExcludeTemplates}>{TEXT.selectAllExcludeTemplates}</Button>
          </Space>

          <Typography.Text type="secondary">{TEXT.batchScopeHint}</Typography.Text>

          {bulkVisibleEmployees.length ? null : <Alert type="warning" showIcon message={TEXT.batchNoScopedEmployees} />}

          <Space wrap size={[8, 8]}>
            <Tag>{`${TEXT.batchScopeSummaryEmployeePrefix} ${bulkEmployeeIds.length || selectAllBulkEmployeeIds(workbenchQuery.data?.employees ?? [], { sectionId: bulkSectionId, reviewGroupId: bulkReviewGroupId }).length} \u4eba`}</Tag>
            <Tag>{`${TEXT.batchScopeSummaryGoalPrefix} ${selectedGoalScopeCount} \u4e2a`}</Tag>
            <Tag>{`${TEXT.batchScopeSummaryKrPrefix} ${selectedKeyResultScopeCount} \u6761`}</Tag>
            <Tag color={inScopeBulkEmployeeCount ? 'green' : 'default'}>{`\u53ef\u8bc4\u5206\u5458\u5de5 ${inScopeBulkEmployeeCount} \u4eba`}</Tag>
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Typography.Text strong>{TEXT.scoreLabel}</Typography.Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={0}
                max={100}
                step={0.5}
                placeholder={TEXT.batchScorePlaceholder}
                value={bulkScore ?? undefined}
                onChange={(value) => setBulkScore(typeof value === 'number' ? value : null)}
              />
            </Col>
            <Col xs={24} md={16}>
              <Typography.Text strong>{TEXT.commentLabel}</Typography.Text>
              <Input.TextArea
                rows={3}
                style={{ marginTop: 8 }}
                placeholder={TEXT.batchCommentPlaceholder}
                value={bulkComment}
                onChange={(event) => setBulkComment(event.target.value)}
              />
            </Col>
          </Row>

          <Checkbox checked={bulkOverwriteExisting} onChange={(event) => setBulkOverwriteExisting(event.target.checked)}>
            {TEXT.batchOverwriteExisting}
          </Checkbox>
        </Space>
      </Modal>
    </Space>
  );

  function updateDraft(krId: string, patch: Partial<ScoreDraft>) {
    setDrafts((current) => ({
      ...current,
      [krId]: {
        score: current[krId]?.score ?? null,
        comment: current[krId]?.comment ?? '',
        ...patch
      }
    }));
  }

  function commitDraft(keyResult: LeaderKeyResult) {
    if (!keyResult.canScore) {
      return;
    }

    const draft = drafts[keyResult.id];
    if (!draft || draft.score === null) {
      return;
    }

    if (draft.score === keyResult.reviewScore && draft.comment === (keyResult.reviewComment ?? '')) {
      return;
    }

    scoreMutation.mutate({
      krId: keyResult.id,
      draft
    });
  }

  function openBulkModal() {
    setIsBulkModalOpen(true);
    setBulkEmployeeIds(selectedEmployee ? [selectedEmployee.id] : []);
    setBulkGoalIds([]);
    setBulkKeyResultIds([]);
    setBulkScore(null);
    setBulkComment('');
    setBulkOverwriteExisting(false);
    setBulkExcludeTemplateGoals(false);
    setBulkSectionId(selectedEmployee?.sectionId ?? null);
    setBulkReviewGroupId(selectedEmployee?.reviewGroupId ?? null);
  }

  function resetBulkState() {
    setBulkSectionId(null);
    setBulkReviewGroupId(null);
    setBulkEmployeeIds([]);
    setBulkGoalIds([]);
    setBulkKeyResultIds([]);
    setBulkScore(null);
    setBulkComment('');
    setBulkOverwriteExisting(false);
    setBulkExcludeTemplateGoals(false);
  }

  function handleSelectAllEmployees() {
    setBulkEmployeeIds(
      selectAllBulkEmployeeIds(workbenchQuery.data?.employees ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId
      })
    );
    setBulkGoalIds([]);
    setBulkKeyResultIds([]);
    setBulkExcludeTemplateGoals(false);
  }

  function handleSelectAllGoals() {
    if (!selectedEmployee) {
      return;
    }

    setBulkEmployeeIds([selectedEmployee.id]);
    setBulkGoalIds(visibleGoals.map((goal) => goal.id));
    setBulkKeyResultIds([]);
    setBulkExcludeTemplateGoals(false);
  }

  function handleSelectAllKeyResults() {
    if (!selectedEmployee || !selectedGoal) {
      return;
    }

    setBulkEmployeeIds([selectedEmployee.id]);
    setBulkGoalIds([selectedGoal.id]);
    setBulkKeyResultIds(
      filteredKeyResults
        .filter((keyResult) => keyResult.scoreType === 'objective')
        .map((keyResult) => keyResult.id)
    );
    setBulkExcludeTemplateGoals(false);
  }

  function handleSelectAllExcludeTemplates() {
    setBulkEmployeeIds(
      bulkEmployeeIds.length
        ? bulkEmployeeIds
        : selectAllBulkEmployeeIds(workbenchQuery.data?.employees ?? [], {
            sectionId: bulkSectionId,
            reviewGroupId: bulkReviewGroupId
          })
    );
    setBulkGoalIds([]);
    setBulkKeyResultIds([]);
    setBulkExcludeTemplateGoals(true);
  }

  function submitBulkScore() {
    if (bulkScore === null) {
      message.warning(TEXT.batchNeedScore);
      return;
    }

    if (!bulkEmployeeIds.length && !bulkGoalIds.length && !bulkKeyResultIds.length) {
      message.warning(TEXT.batchNeedScope);
      return;
    }

    bulkScoreMutation.mutate();
  }
}
