import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEmployeeGoalDetail, updateEmployeeGoal } from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getGoalStatusLabel } from '../../shared/i18n/labels';
import { EmployeeCreateGoalDialog } from './EmployeeCreateGoalDialog';
import { EmployeeGoalKeyResultWorkspace } from './EmployeeGoalKeyResultWorkspace';
import { isQuarterPointLimitError } from './employee.helpers';
import './employee.css';

const TEXT = {
  loading: '正在加载目标详情...',
  loadFailedTitle: '加载失败',
  loadFailedDescription: '目标详情加载失败',
  back: '返回我的 OKR',
  goalDescriptionFallback: '暂无目标说明',
  editGoal: '编辑目标',
  editSuccess: '目标修改已保存。',
  editFailed: '目标修改失败，请稍后重试。',
  draftHint: '当前仍可继续修改目标与关键结果内容。',
  confirmedHint: '目标已确认，当前以补充材料和维护完成情况为主。',
  pendingReviewHint: '目标已进入待评分，可继续补充材料供评分时查看。',
  completedHint: '目标已评分完成，仍可继续查看和补充材料。'
} as const;

function canEditGoal(status: string) {
  return status === 'draft';
}

function isMissingGoalError(error: unknown) {
  return error instanceof ApiError && error.status === 404 && error.message.toLowerCase() === 'goal not found';
}

export function EmployeeGoalPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goalId = '' } = useParams();
  const [editOpen, setEditOpen] = useState(false);

  const goalQuery = useQuery({
    queryKey: ['employee-goal', goalId],
    queryFn: () => getEmployeeGoalDetail(goalId),
    enabled: Boolean(goalId)
  });

  const updateGoalMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateEmployeeGoal>[1]) => updateEmployeeGoal(goalId, payload),
    onSuccess: async () => {
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] })
      ]);
      message.success(TEXT.editSuccess);
    },
    onError: (error) => {
      message.error(
        isQuarterPointLimitError(error)
          ? '当前季度所有目标的关键结果分值合计不能超过 100 分。'
          : error instanceof ApiError
            ? error.message
            : TEXT.editFailed
      );
    }
  });

  const goal = goalQuery.data;
  const missingGoal = goalQuery.isError ? isMissingGoalError(goalQuery.error) : false;

  useEffect(() => {
    if (missingGoal) {
      navigate('/employee/okr', { replace: true });
    }
  }, [missingGoal, navigate]);

  const statusHint = useMemo(() => {
    if (!goal) {
      return null;
    }

    switch (goal.status) {
      case 'draft':
        return { type: 'info' as const, message: TEXT.draftHint };
      case 'confirmed':
        return { type: 'info' as const, message: TEXT.confirmedHint };
      case 'pending-review':
        return { type: 'warning' as const, message: TEXT.pendingReviewHint };
      case 'completed':
        return { type: 'success' as const, message: TEXT.completedHint };
      default:
        return null;
    }
  }, [goal]);

  if (goalQuery.isLoading || missingGoal) {
    return <Card className="employee-toolbar-card">{TEXT.loading}</Card>;
  }

  if (goalQuery.isError || !goal) {
    const description = goalQuery.error instanceof ApiError ? goalQuery.error.message : TEXT.loadFailedDescription;

    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={description} />
      </Card>
    );
  }

  const showStatusTag = goal.status !== 'draft';

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }} onClick={() => navigate('/employee/okr')}>
              {TEXT.back}
            </Button>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              {goal.code} {goal.name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {[formatQuarterLabel(goal.year, goal.quarter), showStatusTag ? getGoalStatusLabel(goal.status) : null, `${goal.totalPoints} 分`]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Paragraph>
          </div>
          <Space wrap size={[6, 6]} className="employee-goal-chip-row">
            {showStatusTag ? <Tag color={goal.status === 'completed' ? 'green' : 'blue'}>{getGoalStatusLabel(goal.status)}</Tag> : null}
            <Tag>{`${goal.keyResultCount} 条 KR`}</Tag>
            <Tag>{`${goal.proofCount} 份材料`}</Tag>
            {goal.missingProofKeyResultCount > 0 ? <Tag color="gold">{`待上传 ${goal.missingProofKeyResultCount} 项`}</Tag> : null}
            <Tag>{`当前得分 ${formatNullableScore(goal.currentScore)}`}</Tag>
          </Space>
        </div>
      </Card>

      <Card className="employee-detail-card" variant="borderless">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {goal.description ?? TEXT.goalDescriptionFallback}
          </Typography.Paragraph>

          {statusHint ? <Alert type={statusHint.type} showIcon message={statusHint.message} /> : null}

          {canEditGoal(goal.status) ? (
            <Space wrap>
              <Button onClick={() => setEditOpen(true)}>{TEXT.editGoal}</Button>
            </Space>
          ) : null}
        </Space>
      </Card>

      <EmployeeGoalKeyResultWorkspace goal={goal} />

      <EmployeeCreateGoalDialog
        open={editOpen}
        mode="edit"
        initialValue={goal}
        confirmLoading={updateGoalMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onConfirm={(payload) => updateGoalMutation.mutate(payload)}
      />
    </Space>
  );
}
