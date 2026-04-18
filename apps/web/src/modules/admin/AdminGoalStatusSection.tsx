import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { getAdminGoalStatusControls, transitionAdminGoalStatuses } from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import { getGoalStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type {
  AdminGoalStatusControlRecord,
  AdminGoalStatusTransitionInput,
  AdminGoalStatusTransitionResponse,
  AdminOrgBootstrapInput
} from '../../shared/types/admin-config';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';

const START_YEAR = 2026;
const TEXT = {
  title: '目标状态控制',
  description: '按季度批量切换目标状态。若自动流转服务未启动，可在这里手工把草稿或已确认目标转为待评分。',
  yearQuarter: '年度 / 季度',
  employee: '员工',
  allEmployees: '全部员工',
  refresh: '刷新列表',
  confirmAll: '当前范围改为已确认',
  reopenAll: '当前范围恢复草稿',
  moveToPendingReview: '当前范围转为待评分',
  successConfirmed: '当前范围目标已改为已确认。',
  successDraft: '当前范围目标已恢复为草稿。',
  successPendingReview: '当前范围目标已手工转为待评分。',
  autoAdvanced: '当前范围目标已确认，其中 {count} 个已过季目标已自动进入待评分。',
  loadFailed: '目标状态控制加载失败。',
  empty: '当前范围下暂无目标。',
  owner: '员工',
  code: '目标编号',
  name: '目标名称',
  status: '当前状态',
  draftLabel: '草稿',
  actionsHint: '手工转待评分仅作为自动服务未运行时的兜底操作；执行后当前范围内的草稿和已确认目标都会进入待评分。'
} as const;

type TransitionTargetStatus = AdminGoalStatusTransitionInput['targetStatus'];

function getStatusTagColor(status: AdminGoalStatusControlRecord['status']) {
  switch (status) {
    case 'draft':
      return 'default';
    case 'completed':
      return 'green';
    case 'pending-review':
      return 'gold';
    default:
      return 'blue';
  }
}

export function AdminGoalStatusSection({ draft }: { draft: AdminOrgBootstrapInput }) {
  const { message } = App.useApp();
  const { year, quarter, yearOptions, quarterOptions, setPeriod } = useSharedQuarterPeriod({
    startYear: START_YEAR,
    futureRange: 8
  });
  const [userId, setUserId] = useState<string | null>(null);

  const employeeOptions = useMemo(
    () => [
      { value: '__all__', label: TEXT.allEmployees },
      ...draft.users
        .filter((user) => user.isActive)
        .map((user) => ({
          value: user.id,
          label: user.name
        }))
    ],
    [draft.users]
  );

  const controlsQuery = useQuery({
    queryKey: ['admin-goal-status-controls', year, quarter, userId],
    queryFn: () =>
      getAdminGoalStatusControls({
        year,
        quarter,
        userId
      })
  });

  const transitionMutation = useMutation({
    mutationFn: (targetStatus: TransitionTargetStatus) =>
      transitionAdminGoalStatuses({
        year,
        quarter,
        userId,
        targetStatus
      }),
    onSuccess: async (payload: AdminGoalStatusTransitionResponse, targetStatus: TransitionTargetStatus) => {
      await controlsQuery.refetch();

      if (targetStatus === 'confirmed' && payload.autoAdvancedGoalCount > 0) {
        message.success(TEXT.autoAdvanced.replace('{count}', String(payload.autoAdvancedGoalCount)));
        return;
      }

      if (targetStatus === 'pending-review') {
        message.success(TEXT.successPendingReview);
        return;
      }

      message.success(targetStatus === 'confirmed' ? TEXT.successConfirmed : TEXT.successDraft);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.loadFailed);
    }
  });

  return (
    <Card className="admin-section-card" variant="borderless">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div className="admin-section-card__header">
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Text type="secondary">{TEXT.description}</Typography.Text>
          </div>
          <Button onClick={() => controlsQuery.refetch()}>{TEXT.refresh}</Button>
        </div>

        <Space wrap size={[16, 16]}>
          <div>
            <Typography.Text strong>{TEXT.yearQuarter}</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <YearQuarterPickerPopover
                year={year}
                quarter={quarter}
                yearOptions={yearOptions}
                quarterOptions={quarterOptions}
                onChange={(nextYear, nextQuarter) => {
                  setPeriod(nextYear, nextQuarter);
                }}
              />
            </div>
          </div>
          <div style={{ minWidth: 260 }}>
            <Typography.Text strong>{TEXT.employee}</Typography.Text>
            <Select
              style={{ width: '100%', display: 'block', marginTop: 8 }}
              value={userId ?? '__all__'}
              options={employeeOptions}
              onChange={(value) => setUserId(value === '__all__' ? null : value)}
            />
          </div>
        </Space>

        <Space wrap>
          <Button
            type="primary"
            loading={transitionMutation.isPending}
            onClick={() => transitionMutation.mutate('confirmed')}
          >
            {TEXT.confirmAll}
          </Button>
          <Button loading={transitionMutation.isPending} onClick={() => transitionMutation.mutate('draft')}>
            {TEXT.reopenAll}
          </Button>
          <Button loading={transitionMutation.isPending} onClick={() => transitionMutation.mutate('pending-review')}>
            {TEXT.moveToPendingReview}
          </Button>
        </Space>

        <Alert type="info" showIcon message={TEXT.actionsHint} />

        {controlsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={TEXT.loadFailed}
            description={controlsQuery.error instanceof ApiError ? controlsQuery.error.message : undefined}
          />
        ) : controlsQuery.data?.records.length ? (
          <Table<AdminGoalStatusControlRecord>
            rowKey="goalId"
            pagination={false}
            dataSource={controlsQuery.data.records}
            columns={[
              { title: TEXT.owner, dataIndex: 'ownerName', key: 'ownerName' },
              { title: TEXT.code, dataIndex: 'code', key: 'code', width: 120 },
              { title: TEXT.name, dataIndex: 'name', key: 'name' },
              {
                title: TEXT.status,
                key: 'status',
                width: 140,
                render: (_value, record) => (
                  <Tag color={getStatusTagColor(record.status)}>
                    {record.status === 'draft' ? TEXT.draftLabel : getGoalStatusLabel(record.status)}
                  </Tag>
                )
              }
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
        )}
      </Space>
    </Card>
  );
}
