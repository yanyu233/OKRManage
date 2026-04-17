import { CloseOutlined, FileTextOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
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
import { bulkLeaderKrScore, getLeaderWorkbench, updateLeaderKrScore, updateLeaderProofKnowledge } from '../../shared/api/leader';
import {
  formatNullableScore,
  formatQuarterLabel,
  getCompletionStateLabel,
  getGoalStatusLabel,
  getLeaderEmployeeStatusLabel,
  getScoreTypeLabel
} from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { LeaderKeyResult } from '../../shared/types/leader';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import {
  ALL_FILTER_VALUE,
  buildBulkScorePreview,
  buildWorkbenchFilterOptions,
  createScoreDrafts,
  filterBulkScoreEmployees,
  filterWorkbenchEmployees,
  filterWorkbenchEmployeesByProofStatus,
  filterWorkbenchGoals,
  filterWorkbenchGoalsByProofStatus,
  filterWorkbenchKeyResults,
  filterWorkbenchKeyResultsByProofStatus,
  resolveObjectiveBulkEmployeeIds,
  resolveWorkbenchSelection,
  selectAllBulkEmployeeIds,
  selectAllObjectiveKeyResultIds,
  type ScoreDraft
} from './leader-workbench.helpers';
import './leader.css';

const START_YEAR = 2026;
const T = {
  onlyWithProofs: '仅看有材料',
  title: '评分工作台',
  desc: '按责任范围查看员工季度 OKR，可切换时间、搜索对象，并逐条为关键结果评分。',
  loading: '正在加载评分工作台...',
  loadFailed: '评分工作台加载失败。',
  refresh: '刷新',
  search: '搜索员工、目标或关键结果',
  employeeList: '人员队列',
  employeeEmpty: '当前筛选条件下没有匹配员工',
  sectionFallback: '未分配科室',
  groupFallback: '未分配评价组',
  goalFallback: '暂无目标说明',
  krFallback: '暂无关键结果说明',
  noEmployee: '未选择员工',
  noGoals: '当前员工暂无目标',
  noVisibleGoals: '当前筛选条件下没有匹配目标',
  noVisibleKrs: '当前筛选条件下没有匹配关键结果',
  score: '评分',
  comment: '评分备注',
  commentPlaceholder: '输入评分备注',
  proofEmpty: '当前还没有上传证明材料',
  previewFile: '预览',
  downloadFile: '下载',
  markKnowledge: '标记为知识',
  knowledgeMarked: '已收录到知识库',
  knowledgeUnmarked: '已从知识库移除',
  knowledgeFailed: '知识标记更新失败。',
  goalCount: '目标数',
  krCount: '关键结果数',
  scoredKrCount: '已评分关键结果',
  proofCount: '证明材料',
  missingProofCount: '待补材料',
  quarterScore: '季度总分',
  readonly: '当前员工不在你的评分范围内，可查看目标、关键结果与材料，但不可修改评分。',
  batchTitle: '客观项批量评分',
  batchDesc: '先按科室、小组和员工过滤评分对象，再用快捷按钮快速选中需要批量处理的客观评分项。',
  sectionFilter: '按科室筛选',
  groupFilter: '按小组筛选',
  employeeFilter: '选择员工',
  employeeFilterPlaceholder: '可多选要批量评分的员工',
  selectAllKrs: '全选客观项关键结果',
  batchHint: '点击“全选客观项关键结果”后，会按当前科室、小组与员工筛选范围生成批量预览。',
  batchObjectiveOnly: '批量评分仅处理客观评分项，主观评分项会保留在工作台中逐条评分。',
  batchFullScore: '本次会将命中的客观评分项直接赋为各自配置的满分分值。',
  batchMissingProofTitle: (count: number) => `有 ${count} 条关键结果未提交材料，默认不会参与批量赋满分`,
  batchMissingProofDesc: '以下关键结果还没有上传证明材料；若确需直接赋满分，请勾选下方强制放行。',
  batchAllowMissingProofs: '允许对未提交材料的关键结果继续批量赋满分',
  batchSkippedMissingProofs: (updatedCount: number, skippedCount: number) =>
    `批量评分已完成，已更新 ${updatedCount} 项，${skippedCount} 项因未提交材料被自动跳过`,
  noScopedEmployees: '当前筛选范围内没有匹配员工',
  overwrite: '覆盖已有评分',
  batchCommentPlaceholder: '输入批量评分备注',
  batchSave: '批量赋满分',
  batchNeedScope: '请先选择员工，或使用全选按钮生成批量范围。',
  batchSaved: '批量评分已保存',
  batchSavedSkip: '批量评分完成，已更新',
  batchSkipSuffix: '项已自动跳过',
  employeeGoalsTag: '个目标',
  employeeKrsTag: '条关键结果',
  employeeScoredTag: '已评',
  employeeProofTag: '份材料',
  goalKrsTag: '条关键结果',
  goalProofTag: '份材料',
  currentScore: '当前得分',
  selectedEmployees: '已选员工',
  selectedGoals: '已选目标',
  selectedKrs: '已选关键结果',
  removeSelectedKr: (code: string, name: string) => `移除 ${code} ${name}`,
  previewEmpty: '当前范围内暂无可批量赋满分的客观评分项',
  templateGoal: '模板目标',
  readonlyRows: '预览列表仅展示你有评分权限的客观项，其他员工可在主界面继续查看。',
  readonlySuffix: '（只读）',
  canScoreEmployees: '可评分员工',
  cancel: '取消',
  onlyMissingProofs: '仅看材料未齐',
  proofReady: '材料已提交',
  proofMissing: '材料未提交',
  missingProofTag: (count: number) => `待补材料 ${count} 项`
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
  const [bulkKrIds, setBulkKrIds] = useState<string[] | null>(null);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkExcludeTemplates, setBulkExcludeTemplates] = useState(false);
  const [bulkAllowMissingProofs, setBulkAllowMissingProofs] = useState(false);
  const [onlyWithProofs, setOnlyWithProofs] = useState(false);

  const workbenchQuery = useQuery({
    queryKey: ['leader-workbench', year, quarter, employeeId, goalId],
    queryFn: () => getLeaderWorkbench({ year, quarter, employeeId, goalId })
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
      updateLeaderKrScore(krId, { score: draft.score ?? 0, comment: draft.comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '评分保存失败。')
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkLeaderKrScore({
        year,
        quarter,
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: bulkEmployeeIds.length ? bulkEmployeeIds : undefined,
        goalIds: bulkGoalIds.length ? bulkGoalIds : undefined,
        keyResultIds: bulkKrIds !== null ? bulkKrIds : undefined,
        comment: bulkComment.trim() || undefined,
        overwriteExisting: bulkOverwrite,
        excludeTemplateGoals: bulkExcludeTemplates,
        allowMissingProofs: bulkAllowMissingProofs
      }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
      const missingProofSkippedCount = payload.skipped.filter((entry) => entry.reason === 'proof-missing').length;
      if (missingProofSkippedCount > 0) {
        message.warning(T.batchSkippedMissingProofs(payload.updatedCount, missingProofSkippedCount));
      } else if (payload.skippedCount > 0) {
        message.warning(`${T.batchSavedSkip} ${payload.updatedCount} 项，${payload.skippedCount} ${T.batchSkipSuffix}`);
      } else {
        message.success(`${T.batchSaved} (${payload.updatedCount} 项)`);
      }
      setIsBulkOpen(false);
      resetBulk();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '批量评分保存失败。')
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

  const filteredEmployees = useMemo(() => {
    const scopedEmployees = filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
      sectionId: queueSectionId,
      reviewGroupId: queueReviewGroupId
    });

    return filterWorkbenchEmployees(
      filterWorkbenchEmployeesByProofStatus(scopedEmployees, onlyWithProofs),
      keyword
    );
  }, [keyword, onlyWithProofs, queueReviewGroupId, queueSectionId, workbenchQuery.data?.employees]);

  const selectedEmployeeVisible = filteredEmployees.some((employee) => employee.id === selectedEmployee?.id);
  const displaySelectedEmployee = selectedEmployeeVisible ? selectedEmployee : null;

  const visibleGoals = useMemo(() => {
    if (!displaySelectedEmployee) {
      return [];
    }

    const proofFilteredGoals = filterWorkbenchGoalsByProofStatus(workbenchQuery.data?.goals ?? [], onlyWithProofs);
    return filterWorkbenchGoals(proofFilteredGoals, keyword);
  }, [displaySelectedEmployee, keyword, onlyWithProofs, workbenchQuery.data?.goals]);

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

  useEffect(() => {
    if (!displaySelectedEmployee) {
      return;
    }

    if (!visibleGoals.length) {
      if (goalId !== null) {
        setGoalId(null);
      }
      return;
    }

    if (!visibleGoals.some((goal) => goal.id === goalId)) {
      setGoalId(visibleGoals[0]?.id ?? null);
    }
  }, [displaySelectedEmployee, goalId, visibleGoals]);

  const displaySelectedGoal = useMemo(() => {
    if (!selectedEmployeeVisible) {
      return null;
    }

    return selectedGoal && visibleGoals.some((goal) => goal.id === selectedGoal.id) ? selectedGoal : null;
  }, [selectedEmployeeVisible, selectedGoal, visibleGoals]);

  const filteredKeyResults = useMemo(() => {
    const keywordFiltered = filterWorkbenchKeyResults(displaySelectedGoal?.keyResults ?? [], keyword);
    return filterWorkbenchKeyResultsByProofStatus(keywordFiltered, onlyWithProofs);
  }, [displaySelectedGoal, keyword, onlyWithProofs]);

  const goalTabs = useMemo(
    () => visibleGoals.map((goal) => ({ key: goal.id, label: `${goal.code} ${goal.name}` })),
    [visibleGoals]
  );

  const { sections: bulkSectionOptions, reviewGroups: bulkReviewGroupOptions } = useMemo(
    () => buildWorkbenchFilterOptions(workbenchQuery.data?.employees ?? []),
    [workbenchQuery.data?.employees]
  );
  const bulkVisibleEmployees = useMemo(
    () =>
      filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId
      }),
    [bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.employees]
  );
  const bulkScopedEmployeeIds = useMemo(
    () =>
      selectAllBulkEmployeeIds(workbenchQuery.data?.employees ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId
      }),
    [bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.employees]
  );
  const bulkScorableEmployeeIds = useMemo(
    () => bulkVisibleEmployees.filter((employee) => employee.canScore).map((employee) => employee.id),
    [bulkVisibleEmployees]
  );
  const bulkPreview = useMemo(
    () =>
      buildBulkScorePreview(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: bulkEmployeeIds,
        goalIds: bulkGoalIds,
        keyResultIds: bulkKrIds,
        excludeTemplateGoals: bulkExcludeTemplates
      }),
    [bulkEmployeeIds, bulkExcludeTemplates, bulkGoalIds, bulkKrIds, bulkReviewGroupId, bulkSectionId, workbenchQuery.data?.bulkCatalog]
  );
  const canScoreCount = useMemo(
    () => bulkPreview.employees.filter((employee) => employee.canScore).length,
    [bulkPreview.employees]
  );
  const bulkMissingProofRows = useMemo(
    () => bulkPreview.rows.filter((entry) => entry.isProofMissing),
    [bulkPreview.rows]
  );
  const isReadonlyEmployee = Boolean(displaySelectedEmployee && !displaySelectedEmployee.canScore);
  const selectedEmployeeCount = bulkPreview.employees.length;

  if (workbenchQuery.isLoading) {
    return <Card className="leader-detail-card">{T.loading}</Card>;
  }

  if (workbenchQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert
          type="error"
          showIcon
          message={T.loadFailed}
          description={workbenchQuery.error instanceof ApiError ? workbenchQuery.error.message : undefined}
        />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {T.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {T.desc}
            </Typography.Paragraph>
          </div>
          <div className="page-toolbar__controls">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              className="page-toolbar__search"
              placeholder={T.search}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Checkbox
              className="leader-toolbar-proof-filter"
              checked={onlyWithProofs}
              onChange={(event) => setOnlyWithProofs(event.target.checked)}
            >
              {T.onlyWithProofs}
            </Checkbox>
            <YearQuarterPickerPopover
              year={year}
              quarter={quarter}
              yearOptions={yearOptions}
              quarterOptions={quarterOptions}
              onChange={(nextYear, nextQuarter) => {
                setPeriod(nextYear, nextQuarter);
                setEmployeeId(null);
                setGoalId(null);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>
              {T.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
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
                      className={`leader-selectable-card leader-employee-card ${
                        employee.id === displaySelectedEmployee?.id ? 'leader-selectable-card--active' : ''
                      }`}
                      onClick={() => {
                        setEmployeeId(employee.id);
                        setGoalId(null);
                      }}
                    >
                      <div className="leader-ranking-entry leader-employee-card__top">
                        <div className="leader-employee-card__meta">
                          <Typography.Title level={4} className="leader-employee-card__name" style={{ marginTop: 0, marginBottom: 4 }}>
                            {employee.name}
                          </Typography.Title>
                          <Typography.Paragraph
                            type="secondary"
                            className="leader-employee-card__subtitle"
                            style={{ marginBottom: 0 }}
                          >
                            {`${employee.sectionName ?? T.sectionFallback} / ${employee.reviewGroupName ?? T.groupFallback}`}
                          </Typography.Paragraph>
                        </div>
                        <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                          {getLeaderEmployeeStatusLabel(employee.status)}
                        </Tag>
                      </div>
                      <Space wrap size={[6, 6]} className="leader-card-tags">
                        <Tag>{`${employee.goalCount} ${T.employeeGoalsTag}`}</Tag>
                        <Tag>{`${employee.keyResultCount} ${T.employeeKrsTag}`}</Tag>
                        <Tag>{`${T.employeeScoredTag} ${employee.scoredKeyResultCount} 条`}</Tag>
                        <Tag>{`${employee.proofCount} ${T.employeeProofTag}`}</Tag>
                        {employee.missingProofKeyResultCount > 0 ? (
                          <Tag color="gold">{T.missingProofTag(employee.missingProofKeyResultCount)}</Tag>
                        ) : null}
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
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless">
              <div className="page-hero leader-page-hero leader-detail-card__hero">
                <div>
                  <Typography.Title level={2} className="leader-detail-card__title" style={{ marginBottom: 4 }}>
                    {displaySelectedEmployee?.name ?? T.noEmployee}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" className="leader-detail-card__subtitle" style={{ marginBottom: 0 }}>
                    {`${displaySelectedEmployee?.sectionName ?? T.sectionFallback} / ${
                      displaySelectedEmployee?.reviewGroupName ?? T.groupFallback
                    } / ${formatQuarterLabel(year, quarter)}`}
                  </Typography.Paragraph>
                </div>
                <Space size={10} wrap className="leader-detail-card__hero-tags">
                  <Button type="primary" onClick={openBulkModal} disabled={!workbenchQuery.data?.employees.length}>
                    {T.batchTitle}
                  </Button>
                  <Tag color="blue">{getLeaderEmployeeStatusLabel(displaySelectedEmployee?.status ?? 'pending')}</Tag>
                  <Tag icon={<TrophyOutlined />}>{`${T.quarterScore} ${formatNullableScore(displaySelectedEmployee?.quarterScore ?? null)}`}</Tag>
                </Space>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 14 }}>
                <Card variant="borderless" className="leader-summary-card">
                  <Statistic title={T.goalCount} value={displaySelectedEmployee?.goalCount ?? 0} />
                </Card>
                <Card variant="borderless" className="leader-summary-card">
                  <Statistic title={T.krCount} value={displaySelectedEmployee?.keyResultCount ?? 0} />
                </Card>
                <Card variant="borderless" className="leader-summary-card">
                  <Statistic title={T.scoredKrCount} value={displaySelectedEmployee?.scoredKeyResultCount ?? 0} />
                </Card>
                <Card variant="borderless" className="leader-summary-card">
                  <Statistic title={T.proofCount} value={displaySelectedEmployee?.proofCount ?? 0} />
                </Card>
                <Card variant="borderless" className="leader-summary-card">
                  <Statistic title={T.missingProofCount} value={displaySelectedEmployee?.missingProofKeyResultCount ?? 0} />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless">
              <Tabs
                className="leader-goal-tabs"
                activeKey={displaySelectedGoal?.id ?? undefined}
                items={goalTabs}
                onChange={(nextGoalId) => setGoalId(nextGoalId)}
              />

              {displaySelectedGoal ? (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  {isReadonlyEmployee ? <Alert type="info" showIcon message={T.readonly} /> : null}

                  <div className="page-hero leader-page-hero leader-goal-header">
                    <div>
                      <Typography.Title level={3} className="leader-goal-title" style={{ marginBottom: 4 }}>
                        {displaySelectedGoal.code} {displaySelectedGoal.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" className="leader-goal-desc" style={{ marginBottom: 0 }}>
                        {displaySelectedGoal.description ?? T.goalFallback}
                      </Typography.Paragraph>
                    </div>
                    <Space wrap size={[6, 6]} className="leader-card-tags leader-goal-tags">
                      <Tag color={displaySelectedGoal.status === 'completed' ? 'green' : displaySelectedGoal.status === 'pending-review' ? 'blue' : 'default'}>
                        {getGoalStatusLabel(displaySelectedGoal.status)}
                      </Tag>
                      <Tag>{`${displaySelectedGoal.totalPoints} 分`}</Tag>
                      <Tag>{`${displaySelectedGoal.keyResultCount} ${T.goalKrsTag}`}</Tag>
                      <Tag>{`${displaySelectedGoal.proofCount} ${T.goalProofTag}`}</Tag>
                      {displaySelectedGoal.missingProofKeyResultCount > 0 ? (
                        <Tag color="gold">{T.missingProofTag(displaySelectedGoal.missingProofKeyResultCount)}</Tag>
                      ) : null}
                      <Tag>{`${T.currentScore} ${formatNullableScore(displaySelectedGoal.currentScore)}`}</Tag>
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
                          <Card
                            key={keyResult.id}
                            className={`leader-kr-card${keyResult.isProofMissing ? ' leader-kr-card--warning' : ''}`}
                            variant="borderless"
                          >
                            <Space direction="vertical" size={12} style={{ width: '100%' }} className="leader-kr-card__content">
                              <div className="page-hero leader-page-hero leader-kr-header">
                                <div>
                                  <Typography.Title level={4} className="leader-kr-title" style={{ marginBottom: 4 }}>
                                    {keyResult.code} {keyResult.name}
                                  </Typography.Title>
                                  <Typography.Paragraph type="secondary" className="leader-kr-desc" style={{ marginBottom: 0 }}>
                                    {keyResult.description ?? T.krFallback}
                                  </Typography.Paragraph>
                                </div>
                                <Space wrap size={[6, 6]} className="leader-card-tags leader-kr-tags">
                                  <Tag>{`${keyResult.points} 分`}</Tag>
                                  <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                                    {getScoreTypeLabel(keyResult.scoreType)}
                                  </Tag>
                                  <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                                    {getCompletionStateLabel(keyResult.completionState)}
                                  </Tag>
                                  <Tag color={keyResult.isProofMissing ? 'gold' : 'blue'}>
                                    {keyResult.isProofMissing ? T.proofMissing : T.proofReady}
                                  </Tag>
                                  <Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} ${T.goalProofTag}`}</Tag>
                                  {keyResult.latestProofUploadedAt ? <Tag>{formatDateTime(keyResult.latestProofUploadedAt)}</Tag> : null}
                                </Space>
                              </div>

                              <Row gutter={[12, 12]} className="leader-kr-editor">
                                <Col xs={24} lg={8}>
                                  <Typography.Text strong className="leader-kr-field-label">
                                    {T.score}
                                  </Typography.Text>
                                  <InputNumber
                                    size="small"
                                    style={{ width: '100%', marginTop: 6 }}
                                    min={0}
                                    max={keyResult.points}
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
                                  <Typography.Text strong className="leader-kr-field-label">
                                    {T.comment}
                                  </Typography.Text>
                                  <Input.TextArea
                                    rows={2}
                                    style={{ marginTop: 6 }}
                                    placeholder={T.commentPlaceholder}
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
                                    <Card key={proof.id} size="small" className="leader-proof-card">
                                      <div className="leader-proof-row">
                                        <div className="leader-proof-meta">
                                          <Typography.Link href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer">
                                            {proof.fileName}
                                          </Typography.Link>
                                          <Typography.Text type="secondary">{proof.note ?? '-'}</Typography.Text>
                                          <Typography.Text type="secondary">{formatDateTime(proof.uploadedAt)}</Typography.Text>
                                        </div>
                                        <Space size={8} className="leader-proof-actions">
                                          <Checkbox
                                            checked={proof.isKnowledge}
                                            disabled={knowledgeMutation.isPending}
                                            onChange={(event) => toggleProofKnowledge(proof.id, event.target.checked)}
                                          >
                                            {T.markKnowledge}
                                          </Checkbox>
                                          <Button type="link" size="small" href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer">
                                            {T.previewFile}
                                          </Button>
                                          <Button type="link" size="small" href={resolveProofDownloadUrl(proof)} target="_blank" rel="noreferrer">
                                            {T.downloadFile}
                                          </Button>
                                        </Space>
                                      </div>
                                    </Card>
                                  ))
                                ) : (
                                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.proofEmpty} />
                                )}
                              </div>
                            </Space>
                          </Card>
                        );
                      })
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={onlyWithProofs ? T.noVisibleKrs : T.proofEmpty} />
                    )}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={visibleGoals.length ? T.noVisibleGoals : T.noGoals} />
              )}
            </Card>
          </Space>
        </Col>
      </Row>

      <Modal
        open={isBulkOpen}
        title={T.batchTitle}
        okText={T.batchSave}
        cancelText={T.cancel}
        onOk={submitBulkScore}
        okButtonProps={{ loading: bulkMutation.isPending, disabled: !bulkPreview.rows.length }}
        onCancel={() => {
          setIsBulkOpen(false);
          resetBulk();
        }}
        destroyOnHidden
        width={860}
      >
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {T.batchDesc}
          </Typography.Paragraph>
          <Alert type="info" showIcon message={T.batchObjectiveOnly} />
          <Alert type="success" showIcon message={T.batchFullScore} />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Typography.Text strong>{T.sectionFilter}</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                options={bulkSectionOptions}
                value={bulkSectionId ?? ALL_FILTER_VALUE}
                onChange={(value) => {
                  setBulkSectionId(value === ALL_FILTER_VALUE ? null : value);
                  setBulkEmployeeIds([]);
                  setBulkGoalIds([]);
                  setBulkKrIds(null);
                  setBulkExcludeTemplates(false);
                }}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text strong>{T.groupFilter}</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                options={bulkReviewGroupOptions}
                value={bulkReviewGroupId ?? ALL_FILTER_VALUE}
                onChange={(value) => {
                  setBulkReviewGroupId(value === ALL_FILTER_VALUE ? null : value);
                  setBulkEmployeeIds([]);
                  setBulkGoalIds([]);
                  setBulkKrIds(null);
                  setBulkExcludeTemplates(false);
                }}
              />
            </Col>
            <Col span={24}>
              <Typography.Text strong>{T.employeeFilter}</Typography.Text>
              <Select
                mode="multiple"
                style={{ width: '100%', marginTop: 8 }}
                placeholder={T.employeeFilterPlaceholder}
                value={bulkEmployeeIds}
                onChange={(value) => {
                  setBulkEmployeeIds(
                    value.filter((id) => bulkVisibleEmployees.some((employee) => employee.id === id && employee.canScore))
                  );
                  setBulkGoalIds([]);
                  setBulkKrIds(null);
                  setBulkExcludeTemplates(false);
                }}
                options={bulkVisibleEmployees.map((employee) => ({
                  value: employee.id,
                  label: `${employee.name} / ${employee.sectionName ?? T.sectionFallback} / ${
                    employee.reviewGroupName ?? T.groupFallback
                  }${employee.canScore ? '' : T.readonlySuffix}`,
                  disabled: !employee.canScore
                }))}
                optionFilterProp="label"
              />
            </Col>
          </Row>

          <Space wrap>
            <Button onClick={handleSelectAllKeyResults} disabled={!bulkScorableEmployeeIds.length}>
              {T.selectAllKrs}
            </Button>
          </Space>

          <Typography.Text type="secondary">{T.batchHint}</Typography.Text>
          {bulkVisibleEmployees.length ? null : <Alert type="warning" showIcon message={T.noScopedEmployees} />}

          <Space wrap size={[8, 8]}>
            <Tag>{`已选员工 ${selectedEmployeeCount} 人`}</Tag>
            <Tag>{`已选目标 ${bulkPreview.goals.length} 个`}</Tag>
            <Tag>{`已选关键结果 ${bulkPreview.keyResults.length} 条`}</Tag>
            <Tag color={canScoreCount ? 'green' : 'default'}>{`${T.canScoreEmployees} ${canScoreCount} 人`}</Tag>
            {bulkMissingProofRows.length ? <Tag color="gold">{T.missingProofTag(bulkMissingProofRows.length)}</Tag> : null}
          </Space>

          {bulkMissingProofRows.length ? (
            <Alert
              type="warning"
              showIcon
              message={T.batchMissingProofTitle(bulkMissingProofRows.length)}
              description={
                <div className="leader-bulk-warning-list">
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                    {T.batchMissingProofDesc}
                  </Typography.Paragraph>
                  <div className="leader-bulk-warning-items">
                    {bulkMissingProofRows.map((entry) => (
                      <div
                        key={`warning:${entry.employeeId}:${entry.goalId}:${entry.keyResultId}`}
                        className="leader-bulk-warning-item"
                      >
                        <Typography.Text strong>{`${entry.employeeName} / ${entry.goalCode} ${entry.goalName}`}</Typography.Text>
                        <Typography.Text type="secondary">{`${entry.keyResultCode} ${entry.keyResultName}`}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
          ) : null}

          <div className="leader-bulk-preview-grid">
            <Card size="small" title={T.selectedEmployees}>
              {bulkPreview.employees.length ? (
                <Space wrap size={[8, 8]}>
                  {bulkPreview.employees.map((employee) => (
                    <Tag key={employee.id} color={employee.canScore ? 'blue' : 'default'}>
                      {`${employee.name}${employee.canScore ? '' : T.readonlySuffix}`}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />
              )}
            </Card>

            <Card size="small" title={T.selectedGoals}>
              {bulkPreview.goals.length ? (
                <Space wrap size={[8, 8]}>
                  {bulkPreview.goals.map((goal) => (
                    <Tag key={`${goal.employeeId}:${goal.goalId}`} color={goal.isTemplateGoal ? 'gold' : 'default'}>
                      {`${goal.employeeName} / ${goal.goalCode} ${goal.goalName}`}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />
              )}
            </Card>
          </div>

          <Card size="small" title={T.selectedKrs}>
            {bulkPreview.rows.length ? (
              <div className="leader-bulk-kr-preview">
                {bulkPreview.rows.map((entry) => (
                  <div
                    key={`${entry.employeeId}:${entry.goalId}:${entry.keyResultId}`}
                    className={`leader-bulk-kr-row${entry.isProofMissing ? ' leader-bulk-kr-row--warning' : ''}`}
                  >
                    <div className="leader-bulk-kr-row__main">
                      <Typography.Text strong>{`${entry.employeeName} / ${entry.goalCode} ${entry.goalName}`}</Typography.Text>
                      <Typography.Text type="secondary">{`${entry.keyResultCode} ${entry.keyResultName}`}</Typography.Text>
                    </div>
                    <div className="leader-bulk-kr-row__actions">
                      <Space wrap size={[8, 8]} className="leader-bulk-kr-row__tags">
                        {entry.isTemplateGoal ? <Tag color="gold">{T.templateGoal}</Tag> : null}
                        <Tag>{`${entry.points} 分`}</Tag>
                        <Tag color="blue">{getScoreTypeLabel(entry.scoreType)}</Tag>
                        <Tag color={entry.isProofMissing ? 'gold' : 'blue'}>
                          {entry.isProofMissing ? T.proofMissing : T.proofReady}
                        </Tag>
                        <Tag icon={<FileTextOutlined />}>{`${entry.proofCount} ${T.goalProofTag}`}</Tag>
                        <Tag>{`${T.currentScore} ${formatNullableScore(entry.reviewScore)}`}</Tag>
                      </Space>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                        className="leader-bulk-kr-row__remove"
                        aria-label={T.removeSelectedKr(entry.keyResultCode, entry.keyResultName)}
                        onClick={() => removeBulkKeyResult(entry.keyResultId)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.previewEmpty} />
            )}
          </Card>

          {bulkPreview.readonlyRows > 0 ? <Alert type="warning" showIcon message={T.readonlyRows} /> : null}

          <div>
            <Typography.Text strong>{T.comment}</Typography.Text>
            <Input.TextArea
              rows={3}
              style={{ marginTop: 8 }}
              placeholder={T.batchCommentPlaceholder}
              value={bulkComment}
              onChange={(event) => setBulkComment(event.target.value)}
            />
          </div>

          <Checkbox checked={bulkOverwrite} onChange={(event) => setBulkOverwrite(event.target.checked)}>
            {T.overwrite}
          </Checkbox>
          {bulkMissingProofRows.length ? (
            <Checkbox
              checked={bulkAllowMissingProofs}
              onChange={(event) => setBulkAllowMissingProofs(event.target.checked)}
            >
              {T.batchAllowMissingProofs}
            </Checkbox>
          ) : null}
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

    scoreMutation.mutate({ krId: keyResult.id, draft });
  }

  function openBulkModal() {
    setIsBulkOpen(true);
    setBulkEmployeeIds([]);
    setBulkGoalIds([]);
    setBulkKrIds(null);
    setBulkComment('');
    setBulkOverwrite(false);
    setBulkExcludeTemplates(false);
    setBulkAllowMissingProofs(false);
    setBulkSectionId(null);
    setBulkReviewGroupId(null);
  }

  function resetBulk() {
    setBulkSectionId(null);
    setBulkReviewGroupId(null);
    setBulkEmployeeIds([]);
    setBulkGoalIds([]);
    setBulkKrIds(null);
    setBulkComment('');
    setBulkOverwrite(false);
    setBulkExcludeTemplates(false);
    setBulkAllowMissingProofs(false);
  }

  function handleSelectAllKeyResults() {
    const nextEmployeeIds = resolveObjectiveBulkEmployeeIds(
      bulkEmployeeIds.length ? bulkEmployeeIds : bulkScopedEmployeeIds,
      bulkScorableEmployeeIds
    );
    if (!nextEmployeeIds.length) {
      return;
    }

    setBulkEmployeeIds(nextEmployeeIds);
    setBulkKrIds(
      selectAllObjectiveKeyResultIds(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: nextEmployeeIds,
        goalIds: bulkGoalIds,
        excludeTemplateGoals: bulkExcludeTemplates
      })
    );
  }

  function removeBulkKeyResult(keyResultId: string) {
    const currentKeyResultIds = bulkKrIds ?? bulkPreview.keyResults.map((entry) => entry.keyResultId);
    setBulkKrIds(currentKeyResultIds.filter((currentKeyResultId) => currentKeyResultId !== keyResultId));
  }

  function toggleProofKnowledge(proofId: string, isKnowledge: boolean) {
    knowledgeMutation.mutate({ proofId, isKnowledge });
  }

  function resolveProofPreviewUrl(proof: LeaderKeyResult['proofs'][number]) {
    return resolveApiUrl(proof.previewUrl ?? proof.fileUrl);
  }

  function resolveProofDownloadUrl(proof: LeaderKeyResult['proofs'][number]) {
    return resolveApiUrl(proof.downloadUrl ?? proof.fileUrl);
  }

  function submitBulkScore() {
    if (!bulkPreview.rows.length) {
      message.warning(T.batchNeedScope);
      return;
    }

    bulkMutation.mutate();
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
