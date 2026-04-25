import {
  CloseOutlined,
  FileTextOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, resolveApiUrl, resolveAppAwareUrl } from '../../shared/api/http';
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
import { useSessionStore } from '../../shared/store/session-store';
import type { LeaderKeyResult } from '../../shared/types/leader';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import {
  ALL_FILTER_VALUE,
  buildBulkGoalFilterKey,
  buildBulkKeyResultFilterKey,
  buildBulkTemplateKeyResultFilterKey,
  buildBulkScorePreview,
  buildSubjectiveBulkAveragePreview,
  buildSubjectiveBulkScoreMatrix,
  buildWorkbenchFilterOptions,
  createScoreDrafts,
  createSubjectiveBulkScoreDrafts,
  filterBulkScoreEmployees,
  filterWorkbenchEmployees,
  filterWorkbenchEmployeesByProofStatus,
  filterWorkbenchGoals,
  filterWorkbenchGoalsByProofStatus,
  filterWorkbenchKeyResults,
  filterWorkbenchKeyResultsByProofStatus,
  isSameScoreDraftMap,
  resolveWorkbenchQueueFilters,
  resolveWorkbenchQueueSelection,
  resolveObjectiveBulkEmployeeIds,
  resolveWorkbenchSelection,
  selectAllBulkEmployeeIds,
  selectAllBulkKeyResultIds,
  selectAllUnscoredBulkKeyResultIds,
  type ScoreDraft
} from './leader-workbench.helpers';
import './leader.css';

const START_YEAR = 2026;
const SHOW_WORKBENCH_HINT_TAGS = false;
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
  selectAllUnscoredKrs: '全选未评价关键结果',
  batchHint: '点击快捷按钮后，会按当前科室、小组与员工筛选范围生成批量预览。',
  batchObjectiveOnly: '批量评分仅处理客观评分项，主观评分项会保留在工作台中逐条评分。',
  batchFullScore: '本次会将命中的客观评分项直接赋为各自配置的满分分值。',
  batchCustomScoreSummary: (score: number | null) =>
    score === null ? '请为本次批量评分输入统一分值。' : `本次会将命中的客观评分项统一赋分为 ${score} 分。`,
  batchModeLabel: '赋分方式',
  batchModeFull: '按满分赋分',
  batchModeCustom: '按自定义分数',
  batchCustomScoreLabel: '自定义分数',
  batchCustomScorePlaceholder: '输入统一赋分',
  batchCustomScoreHint: (maxScore: number | null) =>
    maxScore === null ? '请先生成批量预览，再输入自定义分数。' : `当前已选范围内，统一赋分最高可输入 ${maxScore} 分。`,
  batchCustomScoreRequired: '请先输入自定义分数。',
  batchCustomScoreExceeded: (score: number, maxScore: number) =>
    `自定义分数 ${score} 分已超过当前已选关键结果的最低分值 ${maxScore} 分，请调整后再批量赋分。`,
  batchMissingProofTitle: (count: number) => `有 ${count} 条关键结果未提交材料，默认不会参与批量赋分`,
  batchMissingProofDesc: '以下关键结果还没有上传证明材料；若确需继续批量赋分，请勾选下方强制放行。',
  batchAllowMissingProofs: '允许对未提交材料的关键结果继续批量赋分',
  bulkExcludeTemplateGoals: '排除模板目标',
  bulkExcludeTemplateGoalsToggle: '全部排除',
  bulkExcludeSpecificTemplateGoals: '排除指定模板目标',
  bulkExcludeSpecificTemplateGoalsPlaceholder: '可多选要排除的模板目标',
  bulkExcludeTemplateKeyResults: '排除模板关键结果',
  bulkExcludeTemplateKeyResultsPlaceholder: '选择要排除的模板关键结果',
  bulkTemplateFilterHint: '模板目标内容相同的公共项，可以在这里一次性排除。',
  bulkExcludedTemplateTag: '已排除模板目标',
  bulkExcludedTemplateGoalTag: (count: number) => `已排除模板目标 ${count} 个`,
  bulkExcludedTemplateKeyResultTag: (count: number) => `已排除模板 KR ${count} 项`,
  bulkOnlyTemplateGoal: '仅选择模板目标',
  bulkOnlyTemplateGoalPlaceholder: '可多选模板目标',
  bulkOnlyTemplateKeyResults: '仅选择模板目标的关键结果',
  bulkOnlyTemplateKeyResultsPlaceholder: '不选则包含所选模板目标下全部客观项',
  bulkOnlyTemplateHint: '选择后，只会批量所选模板目标；如再选择关键结果，会继续缩小到所选项。',
  bulkOnlyTemplateTag: '仅模板目标',
  bulkOnlyTemplateGoalTag: (count: number) => `已限定模板目标 ${count} 个`,
  bulkOnlyTemplateKeyResultTag: (count: number) => `模板 KR 已限定 ${count} 项`,
  batchSkippedMissingProofs: (updatedCount: number, skippedCount: number) =>
    `批量评分已完成，已更新 ${updatedCount} 项，${skippedCount} 项因未提交材料被自动跳过`,
  noScopedEmployees: '当前筛选范围内没有匹配员工',
  overwrite: '覆盖已有评分',
  batchCommentPlaceholder: '输入批量评分备注',
  batchSave: '批量赋分',
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
  previewEmpty: '当前范围内暂无可批量赋分的客观评分项',
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

const BATCH_UI = {
  title: '关键结果批量评分',
  desc: '先按科室、小组和员工过滤评分对象，再用快捷按钮快速选中需要批量处理的关键结果。',
  selectAll: '全选客观项关键结果',
  selectAllUnscored: '全选未评价关键结果',
  scopeNote: '左侧快捷按钮仅选客观项；右侧会选中当前范围内所有未评价关键结果。是否覆盖已有评分可在下方单独控制。',
  fullScore: '本次会将命中的关键结果直接赋为各自配置的满分分值。',
  customScoreSummary: (score: number | null) =>
    score === null ? '请为本次批量评分输入统一分值。' : `本次会将命中的关键结果统一赋分为 ${score} 分。`,
  previewEmpty: '当前范围内暂无可批量赋分的关键结果',
  readonlyRows: '预览列表仅展示你有评分权限的关键结果，其他员工可在主界面中继续查看。'
} as const;

const SUBJECTIVE_BATCH_UI = {
  title: '主观项批量评分',
  desc: '按科室一次性录入本季度主观评分项，页面会实时校验每个主观项在该科室内的平均分上限。',
  sectionLabel: '评分科室',
  averageHint: '平均分按该科室本季度全部参评人计算。',
  averageRow: '当前平均分',
  averageLimit: '平均上限',
  participantCount: '参评人数',
  noSection: '当前没有可批量评分的科室',
  noRows: '当前科室暂无可批量录入的主观评分项',
  noCell: '—',
  save: '批量保存主观项',
  saveHint: '本次仅保存你在表格内修改过的分数。',
  saveSuccess: (count: number) => `主观项批量评分已保存（${count} 项）`,
  averageExceeded: '存在平均分超上限的主观项，请先调整后再保存。',
  scoreHeader: (points: number) => `满分 ${points} 分`,
  limitHeader: (score: number) => `平均上限 ${score.toFixed(1)} 分`
} as const;

