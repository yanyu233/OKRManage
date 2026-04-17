import {
  DownOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Statistic,
  Tag,
  Typography
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getLeaderAllOkr } from '../../shared/api/leader';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { AllOkrEmployee, AllOkrGoal, AllOkrKeyResult } from '../../shared/types/leader';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import './all-okr.css';

const START_YEAR = 2026;
const YEAR_RANGE_FUTURE = 8;
const ALL_FILTER_VALUE = '__all__';

const TEXT = {
  title: '全部OKR',
  description: '只读查看所有人员的季度 OKR，支持按组织、状态和关键词筛选。',
  loading: '正在加载全部OKR...',
  loadFailedTitle: '加载失败',
  loadFailedDescription: '全部OKR页面加载失败，请稍后重试。',
  refresh: '刷新',
  searchPlaceholder: '搜索员工、目标或关键结果',
  sectionFilter: '全部科室',
  groupFilter: '全部小组',
  goalStatusFilter: '全部状态',
  onlyWithGoals: '仅看有目标',
  employeeCount: '员工数',
  goalCount: '目标数',
  keyResultCount: '关键结果数',
  proofCount: '材料数',
  empty: '当前筛选条件下没有匹配的 OKR 数据',
  emptyGoals: '当前季度暂无目标',
  expandAll: '展开全部',
  collapseAll: '收起全部',
  goalCountTag: '个目标',
  keyResultCountTag: '条关键结果',
  completedCountTag: '已完成',
  proofCountTag: '份材料',
  currentScore: '当前得分',
  quarterScore: '季度得分',
  latestProof: '最近材料',
  reviewScore: '评分',
  proofReady: '已提交材料',
  proofMissing: '未提交材料',
  templateGoal: '模板目标'
} as const;

const GOAL_STATUS_OPTIONS = [
  { value: 'all', label: TEXT.goalStatusFilter },
  { value: 'draft', label: '草稿' },
  { value: 'confirmed', label: '已确认' },
  { value: 'pending-review', label: '待评分' },
  { value: 'completed', label: '已评分' }
] as const;

const SCORE_TYPE_LABELS = {
  objective: '客观',
  subjective: '主观'
} as const;

const COMPLETION_LABELS = {
  incomplete: '未完成',
  completed: '完成'
} as const;

const EMPLOYEE_STATUS_LABELS = {
  pending: '未开始',
  'in-progress': '评分中',
  completed: '已完成'
} as const;

type GoalStatusFilter = (typeof GOAL_STATUS_OPTIONS)[number]['value'];
type FilteredGoal = AllOkrGoal & {
  keyResults: AllOkrKeyResult[];
};
type FilteredEmployee = AllOkrEmployee & {
  goals: FilteredGoal[];
};

