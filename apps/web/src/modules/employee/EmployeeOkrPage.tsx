import { CalendarOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Popover, Segmented, Space, Statistic, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  createEmployeeGoal,
  getEmployeeGoalDetail,
  getEmployeeGoalTemplates,
  getEmployeeOkr,
  importEmployeeGoalTemplates,
  updateEmployeeGoal
} from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { CreateEmployeeGoalInput, EmployeeGoalDetail, UpdateEmployeeGoalInput } from '../../shared/types/employee';
import {
  EMPLOYEE_QUARTER_POINT_LIMIT,
  filterEmployeeGoals,
  getDraftGoalPoints,
  getEmployeeQuarterAllocatedPoints,
  isEmployeeGoalActionRequired,
  isQuarterPointLimitError
} from './employee.helpers';
import { EmployeeCreateGoalDialog } from './EmployeeCreateGoalDialog';
import { EmployeeGoalAccordionItem } from './EmployeeGoalAccordionItem';
import { EmployeePeriodPickerDialog } from './EmployeePeriodPickerDialog';
import { EmployeeTemplateImportDialog } from './EmployeeTemplateImportDialog';
import './employee.css';

const START_YEAR = 2026;
const YEAR_RANGE_FUTURE = 8;
const TEXT = {
  title: '我的 OKR',
  loading: '正在加载我的 OKR...',
  loadFailedTitle: '加载失败',
  loadFailedDescription: '员工 OKR 加载失败。',
  refresh: '刷新',
  searchPlaceholder: '搜索目标名称或说明',
  sectionFallback: '未分配科室',
  groupFallback: '未分配评价组',
  goalCount: '目标数',
  keyResultCount: '关键结果数',
  proofCount: '证明材料',
  missingProofCount: '待上传材料 KR',
  quarterScore: '当前季度得分',
  createGoal: '新建目标',
  createSuccess: '目标创建成功。',
  importTemplates: '导入模板目标',
  importSuccess: '模板目标导入成功。',
  goalsTitle: '本季度目标',
  goalsDescription: '在当前页直接展开目标并处理关键结果、上传证明材料。',
  editGoal: '编辑目标',
  editLoadFailed: '目标详情加载失败，请稍后重试。',
  editSuccess: '目标修改已保存。',
  editFailed: '目标修改失败，请稍后重试。',
  pointLimitExceeded: '当前季度所有目标的关键结果分值合计不能超过 100 分。',
  emptyGoals: '当前筛选条件下没有匹配目标',
  selectPeriod: '选择时间',
  allGoals: '全部目标',
  actionGoals: '仅看待处理',
  collapseAll: '全部收起'
} as const;

function canEditGoal(status: string) {
  return status === 'draft';
}

