import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { getAdminGoalStatusControls, transitionAdminGoalStatuses } from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import { getGoalStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type { AdminOrgBootstrapInput } from '../../shared/types/admin-config';
import { YearQuarterPickerPopover } from '../../shared/ui/PeriodPickerPopover';

const START_YEAR = 2026;
const TEXT = {
  title: '目标状态控制',
  description: '按季度批量将员工目标在草稿与已确认之间切换。草稿状态不在员工前端显示，已确认后员工无法修改目标/KR内容。',
  year: '年度',
  quarter: '季度',
  employee: '员工',
  allEmployees: '全部员工',
  refresh: '刷新列表',
  confirmAll: '当前范围改为已确认',
  reopenAll: '当前范围恢复草稿',
  successConfirmed: '当前范围目标已改为已确认。',
  successDraft: '当前范围目标已恢复为草稿。',
  loadFailed: '目标状态控制加载失败',
  empty: '当前范围下没有目标',
  owner: '员工',
  code: '目标编号',
  name: '目标名称',
  status: '当前状态',
  actionsHint: '这里的切换仅影响目标/KR内容是否可修改，不影响证明材料上传入口。'
} as const;

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
    mutationFn: (targetStatus: 'draft' | 'confirmed') =>
      transitionAdminGoalStatuses({
        year,
        quarter,
        userId,
        targetStatus
      }),
    onSuccess: async (_payload, targetStatus) => {
      await controlsQuery.refetch();
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
            <Typography.Text strong>{`${TEXT.year} / ${TEXT.quarter}`}</Typography.Text>
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
          <Table
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
                  <Tag color={record.status === 'draft' ? 'default' : record.status === 'completed' ? 'green' : 'blue'}>
                    {record.status === 'draft' ? '草稿（前端隐藏）' : getGoalStatusLabel(record.status)}
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