export function AllOkrPage() {
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: YEAR_RANGE_FUTURE
  });
  const [keyword, setKeyword] = useState('');
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [reviewGroupId, setReviewGroupId] = useState<string | null>(null);
  const [goalStatus, setGoalStatus] = useState<GoalStatusFilter>('all');
  const [onlyWithGoals, setOnlyWithGoals] = useState(true);
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<string[]>([]);

  const okrQuery = useQuery({
    queryKey: ['all-okr', year, quarter],
    queryFn: () => getLeaderAllOkr({ year, quarter })
  });

  useEffect(() => {
    setExpandedEmployeeIds([]);
  }, [year, quarter]);

  const employees = okrQuery.data?.employees ?? [];

  const sectionOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: TEXT.sectionFilter },
      ...buildFilterOptions(
        employees.map((employee) => ({
          value: employee.sectionId,
          label: employee.sectionName
        }))
      )
    ],
    [employees]
  );

  const reviewGroupOptions = useMemo(
    () => [
      { value: ALL_FILTER_VALUE, label: TEXT.groupFilter },
      ...buildFilterOptions(
        employees
          .filter((employee) => !sectionId || employee.sectionId === sectionId)
          .map((employee) => ({
            value: employee.reviewGroupId,
            label: employee.reviewGroupName
          }))
      )
    ],
    [employees, sectionId]
  );

  useEffect(() => {
    if (reviewGroupId && !reviewGroupOptions.some((option) => option.value === reviewGroupId)) {
      setReviewGroupId(null);
    }
  }, [reviewGroupId, reviewGroupOptions]);

  const filteredEmployees = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const hasKeyword = normalizedKeyword.length > 0;

    return employees.flatMap((employee) => {
      if (sectionId && employee.sectionId !== sectionId) {
        return [];
      }

      if (reviewGroupId && employee.reviewGroupId !== reviewGroupId) {
        return [];
      }

      const employeeMatches = hasKeyword
        ? matchesKeyword(
            [
              employee.name,
              employee.positionName,
              employee.departmentName,
              employee.sectionName,
              employee.reviewGroupName
            ],
            normalizedKeyword
          )
        : false;

      const goals = employee.goals.flatMap((goal) => {
        if (goalStatus !== 'all' && goal.status !== goalStatus) {
          return [];
        }

        const goalMatches = hasKeyword
          ? matchesKeyword([goal.code, goal.name, goal.description], normalizedKeyword)
          : false;

        const keyResults =
          hasKeyword && !employeeMatches && !goalMatches
            ? goal.keyResults.filter((keyResult) =>
                matchesKeyword(
                  [keyResult.code, keyResult.name, keyResult.description, keyResult.reviewComment],
                  normalizedKeyword
                )
              )
            : goal.keyResults;

        if (hasKeyword && !employeeMatches && !goalMatches && keyResults.length === 0) {
          return [];
        }

        return [
          {
            ...goal,
            keyResults
          }
        ];
      });

      if (goals.length > 0) {
        return [
          {
            ...employee,
            goals
          }
        ];
      }

      if (onlyWithGoals) {
        return [];
      }

      if (!employee.goalCount && !hasKeyword && goalStatus === 'all') {
        return [
          {
            ...employee,
            goals: []
          }
        ];
      }

      if (employeeMatches && hasKeyword && goalStatus === 'all') {
        return [
          {
            ...employee,
            goals: []
          }
        ];
      }

      return [];
    });
  }, [employees, goalStatus, keyword, onlyWithGoals, reviewGroupId, sectionId]);

  const summary = useMemo(() => {
    return filteredEmployees.reduce(
      (accumulator, employee) => {
        accumulator.employeeCount += 1;
        accumulator.goalCount += employee.goals.length;
        accumulator.keyResultCount += employee.goals.reduce((sum, goal) => sum + goal.keyResults.length, 0);
        accumulator.proofCount += employee.goals.reduce(
          (goalSum, goal) => goalSum + goal.keyResults.reduce((keyResultSum, keyResult) => keyResultSum + keyResult.proofCount, 0),
          0
        );
        return accumulator;
      },
      {
        employeeCount: 0,
        goalCount: 0,
        keyResultCount: 0,
        proofCount: 0
      }
    );
  }, [filteredEmployees]);

  const expandableEmployeeIds = useMemo(
    () => filteredEmployees.filter((employee) => employee.goals.length > 0).map((employee) => employee.id),
    [filteredEmployees]
  );

  if (okrQuery.isLoading) {
    return <Card className="all-okr-toolbar-card">{TEXT.loading}</Card>;
  }

  if (okrQuery.isError) {
    const description = okrQuery.error instanceof ApiError ? okrQuery.error.message : TEXT.loadFailedDescription;
    return (
      <Card className="all-okr-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={description} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={18} className="all-okr-page">
      <Card className="all-okr-toolbar-card" variant="borderless">
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <div className="page-toolbar all-okr-toolbar">
            <div className="all-okr-toolbar__main">
              <Typography.Title level={1} className="all-okr-toolbar__title">
                {TEXT.title}
              </Typography.Title>
              <Typography.Paragraph type="secondary" className="all-okr-toolbar__description">
                {`${formatQuarterLabel(year, quarter)} / ${TEXT.description}`}
              </Typography.Paragraph>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                className="page-toolbar__search all-okr-toolbar__search"
                placeholder={TEXT.searchPlaceholder}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <Checkbox
                checked={onlyWithGoals}
                className="all-okr-toolbar__checkbox"
                onChange={(event) => setOnlyWithGoals(event.target.checked)}
              >
                {TEXT.onlyWithGoals}
              </Checkbox>
            </div>

            <div className="all-okr-toolbar__side">
              <div className="all-okr-toolbar__period-row">
                <YearQuarterPickerPopover
                  year={year}
                  quarter={quarter}
                  yearOptions={yearOptions}
                  quarterOptions={quarterOptions}
                  onChange={setPeriod}
                />
              </div>

              <div className="all-okr-toolbar__filter-stack">
                <Select
                  size="small"
                  className="all-okr-toolbar__select"
                  value={sectionId ?? ALL_FILTER_VALUE}
                  options={sectionOptions}
                  onChange={(value) => setSectionId(value === ALL_FILTER_VALUE ? null : value)}
                />
                <Select
                  size="small"
                  className="all-okr-toolbar__select"
                  value={reviewGroupId ?? ALL_FILTER_VALUE}
                  options={reviewGroupOptions}
                  onChange={(value) => setReviewGroupId(value === ALL_FILTER_VALUE ? null : value)}
                />
                <Select
                  size="small"
                  className="all-okr-toolbar__select"
                  value={goalStatus}
                  options={GOAL_STATUS_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label
                  }))}
                  onChange={(value) => setGoalStatus(value)}
                />
              </div>

              <div className="all-okr-toolbar__footer">
                <div className="all-okr-toolbar__actions">
                  <Space size={8}>
                    <Button
                      size="small"
                      onClick={() => setExpandedEmployeeIds(expandableEmployeeIds)}
                      disabled={!expandableEmployeeIds.length}
                    >
                      {TEXT.expandAll}
                    </Button>
                    <Button size="small" onClick={() => setExpandedEmployeeIds([])} disabled={!expandedEmployeeIds.length}>
                      {TEXT.collapseAll}
                    </Button>
                  </Space>
                </div>
                <Button className="all-okr-toolbar__refresh" icon={<ReloadOutlined />} onClick={() => okrQuery.refetch()}>
                  {TEXT.refresh}
                </Button>
              </div>
            </div>
          </div>
        </Space>
      </Card>

      <div className="all-okr-summary-grid">
        <Card className="all-okr-summary-card" variant="borderless">
          <Statistic title={TEXT.employeeCount} value={summary.employeeCount} />
        </Card>
        <Card className="all-okr-summary-card" variant="borderless">
          <Statistic title={TEXT.goalCount} value={summary.goalCount} />
        </Card>
        <Card className="all-okr-summary-card" variant="borderless">
          <Statistic title={TEXT.keyResultCount} value={summary.keyResultCount} />
        </Card>
        <Card className="all-okr-summary-card" variant="borderless">
          <Statistic title={TEXT.proofCount} value={summary.proofCount} />
        </Card>
      </div>

      {filteredEmployees.length ? (
        <div className="all-okr-employee-list">
          {filteredEmployees.map((employee) => {
            const expanded = expandedEmployeeIds.includes(employee.id);

            return (
              <Card key={employee.id} className={`all-okr-employee-card${expanded ? ' all-okr-employee-card--expanded' : ''}`} variant="borderless">
                <div className="all-okr-employee-card__summary">
                  <button
                    type="button"
                    className="all-okr-employee-card__trigger"
                    onClick={() =>
                      setExpandedEmployeeIds((current) =>
                        current.includes(employee.id)
                          ? current.filter((entry) => entry !== employee.id)
                          : [...current, employee.id]
                      )
                    }
                  >
                    <div className="all-okr-employee-card__content">
                      <div className="all-okr-employee-card__title-row">
                        <Typography.Title level={4} className="all-okr-employee-card__title">
                          {employee.name}
                        </Typography.Title>
                        {employee.positionName ? (
                          <Typography.Text type="secondary" className="all-okr-employee-card__position">
                            {employee.positionName}
                          </Typography.Text>
                        ) : null}
                      </div>
                      <Typography.Paragraph type="secondary" className="all-okr-employee-card__subtitle">
                        {buildEmployeeSubtitle(employee)}
                      </Typography.Paragraph>
                    </div>

                    <div className="all-okr-employee-card__meta">
                      <Space wrap size={[6, 6]} className="all-okr-chip-row">
                        <Tag color={getEmployeeStatusColor(employee.status)}>{getEmployeeStatusLabel(employee.status)}</Tag>
                        <Tag>{`${TEXT.quarterScore} ${formatNullableScore(employee.quarterScore)}`}</Tag>
                        <Tag>{`${employee.goalCount} ${TEXT.goalCountTag}`}</Tag>
                        <Tag>{`${employee.keyResultCount} ${TEXT.keyResultCountTag}`}</Tag>
                        <Tag>{`${TEXT.completedCountTag} ${employee.completedKeyResultCount}`}</Tag>
                        <Tag>{`${employee.proofCount} ${TEXT.proofCountTag}`}</Tag>
                        {employee.missingProofKeyResultCount > 0 ? (
                          <Tag color="gold">{`待补材料 ${employee.missingProofKeyResultCount}`}</Tag>
                        ) : null}
                      </Space>
                      <span className="all-okr-employee-card__toggle">
                        {expanded ? <UpOutlined /> : <DownOutlined />}
                      </span>
                    </div>
                  </button>
                </div>

                {expanded ? (
                  <div className="all-okr-employee-card__details">
                    {employee.goals.length ? (
                      <div className="all-okr-goal-list">
                        {employee.goals.map((goal) => (
                          <Card key={goal.id} className="all-okr-goal-card" variant="borderless">
                            <div className="all-okr-goal-card__header">
                              <div className="all-okr-goal-card__content">
                                <Typography.Title level={5} className="all-okr-goal-card__title">
                                  {`${goal.code} ${goal.name}`}
                                </Typography.Title>
                                {goal.description ? (
                                  <Typography.Paragraph type="secondary" className="all-okr-goal-card__description">
                                    {goal.description}
                                  </Typography.Paragraph>
                                ) : null}
                              </div>

                              <Space wrap size={[6, 6]} className="all-okr-chip-row">
                                <Tag color={getGoalStatusColor(goal.status)}>{getGoalStatusLabel(goal.status)}</Tag>
                                {goal.isTemplateGoal ? <Tag color="gold">{TEXT.templateGoal}</Tag> : null}
                                <Tag>{`${goal.totalPoints} 分`}</Tag>
                                <Tag>{`${goal.keyResultCount} ${TEXT.keyResultCountTag}`}</Tag>
                                <Tag>{`${TEXT.completedCountTag} ${goal.completedKeyResultCount}`}</Tag>
                                <Tag>{`${goal.proofCount} ${TEXT.proofCountTag}`}</Tag>
                                {goal.missingProofKeyResultCount > 0 ? (
                                  <Tag color="gold">{`待补材料 ${goal.missingProofKeyResultCount}`}</Tag>
                                ) : null}
                                <Tag>{`${TEXT.currentScore} ${formatNullableScore(goal.currentScore)}`}</Tag>
                              </Space>
                            </div>

                            <div className="all-okr-kr-list">
                              {goal.keyResults.map((keyResult) => (
                                <div key={keyResult.id} className="all-okr-kr-row">
                                  <div className="all-okr-kr-row__main">
                                    <Typography.Text strong className="all-okr-kr-row__title">
                                      {`${keyResult.code} ${keyResult.name}`}
                                    </Typography.Text>
                                    {keyResult.description ? (
                                      <Typography.Text type="secondary" className="all-okr-kr-row__description">
                                        {keyResult.description}
                                      </Typography.Text>
                                    ) : null}
                                    {keyResult.reviewComment ? (
                                      <Typography.Text type="secondary" className="all-okr-kr-row__description">
                                        {`评分备注：${keyResult.reviewComment}`}
                                      </Typography.Text>
                                    ) : null}
                                  </div>

                                  <Space wrap size={[6, 6]} className="all-okr-chip-row all-okr-kr-row__tags">
                                    <Tag>{`${keyResult.points} 分`}</Tag>
                                    <Tag color={getScoreTypeColor(keyResult.scoreType)}>
                                      {SCORE_TYPE_LABELS[keyResult.scoreType] ?? keyResult.scoreType}
                                    </Tag>
                                    <Tag color={getCompletionStateColor(keyResult.completionState)}>
                                      {getCompletionStateLabel(keyResult.completionState)}
                                    </Tag>
                                    <Tag color={keyResult.isProofMissing ? 'gold' : 'blue'}>
                                      {keyResult.isProofMissing ? TEXT.proofMissing : TEXT.proofReady}
                                    </Tag>
                                    <Tag>{`${keyResult.proofCount} ${TEXT.proofCountTag}`}</Tag>
                                    <Tag>{`${TEXT.reviewScore} ${formatNullableScore(keyResult.reviewScore)}`}</Tag>
                                    {keyResult.latestProofUploadedAt ? (
                                      <Tag>{`${TEXT.latestProof} ${formatDateTime(keyResult.latestProofUploadedAt)}`}</Tag>
                                    ) : null}
                                  </Space>
                                </div>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyGoals} />
                    )}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="all-okr-toolbar-card" variant="borderless">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
        </Card>
      )}
    </Space>
  );
}

function buildFilterOptions(
  entries: Array<{
    value: string | null;
    label: string | null;
  }>
) {
  const mapped = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.value || !entry.label) {
      continue;
    }

    mapped.set(entry.value, entry.label);
  }

  return Array.from(mapped.entries())
    .sort((left, right) => left[1].localeCompare(right[1], 'zh-CN'))
    .map(([value, label]) => ({
      value,
      label
    }));
}

function matchesKeyword(values: Array<string | null | undefined>, keyword: string) {
  return values.some((value) => value?.toLowerCase().includes(keyword));
}

function buildEmployeeSubtitle(employee: FilteredEmployee) {
  return [employee.departmentName, employee.sectionName, employee.reviewGroupName].filter(Boolean).join(' / ') || '未分配组织';
}

function getGoalStatusColor(status: string) {
  if (status === 'completed') {
    return 'green';
  }

  if (status === 'pending-review') {
    return 'gold';
  }

  if (status === 'confirmed') {
    return 'blue';
  }

  return 'default';
}

function getGoalStatusLabel(status: string) {
  return GOAL_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getScoreTypeColor(scoreType: string) {
  return scoreType === 'objective' ? 'blue' : 'purple';
}

function getCompletionStateColor(state: string) {
  return state === 'completed' ? 'green' : 'red';
}

function getCompletionStateLabel(state: string) {
  return COMPLETION_LABELS[state as keyof typeof COMPLETION_LABELS] ?? state;
}

function getEmployeeStatusColor(status: string) {
  if (status === 'completed') {
    return 'green';
  }

  if (status === 'in-progress') {
    return 'gold';
  }

  return 'default';
}

function getEmployeeStatusLabel(status: string) {
  return EMPLOYEE_STATUS_LABELS[status as keyof typeof EMPLOYEE_STATUS_LABELS] ?? status;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