export function EmployeeOkrPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: YEAR_RANGE_FUTURE
  });
  const [keyword, setKeyword] = useState('');
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<EmployeeGoalDetail | null>(null);
  const [expandedGoalIds, setExpandedGoalIds] = useState<string[]>([]);
  const [onlyActionRequired, setOnlyActionRequired] = useState(false);

  const okrQuery = useQuery({
    queryKey: ['employee-okr', year, quarter],
    queryFn: () =>
      getEmployeeOkr({
        year,
        quarter
      })
  });

  useEffect(() => {
    setExpandedGoalIds([]);
  }, [year, quarter]);

  const templatesQuery = useQuery({
    queryKey: ['employee-goal-templates', year, quarter],
    queryFn: () =>
      getEmployeeGoalTemplates({
        year,
        quarter
      }),
    enabled: importDialogOpen
  });

  const importMutation = useMutation({
    mutationFn: (templateIds: string[]) =>
      importEmployeeGoalTemplates({
        year,
        quarter,
        templateIds
      }),
    onSuccess: async () => {
      message.success(TEXT.importSuccess);
      setImportDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['employee-okr'] });
      await queryClient.invalidateQueries({ queryKey: ['employee-goal-templates'] });
    },
    onError: (error) => {
      const description = isQuarterPointLimitError(error)
        ? TEXT.pointLimitExceeded
        : error instanceof ApiError
          ? error.message
          : TEXT.loadFailedDescription;
      message.error(description);
    }
  });

  const createGoalMutation = useMutation({
    mutationFn: createEmployeeGoal,
    onSuccess: async () => {
      message.success(TEXT.createSuccess);
      setCreateDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['employee-okr'] });
    },
    onError: (error) => {
      const description = isQuarterPointLimitError(error)
        ? TEXT.pointLimitExceeded
        : error instanceof ApiError
          ? error.message
          : TEXT.loadFailedDescription;
      message.error(description);
    }
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ goalId, payload }: { goalId: string; payload: UpdateEmployeeGoalInput }) => updateEmployeeGoal(goalId, payload),
    onSuccess: async (goal) => {
      setEditDialogOpen(false);
      setEditingGoal(goal);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goal.id] })
      ]);
      message.success(TEXT.editSuccess);
    },
    onError: (error) => {
      const description = isQuarterPointLimitError(error)
        ? TEXT.pointLimitExceeded
        : error instanceof ApiError
          ? error.message
          : TEXT.editFailed;
      message.error(description);
    }
  });

  async function openEditDialog(goalId: string) {
    setEditingGoalId(goalId);

    try {
      const goal = await queryClient.fetchQuery({
        queryKey: ['employee-goal', goalId],
        queryFn: () => getEmployeeGoalDetail(goalId)
      });
      setEditingGoal(goal);
      setEditDialogOpen(true);
    } catch (error) {
      const description = error instanceof ApiError ? error.message : TEXT.editLoadFailed;
      message.error(description);
    } finally {
      setEditingGoalId((current) => (current === goalId ? null : current));
    }
  }

  if (okrQuery.isLoading) {
    return <Card className="employee-toolbar-card">{TEXT.loading}</Card>;
  }

  if (okrQuery.isError) {
    const description = okrQuery.error instanceof ApiError ? okrQuery.error.message : TEXT.loadFailedDescription;
    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={description} />
      </Card>
    );
  }

  const payload = okrQuery.data!;
  const quarterAllocatedPoints = getEmployeeQuarterAllocatedPoints(payload.goals);

  const filteredGoals = useMemo(() => {
    const matchedGoals = filterEmployeeGoals(payload.goals, keyword);

    if (!onlyActionRequired) {
      return matchedGoals;
    }

    return matchedGoals.filter((goal) => isEmployeeGoalActionRequired(goal));
  }, [keyword, onlyActionRequired, payload.goals]);

  const summaryCards = [
    [TEXT.goalCount, payload.employee.goalCount],
    [TEXT.keyResultCount, payload.employee.keyResultCount],
    [TEXT.proofCount, payload.employee.proofCount],
    [TEXT.missingProofCount, payload.employee.missingProofKeyResultCount]
  ] as const;

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {`${payload.employee.name} / ${payload.employee.sectionName ?? TEXT.sectionFallback} / ${
                payload.employee.reviewGroupName ?? TEXT.groupFallback
              }`}
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
            <Popover
              trigger="click"
              placement="bottomRight"
              open={periodPickerOpen}
              destroyOnHidden
              overlayClassName="employee-period-popover"
              onOpenChange={setPeriodPickerOpen}
              content={
                <EmployeePeriodPickerDialog
                  year={year}
                  quarter={quarter}
                  yearOptions={yearOptions}
                  quarterOptions={quarterOptions}
                  onSelect={(nextYear, nextQuarter) => {
                    setPeriod(nextYear, nextQuarter);
                    setPeriodPickerOpen(false);
                  }}
                />
              }
            >
              <Button
                aria-label={formatQuarterLabel(year, quarter)}
                icon={<CalendarOutlined />}
                className="employee-period-trigger"
              >
                {formatQuarterLabel(year, quarter)}
              </Button>
            </Popover>
            <Button type="primary" onClick={() => setCreateDialogOpen(true)}>
              {TEXT.createGoal}
            </Button>
            <Button type="primary" onClick={() => setImportDialogOpen(true)}>
              {TEXT.importTemplates}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => okrQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <div className="employee-summary-grid">
        {summaryCards.map(([title, value]) => (
          <Card key={title} className="employee-summary-card" variant="borderless">
            <Statistic title={title} value={value} />
          </Card>
        ))}
        <Card className="employee-summary-card" variant="borderless">
          <Statistic title={TEXT.quarterScore} value={formatNullableScore(payload.employee.quarterScore)} />
        </Card>
      </div>

      <Card className="employee-detail-card" variant="borderless">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div className="page-hero">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 6 }}>
                {TEXT.goalsTitle}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {`${formatQuarterLabel(payload.year, payload.quarter)} / ${TEXT.goalsDescription}`}
              </Typography.Paragraph>
            </div>
          </div>

          <div className="employee-goal-toolbar">
            <Segmented
              value={onlyActionRequired ? TEXT.actionGoals : TEXT.allGoals}
              options={[TEXT.allGoals, TEXT.actionGoals]}
              onChange={(value) => setOnlyActionRequired(value === TEXT.actionGoals)}
            />
            <Button onClick={() => setExpandedGoalIds([])} disabled={!expandedGoalIds.length}>
              {TEXT.collapseAll}
            </Button>
          </div>

          {filteredGoals.length ? (
            <div className="employee-goal-accordion-list">
              {filteredGoals.map((goal) => (
                <EmployeeGoalAccordionItem
                  key={goal.id}
                  goal={goal}
                  expanded={expandedGoalIds.includes(goal.id)}
                  onlyActionRequired={onlyActionRequired}
                  editing={editingGoalId === goal.id}
                  onToggle={() =>
                    setExpandedGoalIds((current) =>
                      current.includes(goal.id) ? current.filter((entry) => entry !== goal.id) : [...current, goal.id]
                    )
                  }
                  onEdit={() => {
                    if (!canEditGoal(goal.status)) {
                      return;
                    }

                    void openEditDialog(goal.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyGoals} />
          )}
        </Space>
      </Card>

      <EmployeeTemplateImportDialog
        open={importDialogOpen}
        loading={templatesQuery.isLoading}
        confirmLoading={importMutation.isPending}
        departmentName={templatesQuery.data?.departmentName ?? payload.employee.sectionName ?? null}
        templates={templatesQuery.data?.templates ?? []}
        onCancel={() => setImportDialogOpen(false)}
        onConfirm={(templateIds) => {
          const selectedTemplatePoints =
            templatesQuery.data?.templates
              .filter((template) => templateIds.includes(template.id))
              .reduce((sum, template) => sum + template.totalPoints, 0) ?? 0;

          if (quarterAllocatedPoints + selectedTemplatePoints > EMPLOYEE_QUARTER_POINT_LIMIT) {
            message.error(TEXT.pointLimitExceeded);
            return;
          }

          importMutation.mutate(templateIds);
        }}
      />

      <EmployeeCreateGoalDialog
        open={createDialogOpen}
        year={year}
        quarter={quarter}
        quarterAllocatedPoints={quarterAllocatedPoints}
        maxQuarterPoints={EMPLOYEE_QUARTER_POINT_LIMIT}
        confirmLoading={createGoalMutation.isPending}
        onCancel={() => setCreateDialogOpen(false)}
        onConfirm={(payload) => {
          const nextGoalPoints = getDraftGoalPoints(payload as CreateEmployeeGoalInput);
          if (quarterAllocatedPoints + nextGoalPoints > EMPLOYEE_QUARTER_POINT_LIMIT) {
            message.error(TEXT.pointLimitExceeded);
            return;
          }

          createGoalMutation.mutate(payload as CreateEmployeeGoalInput);
        }}
      />

      <EmployeeCreateGoalDialog
        open={editDialogOpen}
        mode="edit"
        initialValue={editingGoal}
        quarterAllocatedPoints={Math.max(quarterAllocatedPoints - (editingGoal?.totalPoints ?? 0), 0)}
        maxQuarterPoints={EMPLOYEE_QUARTER_POINT_LIMIT}
        confirmLoading={updateGoalMutation.isPending}
        onCancel={() => {
          setEditDialogOpen(false);
          setEditingGoal(null);
        }}
        onConfirm={(payload) => {
          if (!editingGoal) {
            return;
          }

          const nextGoalPoints = getDraftGoalPoints(payload as UpdateEmployeeGoalInput);
          const pointsWithoutEditingGoal = Math.max(quarterAllocatedPoints - editingGoal.totalPoints, 0);
          if (pointsWithoutEditingGoal + nextGoalPoints > EMPLOYEE_QUARTER_POINT_LIMIT) {
            message.error(TEXT.pointLimitExceeded);
            return;
          }

          updateGoalMutation.mutate({
            goalId: editingGoal.id,
            payload: payload as UpdateEmployeeGoalInput
          });
        }}
      />
    </Space>
  );
}