const WORKBENCH_META = {
  objective: {
    title: '客观项评分工作台',
    description: '按现有评分范围查看并评价客观评分项，支持批量赋分和材料核验。',
    bulkEnabled: true
  },
  subjective: {
    title: '主观项评分工作台',
    description: '仅按科室负责人权限查看并评价主观评分项，严格按科室范围隔离。',
    bulkEnabled: true
  }
} as const;

export function LeaderObjectiveWorkbenchPage() {
  return <LeaderWorkbenchPageInner scoreType="objective" />;
}

export function LeaderSubjectiveWorkbenchPage() {
  return <LeaderWorkbenchPageInner scoreType="subjective" />;
}

function LeaderWorkbenchPageInner({ scoreType }: { scoreType: 'objective' | 'subjective' }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const workbenchMeta = WORKBENCH_META[scoreType];
  const isObjectiveWorkbench = scoreType === 'objective';
  const isSubjectiveWorkbench = scoreType === 'subjective';
  const isKnowledgeEditor = useSessionStore((state) =>
    (state.user?.roles ?? []).some((assignment) => assignment.role === 'section-leader' || assignment.role === 'group-leader')
  );
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
  const [bulkScoreMode, setBulkScoreMode] = useState<'full' | 'custom'>('full');
  const [bulkCustomScore, setBulkCustomScore] = useState<number | null>(null);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  const [bulkExcludeTemplates, setBulkExcludeTemplates] = useState(false);
  const [bulkExcludedTemplateGoalKeys, setBulkExcludedTemplateGoalKeys] = useState<string[]>([]);
  const [bulkExcludedTemplateKeyResultKeys, setBulkExcludedTemplateKeyResultKeys] = useState<string[]>([]);
  const [bulkIncludedTemplateGoalKeys, setBulkIncludedTemplateGoalKeys] = useState<string[]>([]);
  const [bulkIncludedTemplateKeyResultKeys, setBulkIncludedTemplateKeyResultKeys] = useState<string[]>([]);
  const [bulkAllowMissingProofs, setBulkAllowMissingProofs] = useState(false);
  const [subjectiveBulkSectionId, setSubjectiveBulkSectionId] = useState<string | null>(null);
  const [subjectiveBulkDrafts, setSubjectiveBulkDrafts] = useState<Record<string, ScoreDraft>>({});
  const [onlyWithProofs, setOnlyWithProofs] = useState(false);
  const goalStripViewportRef = useRef<HTMLDivElement | null>(null);
  const goalStripMomentumFrameRef = useRef<number | null>(null);
  const goalStripSuppressClickUntilRef = useRef(0);
  const goalStripPointerRef = useRef({
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastTimestamp: 0,
    velocity: 0,
    moved: false
  });
  const [goalStripCanScrollLeft, setGoalStripCanScrollLeft] = useState(false);
  const [goalStripCanScrollRight, setGoalStripCanScrollRight] = useState(false);
  const [isGoalStripDragging, setIsGoalStripDragging] = useState(false);

  const workbenchQuery = useQuery({
    queryKey: ['leader-workbench', scoreType, year, quarter, employeeId, goalId],
    queryFn: () => getLeaderWorkbench({ year, quarter, scoreType, employeeId, goalId }),
    placeholderData: keepPreviousData
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
    const nextDrafts = createScoreDrafts(workbenchQuery.data.selectedGoal);
    setDrafts((currentDrafts) => (isSameScoreDraftMap(currentDrafts, nextDrafts) ? currentDrafts : nextDrafts));
  }, [employeeId, goalId, workbenchQuery.data]);

  const scoreMutation = useMutation({
    mutationFn: ({ krId, draft }: { krId: string; draft: ScoreDraft; keyResult: LeaderKeyResult }) =>
      updateLeaderKrScore(krId, { score: draft.score ?? 0, comment: draft.comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
    },
    onError: (error, variables) => {
      resetDraftToPersisted(variables.keyResult);
      message.error(error instanceof ApiError ? error.message : '评分保存失败。');
    }
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
        keyResultIds: bulkKrIds !== null ? Array.from(new Set(bulkPreview.rows.map((entry) => entry.keyResultId))) : undefined,
        score: bulkScoreMode === 'custom' ? bulkCustomScore ?? undefined : undefined,
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

  const subjectiveBulkMutation = useMutation({
    mutationFn: () =>
      bulkLeaderKrScore({
        year,
        quarter,
        sectionId: subjectiveBulkSectionId,
        entries: subjectiveBulkChangedEntries.map((entry) => ({
          keyResultId: entry.keyResultId,
          score: entry.score
        })),
        overwriteExisting: true
      }),
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
      message.success(SUBJECTIVE_BATCH_UI.saveSuccess(payload.updatedCount));
      setIsBulkOpen(false);
      resetSubjectiveBulk();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : '主观项批量评分保存失败。')
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
  const queueFilters = useMemo(
    () =>
      resolveWorkbenchQueueFilters(workbenchQuery.data?.employees ?? [], {
        sectionId: queueSectionId,
        reviewGroupId: queueReviewGroupId
      }),
    [queueReviewGroupId, queueSectionId, workbenchQuery.data?.employees]
  );
  const queueReviewGroupOptions = useMemo(
    () =>
      buildWorkbenchFilterOptions(
        filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
          sectionId: queueFilters.sectionId
        })
      ).reviewGroups,
    [queueFilters.sectionId, workbenchQuery.data?.employees]
  );

  const filteredEmployees = useMemo(() => {
    const scopedEmployees = filterBulkScoreEmployees(workbenchQuery.data?.employees ?? [], {
      sectionId: queueFilters.sectionId,
      reviewGroupId: queueFilters.reviewGroupId
    });

    return filterWorkbenchEmployees(
      filterWorkbenchEmployeesByProofStatus(scopedEmployees, onlyWithProofs),
      keyword
    );
  }, [keyword, onlyWithProofs, queueFilters.reviewGroupId, queueFilters.sectionId, workbenchQuery.data?.employees]);

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
    if (queueReviewGroupId !== queueFilters.reviewGroupId) {
      setQueueReviewGroupId(queueFilters.reviewGroupId);
    }
  }, [queueFilters.reviewGroupId, queueReviewGroupId]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      if (employeeId !== null) {
        setEmployeeId(null);
      }
      if (goalId !== null) {
        setGoalId(null);
      }
      return;
    }

    if (!selectedEmployeeVisible && employeeId !== filteredEmployees[0]?.id) {
      setEmployeeId(filteredEmployees[0]?.id ?? null);
      setGoalId(null);
    }
  }, [employeeId, filteredEmployees, goalId, selectedEmployeeVisible]);

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
    () => visibleGoals.map((goal) => ({ id: goal.id, label: `${goal.code} ${goal.name}` })),
    [visibleGoals]
  );
  const activeGoalTabId = displaySelectedGoal?.id ?? visibleGoals[0]?.id ?? null;

  const updateGoalStripAffordance = () => {
    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      setGoalStripCanScrollLeft(false);
      setGoalStripCanScrollRight(false);
      return;
    }

    setGoalStripCanScrollLeft(viewport.scrollLeft > 4);
    setGoalStripCanScrollRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 4);
  };

  const stopGoalStripMomentum = () => {
    if (goalStripMomentumFrameRef.current !== null) {
      window.cancelAnimationFrame(goalStripMomentumFrameRef.current);
      goalStripMomentumFrameRef.current = null;
    }
  };

  const startGoalStripMomentum = (initialVelocity: number) => {
    stopGoalStripMomentum();
    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      return;
    }

    let velocity = initialVelocity;
    let lastTimestamp = Date.now();

    const tick = () => {
      const currentViewport = goalStripViewportRef.current;
      if (!currentViewport) {
        stopGoalStripMomentum();
        return;
      }

      const now = Date.now();
      const deltaTime = Math.max(1, now - lastTimestamp);
      lastTimestamp = now;
      const previousScrollLeft = currentViewport.scrollLeft;
      currentViewport.scrollLeft += velocity * deltaTime;
      const movedDistance = Math.abs(currentViewport.scrollLeft - previousScrollLeft);
      velocity *= Math.pow(0.92, deltaTime / 16);

      if (movedDistance < 0.2 || Math.abs(velocity) < 0.02) {
        goalStripMomentumFrameRef.current = null;
        updateGoalStripAffordance();
        return;
      }

      goalStripMomentumFrameRef.current = window.requestAnimationFrame(tick);
    };

    goalStripMomentumFrameRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      updateGoalStripAffordance();
      return;
    }

    updateGoalStripAffordance();
    const handleScroll = () => updateGoalStripAffordance();
    viewport.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateGoalStripAffordance());
      resizeObserver.observe(viewport);
    }

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
      stopGoalStripMomentum();
    };
  }, [goalTabs.length]);

  useEffect(() => {
    if (!activeGoalTabId || !goalStripViewportRef.current) {
      return;
    }

    const activeTab = goalStripViewportRef.current.querySelector<HTMLElement>(`[data-goal-tab-id="${activeGoalTabId}"]`);
    activeTab?.scrollIntoView({
      behavior: isGoalStripDragging ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
    updateGoalStripAffordance();
  }, [activeGoalTabId, isGoalStripDragging]);

  const { sections: bulkSectionOptions, reviewGroups: bulkReviewGroupOptions } = useMemo(
    () => buildWorkbenchFilterOptions(workbenchQuery.data?.employees ?? []),
    [workbenchQuery.data?.employees]
  );
  const subjectiveBulkSectionOptions = useMemo(
    () => buildWorkbenchFilterOptions((workbenchQuery.data?.employees ?? []).filter((employee) => employee.canScore)).sections,
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
  const bulkTemplateScopeEmployeeIds = useMemo(
    () => (bulkEmployeeIds.length ? bulkEmployeeIds : bulkScorableEmployeeIds),
    [bulkEmployeeIds, bulkScorableEmployeeIds]
  );
  const bulkTemplateGoalOptions = useMemo(() => {
    const scopedEmployeeIds = new Set(bulkTemplateScopeEmployeeIds);

    return Array.from(
      new Map(
        (workbenchQuery.data?.bulkCatalog ?? [])
          .filter((employee) => scopedEmployeeIds.has(employee.id))
          .flatMap((employee) =>
            employee.goals
              .filter((goal) => goal.isTemplateGoal)
              .map((goal) => {
                const value = buildBulkGoalFilterKey(goal);
                return [
                  value,
                  {
                    value,
                    label: `${goal.code} ${goal.name}`
                  }
                ] as const;
              })
          )
      ).values()
    );
  }, [bulkTemplateScopeEmployeeIds, workbenchQuery.data?.bulkCatalog]);
  const bulkExcludedTemplateKeyResultOptions = useMemo(() => {
    if (bulkExcludeTemplates) {
      return [];
    }

    const scopedEmployeeIds = new Set(bulkTemplateScopeEmployeeIds);

    return Array.from(
      new Map(
        (workbenchQuery.data?.bulkCatalog ?? [])
          .filter((employee) => scopedEmployeeIds.has(employee.id))
          .flatMap((employee) =>
            employee.goals
              .filter((goal) => goal.isTemplateGoal)
              .flatMap((goal) =>
                goal.keyResults
                  .filter((keyResult) => keyResult.scoreType === 'objective')
                  .map((keyResult) => {
                    const value = buildBulkTemplateKeyResultFilterKey(goal, keyResult);
                    const goalValue = buildBulkGoalFilterKey(goal);
                    return [
                      value,
                      {
                        value,
                        goalValue,
                        label: `${goal.code} ${goal.name} / ${keyResult.code} ${keyResult.name}`
                      }
                    ] as const;
                  })
              )
          )
      ).values()
    );
  }, [bulkExcludeTemplates, bulkTemplateScopeEmployeeIds, workbenchQuery.data?.bulkCatalog]);
  const bulkExcludedTemplateKeyResultGoalKeyMap = useMemo(
    () => new Map(bulkExcludedTemplateKeyResultOptions.map((option) => [option.value, option.goalValue])),
    [bulkExcludedTemplateKeyResultOptions]
  );
  const bulkIncludedTemplateKeyResultOptions = useMemo(() => {
    if (!bulkIncludedTemplateGoalKeys.length) {
      return [];
    }

    const scopedEmployeeIds = new Set(bulkTemplateScopeEmployeeIds);

    return Array.from(
      new Map(
        (workbenchQuery.data?.bulkCatalog ?? [])
          .filter((employee) => scopedEmployeeIds.has(employee.id))
          .flatMap((employee) =>
            employee.goals
              .filter(
                (goal) => goal.isTemplateGoal && bulkIncludedTemplateGoalKeys.includes(buildBulkGoalFilterKey(goal))
              )
              .flatMap((goal) =>
                goal.keyResults
                  .filter((keyResult) => keyResult.scoreType === 'objective')
                  .map((keyResult) => {
                    const value = buildBulkKeyResultFilterKey(goal, keyResult);
                    return [
                      value,
                      {
                        value,
                        label: `${goal.code} ${goal.name} / ${keyResult.code} ${keyResult.name}`
                      }
                    ] as const;
                  })
              )
          )
      ).values()
    );
  }, [bulkIncludedTemplateGoalKeys, bulkTemplateScopeEmployeeIds, workbenchQuery.data?.bulkCatalog]);
  const bulkPreview = useMemo(
    () =>
      buildBulkScorePreview(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: bulkEmployeeIds,
        goalIds: bulkGoalIds,
        keyResultIds: bulkKrIds,
        excludeTemplateGoals: bulkExcludeTemplates,
        excludedTemplateGoalKeys: bulkExcludedTemplateGoalKeys,
        excludedTemplateKeyResultKeys: bulkExcludedTemplateKeyResultKeys,
        includedTemplateGoalKeys: bulkIncludedTemplateGoalKeys,
        includedTemplateKeyResultKeys: bulkIncludedTemplateKeyResultKeys
      }),
    [
      bulkEmployeeIds,
      bulkExcludeTemplates,
      bulkExcludedTemplateGoalKeys,
      bulkExcludedTemplateKeyResultKeys,
      bulkIncludedTemplateGoalKeys,
      bulkIncludedTemplateKeyResultKeys,
      bulkGoalIds,
      bulkKrIds,
      bulkReviewGroupId,
      bulkSectionId,
      workbenchQuery.data?.bulkCatalog
    ]
  );
  const canScoreCount = useMemo(
    () => bulkPreview.employees.filter((employee) => employee.canScore).length,
    [bulkPreview.employees]
  );
  const bulkMissingProofRows = useMemo(
    () => bulkPreview.rows.filter((entry) => entry.isProofMissing),
    [bulkPreview.rows]
  );
  const bulkCustomScoreMax = useMemo(() => {
    if (!bulkPreview.rows.length) {
      return null;
    }

    return bulkPreview.rows.reduce((min, entry) => Math.min(min, entry.points), bulkPreview.rows[0].points);
  }, [bulkPreview.rows]);
  const bulkCustomScoreExceeded =
    bulkScoreMode === 'custom' &&
    bulkCustomScore !== null &&
    bulkCustomScoreMax !== null &&
    bulkCustomScore > bulkCustomScoreMax;
  const isBulkSubmitDisabled =
    !bulkPreview.rows.length || (bulkScoreMode === 'custom' && (bulkCustomScore === null || bulkCustomScoreExceeded));
  const subjectiveBulkMatrix = useMemo(
    () =>
      buildSubjectiveBulkScoreMatrix(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: subjectiveBulkSectionId
      }),
    [subjectiveBulkSectionId, workbenchQuery.data?.bulkCatalog]
  );
  const subjectiveBulkAveragePreview = useMemo(
    () => buildSubjectiveBulkAveragePreview(subjectiveBulkMatrix.columns, subjectiveBulkMatrix.rows, subjectiveBulkDrafts),
    [subjectiveBulkDrafts, subjectiveBulkMatrix.columns, subjectiveBulkMatrix.rows]
  );
  const subjectiveBulkAveragePreviewMap = useMemo(
    () => new Map(subjectiveBulkAveragePreview.map((column) => [column.key, column])),
    [subjectiveBulkAveragePreview]
  );
  const subjectiveBulkChangedEntries = useMemo(
    () =>
      subjectiveBulkMatrix.rows.flatMap((row) =>
        Object.values(row.cells)
          .filter((cell): cell is NonNullable<(typeof row.cells)[string]> => Boolean(cell))
          .flatMap((cell) => {
            const draft = subjectiveBulkDrafts[cell.keyResultId];
            const nextScore = draft?.score ?? cell.reviewScore;
            if (nextScore === null || nextScore === cell.reviewScore) {
              return [];
            }

            return [
              {
                keyResultId: cell.keyResultId,
                score: nextScore
              }
            ];
          })
      ),
    [subjectiveBulkDrafts, subjectiveBulkMatrix.rows]
  );
  const subjectiveBulkExceededColumns = useMemo(
    () => subjectiveBulkAveragePreview.filter((column) => column.exceeded),
    [subjectiveBulkAveragePreview]
  );
  const isReadonlyEmployee = Boolean(displaySelectedEmployee && !displaySelectedEmployee.canScore);
  const selectedEmployeeCount = bulkPreview.employees.length;

  useEffect(() => {
    const validValues = new Set(bulkExcludedTemplateKeyResultOptions.map((option) => option.value));
    const nextValues = bulkExcludedTemplateKeyResultKeys.filter((value) => validValues.has(value));
    if (nextValues.length !== bulkExcludedTemplateKeyResultKeys.length) {
      setBulkExcludedTemplateKeyResultKeys(nextValues);
    }
  }, [bulkExcludedTemplateKeyResultKeys, bulkExcludedTemplateKeyResultOptions]);

  useEffect(() => {
    const validValues = new Set(bulkTemplateGoalOptions.map((option) => option.value));
    const nextValues = bulkExcludedTemplateGoalKeys.filter((value) => validValues.has(value));
    if (nextValues.length !== bulkExcludedTemplateGoalKeys.length) {
      setBulkExcludedTemplateGoalKeys(nextValues);
    }
  }, [bulkExcludedTemplateGoalKeys, bulkTemplateGoalOptions]);

  useEffect(() => {
    const validValues = new Set(bulkTemplateGoalOptions.map((option) => option.value));
    const nextValues = bulkIncludedTemplateGoalKeys.filter((value) => validValues.has(value));
    if (nextValues.length !== bulkIncludedTemplateGoalKeys.length) {
      setBulkIncludedTemplateGoalKeys(nextValues);
    }
  }, [bulkIncludedTemplateGoalKeys, bulkTemplateGoalOptions]);

  useEffect(() => {
    const validValues = new Set(bulkIncludedTemplateKeyResultOptions.map((option) => option.value));
    const nextValues = bulkIncludedTemplateKeyResultKeys.filter((value) => validValues.has(value));
    if (nextValues.length !== bulkIncludedTemplateKeyResultKeys.length) {
      setBulkIncludedTemplateKeyResultKeys(nextValues);
    }
  }, [bulkIncludedTemplateKeyResultKeys, bulkIncludedTemplateKeyResultOptions]);

  useEffect(() => {
    if (!isSubjectiveWorkbench || !isBulkOpen) {
      return;
    }

    const availableSectionIds = subjectiveBulkSectionOptions
      .map((option) => option.value)
      .filter((value): value is string => value !== ALL_FILTER_VALUE);
    const preferredSectionId =
      displaySelectedEmployee?.sectionId && availableSectionIds.includes(displaySelectedEmployee.sectionId)
        ? displaySelectedEmployee.sectionId
        : availableSectionIds[0] ?? null;

    if (!availableSectionIds.length) {
      if (subjectiveBulkSectionId !== null) {
        setSubjectiveBulkSectionId(null);
      }
      return;
    }

    if (!subjectiveBulkSectionId || !availableSectionIds.includes(subjectiveBulkSectionId)) {
      setSubjectiveBulkSectionId(preferredSectionId);
    }
  }, [
    displaySelectedEmployee?.sectionId,
    isBulkOpen,
    isSubjectiveWorkbench,
    subjectiveBulkSectionId,
    subjectiveBulkSectionOptions
  ]);

  useEffect(() => {
    if (!isSubjectiveWorkbench || !isBulkOpen) {
      return;
    }

    const nextDrafts = createSubjectiveBulkScoreDrafts(subjectiveBulkMatrix.rows);
    setSubjectiveBulkDrafts((currentDrafts) => (isSameScoreDraftMap(currentDrafts, nextDrafts) ? currentDrafts : nextDrafts));
  }, [isBulkOpen, isSubjectiveWorkbench, subjectiveBulkMatrix.rows]);

  const resetGoalStripPointer = () => {
    goalStripPointerRef.current.startX = 0;
    goalStripPointerRef.current.startScrollLeft = 0;
    goalStripPointerRef.current.lastX = 0;
    goalStripPointerRef.current.lastTimestamp = 0;
    goalStripPointerRef.current.velocity = 0;
    goalStripPointerRef.current.moved = false;
    setIsGoalStripDragging(false);
  };

  const handleGoalStripMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      return;
    }

    stopGoalStripMomentum();
    goalStripPointerRef.current.startX = event.clientX;
    goalStripPointerRef.current.startScrollLeft = viewport.scrollLeft;
    goalStripPointerRef.current.lastX = event.clientX;
    goalStripPointerRef.current.lastTimestamp = Date.now();
    goalStripPointerRef.current.velocity = 0;
    goalStripPointerRef.current.moved = false;
    goalStripSuppressClickUntilRef.current = 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentViewport = goalStripViewportRef.current;
      if (!currentViewport) {
        return;
      }

      const deltaX = moveEvent.clientX - goalStripPointerRef.current.startX;
      if (Math.abs(deltaX) > 4) {
        goalStripPointerRef.current.moved = true;
        setIsGoalStripDragging(true);
      }

      if (!goalStripPointerRef.current.moved) {
        return;
      }

      moveEvent.preventDefault();
      currentViewport.scrollLeft = goalStripPointerRef.current.startScrollLeft - deltaX;
      const now = Date.now();
      const deltaTime = Math.max(1, now - goalStripPointerRef.current.lastTimestamp);
      const stepDelta = moveEvent.clientX - goalStripPointerRef.current.lastX;
      goalStripPointerRef.current.velocity = -stepDelta / deltaTime;
      goalStripPointerRef.current.lastX = moveEvent.clientX;
      goalStripPointerRef.current.lastTimestamp = now;
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (goalStripPointerRef.current.moved) {
        goalStripSuppressClickUntilRef.current = Date.now() + 180;
        if (Math.abs(goalStripPointerRef.current.velocity) >= 0.02) {
          startGoalStripMomentum(goalStripPointerRef.current.velocity);
        }
      }

      resetGoalStripPointer();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleGoalStripWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      return;
    }

    const horizontalDelta = Math.abs(event.deltaX);
    const verticalDelta = Math.abs(event.deltaY);
    if (verticalDelta <= horizontalDelta) {
      return;
    }

    viewport.scrollBy({
      left: event.deltaY,
      behavior: 'auto'
    });
    event.preventDefault();
  };

  const scrollGoalStripBy = (direction: -1 | 1) => {
    const viewport = goalStripViewportRef.current;
    if (!viewport) {
      return;
    }

    stopGoalStripMomentum();
    viewport.scrollBy({
      left: direction * Math.max(viewport.clientWidth * 0.72, 240),
      behavior: 'smooth'
    });
  };

  const handleGoalTabClick = (nextGoalId: string) => {
    if (Date.now() < goalStripSuppressClickUntilRef.current) {
      return;
    }

    setGoalId(nextGoalId);
  };

  const applyQueueFilters = (nextSectionId: string | null, nextReviewGroupId: string | null) => {
    const currentQueueEmployeeId = selectedEmployee?.id ?? employeeId;
    const nextQueueState = resolveWorkbenchQueueSelection(workbenchQuery.data?.employees ?? [], {
      sectionId: nextSectionId,
      reviewGroupId: nextReviewGroupId,
      keyword,
      onlyWithProofs,
      selectedEmployeeId: currentQueueEmployeeId
    });
    setQueueSectionId(nextQueueState.sectionId);
    setQueueReviewGroupId(nextQueueState.reviewGroupId);
    if (employeeId !== nextQueueState.employeeId) {
      setEmployeeId(nextQueueState.employeeId);
    }
    if (currentQueueEmployeeId !== nextQueueState.employeeId) {
      setGoalId(null);
    }
  };

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
              {workbenchMeta.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {workbenchMeta.description}
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
                    value={queueFilters.sectionId ?? ALL_FILTER_VALUE}
                    options={queueSectionOptions}
                    onChange={(value) => {
                      applyQueueFilters(value === ALL_FILTER_VALUE ? null : value, queueFilters.reviewGroupId);
                    }}
                  />
                  <Select
                    aria-label={T.groupFilter}
                    size="small"
                    style={{ width: '100%' }}
                    value={queueFilters.reviewGroupId ?? ALL_FILTER_VALUE}
                    options={queueReviewGroupOptions}
                    onChange={(value) => {
                      applyQueueFilters(queueFilters.sectionId, value === ALL_FILTER_VALUE ? null : value);
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
                        {SHOW_WORKBENCH_HINT_TAGS && employee.missingProofKeyResultCount > 0 ? (
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
                  {workbenchMeta.bulkEnabled ? (
                    <Button type="primary" onClick={openBulkModal} disabled={!workbenchQuery.data?.employees.length}>
                      {isObjectiveWorkbench ? BATCH_UI.title : SUBJECTIVE_BATCH_UI.title}
                    </Button>
                  ) : null}
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
                {SHOW_WORKBENCH_HINT_TAGS ? (
                  <Card variant="borderless" className="leader-summary-card">
                    <Statistic title={T.missingProofCount} value={displaySelectedEmployee?.missingProofKeyResultCount ?? 0} />
                  </Card>
                ) : null}
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless">
              <div
                className={`leader-goal-strip${goalStripCanScrollLeft ? ' leader-goal-strip--has-left' : ''}${
                  goalStripCanScrollRight ? ' leader-goal-strip--has-right' : ''
                }`}
              >
                <Button
                  type="text"
                  shape="circle"
                  icon={<LeftOutlined />}
                  className="leader-goal-strip__arrow leader-goal-strip__arrow--left"
                  disabled={!goalStripCanScrollLeft}
                  onClick={() => scrollGoalStripBy(-1)}
                />
                <div
                  ref={goalStripViewportRef}
                  className={`leader-goal-strip__viewport${isGoalStripDragging ? ' leader-goal-strip__viewport--dragging' : ''}`}
                  onMouseDown={handleGoalStripMouseDown}
                  onWheel={handleGoalStripWheel}
                >
                  {goalTabs.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      data-goal-tab-id={goal.id}
                      className={`leader-goal-strip__tab${goal.id === activeGoalTabId ? ' leader-goal-strip__tab--active' : ''}`}
                      onClick={() => handleGoalTabClick(goal.id)}
                    >
                      {goal.label}
                    </button>
                  ))}
                </div>
                <Button
                  type="text"
                  shape="circle"
                  icon={<RightOutlined />}
                  className="leader-goal-strip__arrow leader-goal-strip__arrow--right"
                  disabled={!goalStripCanScrollRight}
                  onClick={() => scrollGoalStripBy(1)}
                />
              </div>

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
                      {SHOW_WORKBENCH_HINT_TAGS && displaySelectedGoal.missingProofKeyResultCount > 0 ? (
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
                            className={`leader-kr-card${
                              SHOW_WORKBENCH_HINT_TAGS && keyResult.isProofMissing ? ' leader-kr-card--warning' : ''
                            }`}
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
                                  {SHOW_WORKBENCH_HINT_TAGS ? (
                                    <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                                      {getCompletionStateLabel(keyResult.completionState)}
                                    </Tag>
                                  ) : null}
                                  {SHOW_WORKBENCH_HINT_TAGS && (!displaySelectedGoal.isTemplateGoal || keyResult.hasProofs) ? (
                                    <Tag color={keyResult.isProofMissing ? 'gold' : 'blue'}>
                                      {keyResult.isProofMissing ? T.proofMissing : T.proofReady}
                                    </Tag>
                                  ) : null}
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
                                          {isKnowledgeEditor && proof.canManageKnowledge ? (
                                            <Checkbox
                                              checked={proof.isKnowledge}
                                              disabled={knowledgeMutation.isPending}
                                              onChange={(event) => toggleProofKnowledge(proof.id, event.target.checked)}
                                            >
                                              {T.markKnowledge}
                                            </Checkbox>
                                          ) : null}
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

      {isObjectiveWorkbench ? (
        <Modal
          open={isBulkOpen}
          title={BATCH_UI.title}
          okText={T.batchSave}
          cancelText={T.cancel}
          onOk={submitBulkScore}
          okButtonProps={{ loading: bulkMutation.isPending, disabled: isBulkSubmitDisabled }}
          onCancel={() => {
            setIsBulkOpen(false);
            resetBulk();
          }}
          destroyOnHidden
          width={860}
        >
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {BATCH_UI.desc}
          </Typography.Paragraph>
          <Alert type="info" showIcon message={BATCH_UI.scopeNote} />
          <Alert
            type="success"
            showIcon
            message={bulkScoreMode === 'custom' ? BATCH_UI.customScoreSummary(bulkCustomScore) : BATCH_UI.fullScore}
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Typography.Text strong>{T.batchModeLabel}</Typography.Text>
              <Radio.Group
                style={{ display: 'flex', marginTop: 8 }}
                value={bulkScoreMode}
                onChange={(event) => setBulkScoreMode(event.target.value)}
              >
                <Radio.Button value="full">{T.batchModeFull}</Radio.Button>
                <Radio.Button value="custom">{T.batchModeCustom}</Radio.Button>
              </Radio.Group>
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text strong>{T.batchCustomScoreLabel}</Typography.Text>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={0}
                step={0.5}
                aria-label={T.batchCustomScoreLabel}
                disabled={bulkScoreMode !== 'custom'}
                placeholder={T.batchCustomScorePlaceholder}
                value={bulkCustomScore ?? undefined}
                onChange={(value) => setBulkCustomScore(typeof value === 'number' ? value : null)}
              />
              <Typography.Paragraph type={bulkCustomScoreExceeded ? 'danger' : 'secondary'} style={{ marginTop: 8, marginBottom: 0 }}>
                {bulkCustomScoreExceeded && bulkCustomScore !== null && bulkCustomScoreMax !== null
                  ? T.batchCustomScoreExceeded(bulkCustomScore, bulkCustomScoreMax)
                  : T.batchCustomScoreHint(bulkCustomScoreMax)}
              </Typography.Paragraph>
            </Col>
          </Row>

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
                  setBulkExcludedTemplateGoalKeys([]);
                  setBulkExcludedTemplateKeyResultKeys([]);
                  setBulkIncludedTemplateGoalKeys([]);
                  setBulkIncludedTemplateKeyResultKeys([]);
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
                  setBulkExcludedTemplateGoalKeys([]);
                  setBulkExcludedTemplateKeyResultKeys([]);
                  setBulkIncludedTemplateGoalKeys([]);
                  setBulkIncludedTemplateKeyResultKeys([]);
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
                  setBulkExcludedTemplateGoalKeys([]);
                  setBulkExcludedTemplateKeyResultKeys([]);
                  setBulkIncludedTemplateGoalKeys([]);
                  setBulkIncludedTemplateKeyResultKeys([]);
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
            <Col xs={24} md={12}>
              <div className="leader-bulk-filter-panel">
                <div className="leader-bulk-filter-panel__header">
                  <Typography.Text strong className="leader-bulk-filter-panel__title">
                    {T.bulkExcludeTemplateGoals}
                  </Typography.Text>
                  <Checkbox
                    className="leader-bulk-filter-panel__toggle"
                    aria-label={T.bulkExcludeTemplateGoals}
                    checked={bulkExcludeTemplates}
                    disabled={bulkIncludedTemplateGoalKeys.length > 0}
                    onChange={(event) => setBulkExcludeTemplates(event.target.checked)}
                  >
                    {T.bulkExcludeTemplateGoalsToggle}
                  </Checkbox>
                </div>
                <Select
                  mode="multiple"
                  allowClear
                  className="leader-bulk-filter-panel__control"
                aria-label={T.bulkExcludeSpecificTemplateGoals}
                placeholder={T.bulkExcludeSpecificTemplateGoalsPlaceholder}
                value={bulkExcludedTemplateGoalKeys}
                disabled={bulkExcludeTemplates || !bulkTemplateGoalOptions.length}
                onChange={(value) => {
                  setBulkExcludedTemplateGoalKeys(value);
                  const nextGoalKeys = new Set(value);
                  setBulkExcludedTemplateKeyResultKeys((current) =>
                    current.filter((item) => {
                      const goalKey = bulkExcludedTemplateKeyResultGoalKeyMap.get(item);
                      return !goalKey || !nextGoalKeys.has(goalKey);
                    })
                  );
                }}
                options={bulkTemplateGoalOptions}
                optionFilterProp="label"
              />
                <div className="leader-bulk-filter-panel__helper leader-bulk-filter-panel__helper--placeholder" aria-hidden />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="leader-bulk-filter-panel">
                <Typography.Text strong className="leader-bulk-filter-panel__title">
                  {T.bulkExcludeTemplateKeyResults}
                </Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  className="leader-bulk-filter-panel__control"
                  aria-label={T.bulkExcludeTemplateKeyResults}
                  placeholder={T.bulkExcludeTemplateKeyResultsPlaceholder}
                  value={bulkExcludedTemplateKeyResultKeys}
                  disabled={bulkExcludeTemplates || !bulkExcludedTemplateKeyResultOptions.length}
                  onChange={(value) => {
                    setBulkExcludedTemplateKeyResultKeys(value);
                    const conflictedGoalKeys = new Set(
                      value
                        .map((item) => bulkExcludedTemplateKeyResultGoalKeyMap.get(item))
                        .filter((item): item is string => Boolean(item))
                    );
                    if (conflictedGoalKeys.size > 0) {
                      setBulkExcludedTemplateGoalKeys((current) =>
                        current.filter((item) => !conflictedGoalKeys.has(item))
                      );
                    }
                  }}
                  options={bulkExcludedTemplateKeyResultOptions}
                  optionFilterProp="label"
                />
                <Typography.Paragraph type="secondary" className="leader-bulk-filter-panel__helper">
                  {T.bulkTemplateFilterHint}
                </Typography.Paragraph>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="leader-bulk-filter-panel">
                <Typography.Text strong className="leader-bulk-filter-panel__title">
                  {T.bulkOnlyTemplateGoal}
                </Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  className="leader-bulk-filter-panel__control"
                  aria-label={T.bulkOnlyTemplateGoal}
                  placeholder={T.bulkOnlyTemplateGoalPlaceholder}
                  value={bulkIncludedTemplateGoalKeys}
                  disabled={bulkExcludeTemplates || !bulkTemplateGoalOptions.length}
                  onChange={(value) => {
                    setBulkIncludedTemplateGoalKeys(value);
                    setBulkIncludedTemplateKeyResultKeys([]);
                  }}
                  options={bulkTemplateGoalOptions}
                  optionFilterProp="label"
                />
                <div className="leader-bulk-filter-panel__helper leader-bulk-filter-panel__helper--placeholder" aria-hidden />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div className="leader-bulk-filter-panel">
                <Typography.Text strong className="leader-bulk-filter-panel__title">
                  {T.bulkOnlyTemplateKeyResults}
                </Typography.Text>
                <Select
                  mode="multiple"
                  allowClear
                  className="leader-bulk-filter-panel__control"
                  aria-label={T.bulkOnlyTemplateKeyResults}
                  placeholder={T.bulkOnlyTemplateKeyResultsPlaceholder}
                  value={bulkIncludedTemplateKeyResultKeys}
                  disabled={!bulkIncludedTemplateGoalKeys.length || !bulkIncludedTemplateKeyResultOptions.length}
                  onChange={(value) => setBulkIncludedTemplateKeyResultKeys(value)}
                  options={bulkIncludedTemplateKeyResultOptions}
                  optionFilterProp="label"
                />
                <Typography.Paragraph type="secondary" className="leader-bulk-filter-panel__helper">
                  {T.bulkOnlyTemplateHint}
                </Typography.Paragraph>
              </div>
            </Col>
          </Row>

          <Space wrap>
            <Button onClick={handleSelectAllKeyResults} disabled={!bulkScorableEmployeeIds.length}>
              {BATCH_UI.selectAll}
            </Button>
            <Button onClick={handleSelectAllUnscoredKeyResults} disabled={!bulkScorableEmployeeIds.length}>
              {BATCH_UI.selectAllUnscored}
            </Button>
          </Space>

          <Typography.Text type="secondary">{T.batchHint}</Typography.Text>
          {bulkVisibleEmployees.length ? null : <Alert type="warning" showIcon message={T.noScopedEmployees} />}

          <Space wrap size={[8, 8]}>
            <Tag>{`已选员工 ${selectedEmployeeCount} 人`}</Tag>
            <Tag>{`已选目标 ${bulkPreview.goals.length} 个`}</Tag>
            <Tag>{`已选关键结果 ${bulkPreview.keyResults.length} 条`}</Tag>
            <Tag color={canScoreCount ? 'green' : 'default'}>{`${T.canScoreEmployees} ${canScoreCount} 人`}</Tag>
            {bulkExcludeTemplates ? <Tag color="purple">{T.bulkExcludedTemplateTag}</Tag> : null}
            {bulkExcludedTemplateGoalKeys.length ? (
              <Tag color="purple">{T.bulkExcludedTemplateGoalTag(bulkExcludedTemplateGoalKeys.length)}</Tag>
            ) : null}
            {bulkExcludedTemplateKeyResultKeys.length ? (
              <Tag color="purple">{T.bulkExcludedTemplateKeyResultTag(bulkExcludedTemplateKeyResultKeys.length)}</Tag>
            ) : null}
            {bulkIncludedTemplateGoalKeys.length ? <Tag color="cyan">{T.bulkOnlyTemplateTag}</Tag> : null}
            {bulkIncludedTemplateGoalKeys.length ? (
              <Tag color="cyan">{T.bulkOnlyTemplateGoalTag(bulkIncludedTemplateGoalKeys.length)}</Tag>
            ) : null}
            {bulkIncludedTemplateKeyResultKeys.length ? (
              <Tag color="cyan">{T.bulkOnlyTemplateKeyResultTag(bulkIncludedTemplateKeyResultKeys.length)}</Tag>
            ) : null}
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={BATCH_UI.previewEmpty} />
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
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={BATCH_UI.previewEmpty} />
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
                        {!entry.isTemplateGoal || entry.hasProofs ? (
                          <Tag color={entry.isProofMissing ? 'gold' : 'blue'}>
                            {entry.isProofMissing ? T.proofMissing : T.proofReady}
                          </Tag>
                        ) : null}
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={BATCH_UI.previewEmpty} />
            )}
          </Card>

          {bulkPreview.readonlyRows > 0 ? <Alert type="warning" showIcon message={BATCH_UI.readonlyRows} /> : null}

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
      ) : null}

      {isSubjectiveWorkbench ? (
        <Modal
          open={isBulkOpen}
          title={SUBJECTIVE_BATCH_UI.title}
          okText={SUBJECTIVE_BATCH_UI.save}
          cancelText={T.cancel}
          onOk={submitSubjectiveBulkScore}
          okButtonProps={{
            loading: subjectiveBulkMutation.isPending,
            disabled: !subjectiveBulkChangedEntries.length || subjectiveBulkExceededColumns.length > 0
          }}
          onCancel={() => {
            setIsBulkOpen(false);
            resetSubjectiveBulk();
          }}
          destroyOnHidden
          width={1160}
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {SUBJECTIVE_BATCH_UI.desc}
            </Typography.Paragraph>

            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={10}>
                <Typography.Text strong>{SUBJECTIVE_BATCH_UI.sectionLabel}</Typography.Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  value={subjectiveBulkSectionId ?? undefined}
                  placeholder={SUBJECTIVE_BATCH_UI.sectionLabel}
                  options={subjectiveBulkSectionOptions.filter((option) => option.value !== ALL_FILTER_VALUE)}
                  onChange={(value) => setSubjectiveBulkSectionId(value)}
                />
              </Col>
              <Col xs={24} md={14}>
                <Space wrap size={[8, 8]} className="leader-card-tags">
                  <Tag color="blue">{`${SUBJECTIVE_BATCH_UI.participantCount} ${subjectiveBulkMatrix.rows.length} 人`}</Tag>
                  <Tag>{`主观项 ${subjectiveBulkMatrix.columns.length} 项`}</Tag>
                  <Tag color={subjectiveBulkChangedEntries.length > 0 ? 'green' : 'default'}>
                    {`待保存 ${subjectiveBulkChangedEntries.length} 项`}
                  </Tag>
                </Space>
              </Col>
            </Row>

            <Alert type="info" showIcon message={SUBJECTIVE_BATCH_UI.averageHint} />
            <Alert
              type={subjectiveBulkExceededColumns.length > 0 ? 'error' : 'success'}
              showIcon
              message={
                subjectiveBulkExceededColumns.length > 0
                  ? SUBJECTIVE_BATCH_UI.averageExceeded
                  : SUBJECTIVE_BATCH_UI.saveHint
              }
              description={
                subjectiveBulkExceededColumns.length > 0
                  ? subjectiveBulkExceededColumns
                      .map(
                        (column) =>
                          `${column.name}：当前平均分 ${column.averageScore.toFixed(2)}，上限 ${column.maxAverageScore.toFixed(2)}`
                      )
                      .join('；')
                  : undefined
              }
            />

            {!subjectiveBulkSectionOptions.some((option) => option.value !== ALL_FILTER_VALUE) ? (
              <Alert type="warning" showIcon message={SUBJECTIVE_BATCH_UI.noSection} />
            ) : null}

            {subjectiveBulkSectionId && subjectiveBulkMatrix.columns.length && subjectiveBulkMatrix.rows.length ? (
              <div className="leader-subjective-batch">
                <div className="leader-subjective-batch__table-wrap">
                  <table className="leader-subjective-batch__table">
                    <thead>
                      <tr>
                        <th className="leader-subjective-batch__sticky-col">员工</th>
                        <th>小组</th>
                        {subjectiveBulkMatrix.columns.map((column) => {
                          const averagePreview = subjectiveBulkAveragePreviewMap.get(column.key);
                          return (
                            <th key={column.key}>
                              <div className="leader-subjective-batch__column-head">
                                <Typography.Text strong>{column.name}</Typography.Text>
                                <Typography.Text type="secondary">
                                  {SUBJECTIVE_BATCH_UI.scoreHeader(column.points)}
                                </Typography.Text>
                                <Typography.Text type="secondary">
                                  {SUBJECTIVE_BATCH_UI.limitHeader(column.maxAverageScore)}
                                </Typography.Text>
                                {averagePreview ? (
                                  <div
                                    className={
                                      averagePreview.exceeded
                                        ? 'leader-subjective-batch__column-average leader-subjective-batch__column-average--danger'
                                        : 'leader-subjective-batch__column-average'
                                    }
                                  >
                                    <Typography.Text strong>{`当前均分 ${averagePreview.averageScore.toFixed(2)}`}</Typography.Text>
                                    <Typography.Text type="secondary">
                                      {`${SUBJECTIVE_BATCH_UI.participantCount} ${averagePreview.participantCount}`}
                                    </Typography.Text>
                                  </div>
                                ) : null}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {subjectiveBulkMatrix.rows.map((row) => (
                        <tr key={row.employeeId}>
                          <td className="leader-subjective-batch__sticky-col">
                            <div className="leader-subjective-batch__employee">
                              <Typography.Text strong>{row.employeeName}</Typography.Text>
                              <Typography.Text type="secondary">{row.sectionName ?? T.sectionFallback}</Typography.Text>
                            </div>
                          </td>
                          <td>
                            <Typography.Text type="secondary">{row.reviewGroupName ?? T.groupFallback}</Typography.Text>
                          </td>
                          {subjectiveBulkMatrix.columns.map((column) => {
                            const cell = row.cells[column.key];
                            if (!cell) {
                              return <td key={`${row.employeeId}:${column.key}`}>{SUBJECTIVE_BATCH_UI.noCell}</td>;
                            }

                            const draft = subjectiveBulkDrafts[cell.keyResultId];
                            return (
                              <td key={`${row.employeeId}:${column.key}`}>
                                <div className="leader-subjective-batch__score-cell">
                                  <InputNumber
                                    min={0}
                                    max={cell.points}
                                    step={0.5}
                                    size="small"
                                    style={{ width: '100%' }}
                                    value={draft?.score ?? undefined}
                                    onChange={(value) =>
                                      updateSubjectiveBulkDraft(cell.keyResultId, typeof value === 'number' ? value : null)
                                    }
                                  />
                                  <Typography.Text type="secondary" className="leader-subjective-batch__cell-meta">
                                    {`${cell.keyResultCode} ${cell.keyResultName}`}
                                  </Typography.Text>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={subjectiveBulkSectionId ? SUBJECTIVE_BATCH_UI.noRows : SUBJECTIVE_BATCH_UI.noSection}
              />
            )}
          </Space>
        </Modal>
      ) : null}
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

  function resetDraftToPersisted(keyResult: LeaderKeyResult) {
    setDrafts((current) => ({
      ...current,
      [keyResult.id]: {
        score: keyResult.reviewScore,
        comment: keyResult.reviewComment ?? ''
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

    scoreMutation.mutate({ krId: keyResult.id, draft, keyResult });
  }

  function openBulkModal() {
    setIsBulkOpen(true);
    if (isObjectiveWorkbench) {
      resetBulk();
      return;
    }

    setSubjectiveBulkDrafts({});
    setSubjectiveBulkSectionId(displaySelectedEmployee?.sectionId ?? null);
  }

  function resetBulk() {
    setBulkSectionId(null);
    setBulkReviewGroupId(null);
    setBulkEmployeeIds([]);
    setBulkGoalIds([]);
    setBulkKrIds(null);
    setBulkScoreMode('full');
    setBulkCustomScore(null);
    setBulkComment('');
    setBulkOverwrite(false);
    setBulkExcludeTemplates(false);
    setBulkExcludedTemplateGoalKeys([]);
    setBulkExcludedTemplateKeyResultKeys([]);
    setBulkIncludedTemplateGoalKeys([]);
    setBulkIncludedTemplateKeyResultKeys([]);
    setBulkAllowMissingProofs(false);
  }

  function resetSubjectiveBulk() {
    setSubjectiveBulkSectionId(null);
    setSubjectiveBulkDrafts({});
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
      selectAllBulkKeyResultIds(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: nextEmployeeIds,
        goalIds: bulkGoalIds,
        excludeTemplateGoals: bulkExcludeTemplates,
        excludedTemplateGoalKeys: bulkExcludedTemplateGoalKeys,
        excludedTemplateKeyResultKeys: bulkExcludedTemplateKeyResultKeys,
        includedTemplateGoalKeys: bulkIncludedTemplateGoalKeys,
        includedTemplateKeyResultKeys: bulkIncludedTemplateKeyResultKeys
      })
    );
  }

  function handleSelectAllUnscoredKeyResults() {
    const nextEmployeeIds = resolveObjectiveBulkEmployeeIds(
      bulkEmployeeIds.length ? bulkEmployeeIds : bulkScopedEmployeeIds,
      bulkScorableEmployeeIds
    );
    if (!nextEmployeeIds.length) {
      return;
    }

    setBulkEmployeeIds(nextEmployeeIds);
    setBulkKrIds(
      selectAllUnscoredBulkKeyResultIds(workbenchQuery.data?.bulkCatalog ?? [], {
        sectionId: bulkSectionId,
        reviewGroupId: bulkReviewGroupId,
        employeeIds: nextEmployeeIds,
        goalIds: bulkGoalIds,
        excludeTemplateGoals: bulkExcludeTemplates,
        excludedTemplateGoalKeys: bulkExcludedTemplateGoalKeys,
        excludedTemplateKeyResultKeys: bulkExcludedTemplateKeyResultKeys,
        includedTemplateGoalKeys: bulkIncludedTemplateGoalKeys,
        includedTemplateKeyResultKeys: bulkIncludedTemplateKeyResultKeys
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

  function updateSubjectiveBulkDraft(keyResultId: string, score: number | null) {
    setSubjectiveBulkDrafts((current) => ({
      ...current,
      [keyResultId]: {
        score,
        comment: current[keyResultId]?.comment ?? ''
      }
    }));
  }

  function resolveProofPreviewUrl(proof: LeaderKeyResult['proofs'][number]) {
    return resolveAppAwareUrl(proof.previewUrl ?? proof.fileUrl);
  }

  function resolveProofDownloadUrl(proof: LeaderKeyResult['proofs'][number]) {
    return resolveApiUrl(proof.downloadUrl ?? proof.fileUrl);
  }

  function submitBulkScore() {
    if (!bulkPreview.rows.length) {
      message.warning(T.batchNeedScope);
      return;
    }

    if (bulkScoreMode === 'custom' && bulkCustomScore === null) {
      message.warning(T.batchCustomScoreRequired);
      return;
    }

    if (bulkCustomScoreExceeded && bulkCustomScore !== null && bulkCustomScoreMax !== null) {
      message.warning(T.batchCustomScoreExceeded(bulkCustomScore, bulkCustomScoreMax));
      return;
    }

    bulkMutation.mutate();
  }

  function submitSubjectiveBulkScore() {
    if (!subjectiveBulkChangedEntries.length) {
      message.warning(SUBJECTIVE_BATCH_UI.saveHint);
      return;
    }

    if (subjectiveBulkExceededColumns.length > 0) {
      message.warning(SUBJECTIVE_BATCH_UI.averageExceeded);
      return;
    }

    subjectiveBulkMutation.mutate();
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
