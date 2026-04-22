import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  getAdminGoalStatusControls,
  getAdminQuarterParticipationExclusions,
  saveAdminQuarterParticipationExclusions,
  transitionAdminGoalStatuses
} from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import { getGoalStatusLabel } from '../../shared/i18n/labels';
import { useSharedQuarterPeriod } from '../../shared/store/quarter-store';
import type {
  AdminGoalStatusControlRecord,
  AdminGoalStatusTransitionInput,
  AdminGoalStatusTransitionResponse,
  AdminOrgBootstrapInput,
  AdminQuarterParticipationExclusionRecord
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
  actionsHint: '手工转待评分仅作为自动服务未运行时的兜底操作；执行后当前范围内的草稿和已确认目标都会进入待评分。',
  exclusionTitle: '本季度不参评员工',
  exclusionDescription: '被设置为不参评的员工，不会进入当前季度的评分工作台、全部 OKR 和季度排名公开校验。',
  exclusionSelectLabel: '选择员工',
  exclusionPlaceholder: '选择本季度不参评的员工',
  exclusionSectionLabel: '按科室批量选择',
  exclusionSectionPlaceholder: '选择科室',
  exclusionAddSection: '加入科室员工',
  exclusionSelectAll: '全选全部员工',
  exclusionClear: '清空已选',
  exclusionSelectedCount: '已选 {count} 人',
  exclusionSave: '保存不参评名单',
  exclusionSaveSuccess: '本季度不参评员工已更新。',
  exclusionLoadFailed: '不参评员工配置加载失败。',
  exclusionEmpty: '当前季度未配置不参评员工。',
  exclusionName: '员工',
  exclusionSection: '科室',
  exclusionGroup: '小组',
  exclusionPosition: '岗位',
  remove: '移除'
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
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);

  const activeEmployeeIds = useMemo(
    () =>
      new Set(
        draft.roleAssignments
          .filter((assignment) => assignment.isEnabled && assignment.roleCode === 'employee')
          .map((assignment) => assignment.userId)
      ),
    [draft.roleAssignments]
  );

  const allEmployeeUserIds = useMemo(
    () =>
      draft.users
        .filter((user) => user.isActive && activeEmployeeIds.has(user.id))
        .map((user) => user.id),
    [activeEmployeeIds, draft.users]
  );

  const employeeOptions = useMemo(
    () => [
      { value: '__all__', label: TEXT.allEmployees },
      ...draft.users
        .filter((user) => user.isActive && activeEmployeeIds.has(user.id))
        .map((user) => ({
          value: user.id,
          label: buildEmployeeOptionLabel(draft, user.id)
        }))
    ],
    [activeEmployeeIds, draft]
  );

  const quarterExclusionEmployeeOptions = useMemo(
    () =>
      draft.users
        .filter((user) => user.isActive && activeEmployeeIds.has(user.id))
        .map((user) => ({
          value: user.id,
          label: buildEmployeeOptionLabel(draft, user.id)
        })),
    [activeEmployeeIds, draft]
  );

  const sectionOptions = useMemo(
    () =>
      draft.sections
        .filter((section) => section.isActive)
        .map((section) => ({
          value: section.id,
          label: section.name
        })),
    [draft.sections]
  );

  const selectedSectionEmployeeIds = useMemo(() => {
    if (!sectionId) {
      return [];
    }

    return draft.users
      .filter((user) => user.isActive && activeEmployeeIds.has(user.id) && user.sectionId === sectionId)
      .map((user) => user.id);
  }, [activeEmployeeIds, draft.users, sectionId]);

  const controlsQuery = useQuery({
    queryKey: ['admin-goal-status-controls', year, quarter, userId],
    queryFn: () =>
      getAdminGoalStatusControls({
        year,
        quarter,
        userId
      })
  });

  const quarterParticipationQuery = useQuery({
    queryKey: ['admin-quarter-participation-exclusions', year, quarter],
    queryFn: () =>
      getAdminQuarterParticipationExclusions({
        year,
        quarter
      })
  });

  useEffect(() => {
    if (!quarterParticipationQuery.data) {
      return;
    }

    setExcludedUserIds(quarterParticipationQuery.data.records.map((record) => record.userId));
  }, [quarterParticipationQuery.data]);

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

  const saveExclusionsMutation = useMutation({
    mutationFn: (nextUserIds: string[]) =>
      saveAdminQuarterParticipationExclusions({
        year,
        quarter,
        userIds: nextUserIds
      }),
    onSuccess: async (payload) => {
      setExcludedUserIds(payload.records.map((record) => record.userId));
      await Promise.all([quarterParticipationQuery.refetch(), controlsQuery.refetch()]);
      message.success(TEXT.exclusionSaveSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.exclusionLoadFailed);
    }
  });

  const exclusionRecords = quarterParticipationQuery.data?.records ?? [];
  const exclusionChanged = useMemo(() => {
    const current = [...excludedUserIds].sort();
    const saved = exclusionRecords.map((record) => record.userId).sort();
    return current.length !== saved.length || current.some((entry, index) => entry !== saved[index]);
  }, [excludedUserIds, exclusionRecords]);

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
          <Button
            onClick={() => {
              void Promise.all([controlsQuery.refetch(), quarterParticipationQuery.refetch()]);
            }}
          >
            {TEXT.refresh}
          </Button>
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

        <div style={{ paddingTop: 8 }}>
          <Typography.Title level={5} style={{ marginBottom: 4 }}>
            {TEXT.exclusionTitle}
          </Typography.Title>
          <Typography.Text type="secondary">{TEXT.exclusionDescription}</Typography.Text>
        </div>

        <Space wrap size={[16, 12]} align="end" style={{ width: '100%' }}>
          <div style={{ minWidth: 360, flex: '1 1 360px' }}>
            <Typography.Text strong>{TEXT.exclusionSelectLabel}</Typography.Text>
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%', display: 'block', marginTop: 8 }}
              placeholder={TEXT.exclusionPlaceholder}
              optionFilterProp="label"
              maxTagCount="responsive"
              value={excludedUserIds}
              options={quarterExclusionEmployeeOptions}
              onChange={(value) => setExcludedUserIds(value)}
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <Typography.Text strong>{TEXT.exclusionSectionLabel}</Typography.Text>
            <Select
              allowClear
              style={{ width: '100%', display: 'block', marginTop: 8 }}
              placeholder={TEXT.exclusionSectionPlaceholder}
              value={sectionId ?? undefined}
              options={sectionOptions}
              onChange={(value) => setSectionId(value ?? null)}
            />
          </div>
        </Space>

        <Space wrap size={[12, 12]}>
          <Button
            onClick={() => {
              if (!selectedSectionEmployeeIds.length) {
                return;
              }

              setExcludedUserIds((current) => mergeUniqueUserIds(current, selectedSectionEmployeeIds));
            }}
            disabled={!selectedSectionEmployeeIds.length}
          >
            {TEXT.exclusionAddSection}
          </Button>
          <Button onClick={() => setExcludedUserIds(allEmployeeUserIds)} disabled={!allEmployeeUserIds.length}>
            {TEXT.exclusionSelectAll}
          </Button>
          <Button onClick={() => setExcludedUserIds([])} disabled={excludedUserIds.length === 0}>
            {TEXT.exclusionClear}
          </Button>
          <Typography.Text type="secondary">
            {TEXT.exclusionSelectedCount.replace('{count}', String(excludedUserIds.length))}
          </Typography.Text>
          <Button
            type="primary"
            loading={saveExclusionsMutation.isPending}
            disabled={!exclusionChanged}
            onClick={() => saveExclusionsMutation.mutate(excludedUserIds)}
          >
            {TEXT.exclusionSave}
          </Button>
        </Space>

        {quarterParticipationQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message={TEXT.exclusionLoadFailed}
            description={quarterParticipationQuery.error instanceof ApiError ? quarterParticipationQuery.error.message : undefined}
          />
        ) : exclusionRecords.length ? (
          <Table<AdminQuarterParticipationExclusionRecord>
            rowKey="userId"
            pagination={false}
            dataSource={exclusionRecords}
            columns={[
              { title: TEXT.exclusionName, dataIndex: 'userName', key: 'userName', width: 160 },
              { title: TEXT.exclusionSection, dataIndex: 'sectionName', key: 'sectionName', width: 180 },
              { title: TEXT.exclusionGroup, dataIndex: 'reviewGroupName', key: 'reviewGroupName', width: 180 },
              { title: TEXT.exclusionPosition, dataIndex: 'positionName', key: 'positionName' },
              {
                title: '',
                key: 'actions',
                width: 96,
                render: (_value, record) => (
                  <Button
                    type="link"
                    onClick={() => {
                      setExcludedUserIds((current) => current.filter((userIdEntry) => userIdEntry !== record.userId));
                    }}
                  >
                    {TEXT.remove}
                  </Button>
                )
              }
            ]}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.exclusionEmpty} />
        )}
      </Space>
    </Card>
  );
}

function buildEmployeeOptionLabel(draft: AdminOrgBootstrapInput, userId: string) {
  const user = draft.users.find((entry) => entry.id === userId);
  if (!user) {
    return userId;
  }

  const sectionName = user.sectionId
    ? draft.sections.find((section) => section.id === user.sectionId)?.name ?? null
    : null;
  const extras = [user.employeeNo, sectionName].filter((value): value is string => Boolean(value));
  return extras.length ? `${user.name} (${extras.join(' / ')})` : user.name;
}

function mergeUniqueUserIds(current: string[], incoming: string[]) {
  return Array.from(new Set([...current, ...incoming]));
}
