import { CalendarOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Input, Popover, Row, Space, Statistic, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createEmployeeGoal,
  getEmployeeGoalDetail,
  getEmployeeGoalTemplates,
  getEmployeeOkr,
  importEmployeeGoalTemplates,
  updateEmployeeGoal
} from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getGoalStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { CreateEmployeeGoalInput, EmployeeGoalDetail, UpdateEmployeeGoalInput } from '../../shared/types/employee';
import {
  EMPLOYEE_QUARTER_POINT_LIMIT,
  filterEmployeeGoals,
  getDraftGoalPoints,
  getEmployeeQuarterAllocatedPoints,
  isQuarterPointLimitError
} from './employee.helpers';
import { EmployeeCreateGoalDialog } from './EmployeeCreateGoalDialog';
import { EmployeePeriodPickerDialog } from './EmployeePeriodPickerDialog';
import { EmployeeTemplateImportDialog } from './EmployeeTemplateImportDialog';
import './employee.css';

const START_YEAR = 2026;
const YEAR_RANGE_FUTURE = 8;
const TEXT = {
  title: '\u6211\u7684 OKR',
  loading: '\u6b63\u5728\u52a0\u8f7d\u6211\u7684 OKR...',
  loadFailedTitle: '\u52a0\u8f7d\u5931\u8d25',
  loadFailedDescription: '\u5458\u5de5 OKR \u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u76ee\u6807\u540d\u79f0\u6216\u8bf4\u660e',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  groupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  goalCount: '\u76ee\u6807\u6570',
  keyResultCount: '\u5173\u952e\u7ed3\u679c\u6570',
  completedKeyResultCount: '\u5df2\u5b8c\u6210\u5173\u952e\u7ed3\u679c',
  proofCount: '\u8bc1\u660e\u6750\u6599',
  quarterScore: '\u5f53\u524d\u5b63\u5ea6\u5f97\u5206',
  createGoal: '\u65b0\u5efa\u76ee\u6807',
  createSuccess: '\u76ee\u6807\u521b\u5efa\u6210\u529f\u3002',
  importTemplates: '\u5bfc\u5165\u6a21\u677f\u76ee\u6807',
  importSuccess: '\u6a21\u677f\u76ee\u6807\u5bfc\u5165\u6210\u529f\u3002',
  goalsTitle: '\u672c\u5b63\u5ea6\u76ee\u6807',
  goalsDescription:
    '\u5728\u8fd9\u91cc\u67e5\u770b\u672c\u5b63\u5ea6\u7684\u76ee\u6807\u4e0e\u5173\u952e\u7ed3\u679c\u8fdb\u5c55\uff0c\u70b9\u51fb\u76ee\u6807\u540e\u53ef\u8fdb\u5165\u8be6\u60c5\u9875\u9762\u3002',
  goalDescriptionFallback: '\u6682\u65e0\u76ee\u6807\u8bf4\u660e',
  keyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  completedTag: '\u6761\u5df2\u5b8c\u6210',
  proofTag: '\u4efd\u6750\u6599',
  currentScoreTagPrefix: '\u5f53\u524d\u5f97\u5206',
  editGoal: '\u7f16\u8f91\u76ee\u6807',
  editLoadFailed: '\u76ee\u6807\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  editSuccess: '\u76ee\u6807\u4fee\u6539\u5df2\u4fdd\u5b58\u3002',
  editFailed: '\u76ee\u6807\u4fee\u6539\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  pointLimitExceeded: '\u5f53\u524d\u5b63\u5ea6\u6240\u6709\u76ee\u6807\u7684\u5173\u952e\u7ed3\u679c\u5206\u503c\u5408\u8ba1\u4e0d\u80fd\u8d85\u8fc7 100 \u5206\u3002',
  viewGoalDetail: '\u67e5\u770b\u76ee\u6807\u8be6\u60c5',
  emptyGoals: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u76ee\u6807',
  selectPeriod: '\u9009\u62e9\u65f6\u95f4'
} as const;

function canEditGoal(status: string) {
  return status === 'draft';
}

export function EmployeeOkrPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  const okrQuery = useQuery({
    queryKey: ['employee-okr', year, quarter],
    queryFn: () =>
      getEmployeeOkr({
        year,
        quarter
      })
  });

  const summaryCards = useMemo(
    () =>
      okrQuery.data
        ? [
            [TEXT.goalCount, okrQuery.data.employee.goalCount],
            [TEXT.keyResultCount, okrQuery.data.employee.keyResultCount],
            [TEXT.completedKeyResultCount, okrQuery.data.employee.completedKeyResultCount],
            [TEXT.proofCount, okrQuery.data.employee.proofCount]
          ]
        : [],
    [okrQuery.data]
  );

  const filteredGoals = useMemo(
    () => filterEmployeeGoals(okrQuery.data?.goals ?? [], keyword),
    [keyword, okrQuery.data?.goals]
  );

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
    const message = okrQuery.error instanceof ApiError ? okrQuery.error.message : TEXT.loadFailedDescription;
    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={message} />
      </Card>
    );
  }

  const payload = okrQuery.data!;
  const quarterAllocatedPoints = getEmployeeQuarterAllocatedPoints(payload.goals);

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
            <Statistic title={title} value={value as number} />
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

          {filteredGoals.length ? (
            <Row gutter={[20, 20]}>
              {filteredGoals.map((goal) => {
                const goalEditable = canEditGoal(goal.status);

                return (
                  <Col xs={24} xl={12} key={goal.id}>
                    <Card className="employee-goal-card" variant="borderless" onClick={() => navigate(`/employee/goal/${goal.id}`)}>
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <div className="employee-goal-card__header">
                          <div className="employee-goal-card__content">
                            <Typography.Title level={4} style={{ marginBottom: 8 }}>
                              {goal.code} {goal.name}
                            </Typography.Title>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                              {goal.description ?? TEXT.goalDescriptionFallback}
                            </Typography.Paragraph>
                          </div>
                          <div className="employee-goal-card__actions" onClick={(event) => event.stopPropagation()}>
                            <Button
                              aria-label={TEXT.editGoal}
                              size="small"
                              icon={<EditOutlined aria-hidden />}
                              className={[
                                'employee-goal-card__edit-button',
                                goalEditable
                                  ? 'employee-goal-card__edit-button--editable'
                                  : 'employee-goal-card__edit-button--readonly'
                              ].join(' ')}
                              disabled={!goalEditable}
                              loading={editingGoalId === goal.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void openEditDialog(goal.id);
                              }}
                            >
                              {TEXT.editGoal}
                            </Button>
                            {goal.status === 'draft' ? null : (
                              <Tag color={goal.status === 'completed' ? 'green' : 'blue'}>{getGoalStatusLabel(goal.status)}</Tag>
                            )}
                          </div>
                        </div>

                        <Space wrap size={[8, 8]}>
                          <Tag>{`${goal.totalPoints} \u5206`}</Tag>
                          <Tag>{`${goal.keyResultCount} ${TEXT.keyResultCountTag}`}</Tag>
                          <Tag>{`${goal.completedKeyResultCount} ${TEXT.completedTag}`}</Tag>
                          <Tag>{`${goal.proofCount} ${TEXT.proofTag}`}</Tag>
                          <Tag>{`${TEXT.currentScoreTagPrefix} ${formatNullableScore(goal.currentScore)}`}</Tag>
                        </Space>

                        <Button type="link" style={{ paddingInline: 0 }}>
                          {TEXT.viewGoalDetail}
                        </Button>
                      </Space>
                    </Card>
                  </Col>
                );
              })}
            </Row>
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
