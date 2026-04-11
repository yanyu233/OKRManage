import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, InputNumber, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput, ReviewGroupRecord } from '../../shared/types/admin-config';
import {
  createGroupLeaderBindingRecord,
  createReviewGroupRecord,
  createSectionLeaderBindingRecord,
  totalQuotaSeats
} from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

const TEXT = {
  leaderLabel: '\u8d1f\u8d23\u4eba',
  sectionTitle: '\u79d1\u5ba4\u9886\u5bfc\u7ed1\u5b9a',
  addSectionLeader: '\u65b0\u589e\u79d1\u5ba4\u9886\u5bfc',
  selectLeader: '\u8bf7\u9009\u62e9\u8d1f\u8d23\u4eba',
  sectionLabel: '\u79d1\u5ba4',
  selectSection: '\u8bf7\u9009\u62e9\u79d1\u5ba4',
  groupTitle: '\u5c0f\u7ec4\u8d1f\u8d23\u4eba\u7ed1\u5b9a',
  addGroupLeader: '\u65b0\u589e\u5c0f\u7ec4\u8d1f\u8d23\u4eba',
  reviewGroupLabel: '\u8bc4\u4ef7\u7ec4',
  selectReviewGroup: '\u8bf7\u9009\u62e9\u8bc4\u4ef7\u7ec4',
  actions: '\u64cd\u4f5c',
  remove: '\u5220\u9664',
  reviewGroupsTitle: '\u8bc4\u4ef7\u7ec4\u4e0e\u6863\u4f4d\u540d\u989d',
  addReviewGroup: '\u65b0\u589e\u8bc4\u4ef7\u7ec4',
  reviewGroupNamePlaceholder: '\u8bf7\u8f93\u5165\u8bc4\u4ef7\u7ec4\u540d\u79f0',
  memberCount: '\u7ec4\u5185\u5458\u5de5',
  seatCount: '\u5f53\u524d\u540d\u989d',
  enabled: '\u542f\u7528',
  quotaOverflow: '\u5f53\u524d\u603b\u540d\u989d\u8d85\u8fc7\u7ec4\u5185\u5458\u5de5\u4eba\u6570\uff0c\u4fdd\u5b58\u65f6\u4f1a\u88ab\u963b\u6b62\u3002',
  quotaHint: '\u56fa\u5b9a\u540d\u989d\u6309\u4eba\u6570\u63a7\u5236\uff0c\u4fdd\u5b58\u65f6\u4f1a\u518d\u6b21\u6821\u9a8c\u3002'
} as const;

export function LeaderSections({
  draft,
  updateCollection
}: {
  draft: AdminOrgBootstrapInput;
  updateCollection: UpdateCollection;
}) {
  const userOptions = draft.users.map((user) => ({ label: user.name || user.id, value: user.id }));
  const sectionOptions = draft.sections.map((section) => ({ label: section.name || section.id, value: section.id }));
  const reviewGroupOptions = draft.reviewGroups.map((group) => ({ label: group.name || group.id, value: group.id }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard
        title={TEXT.sectionTitle}
        actionLabel={TEXT.addSectionLeader}
        onAdd={() =>
          updateCollection('sectionLeaderBindings', (items) => [
            ...items,
            createSectionLeaderBindingRecord(draft.users.at(0)?.id ?? null, draft.sections.at(0)?.id ?? null)
          ])
        }
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.sectionLeaderBindings}
          columns={[
            {
              title: TEXT.leaderLabel,
              render: (_value, record) => (
                <Select
                  value={record.leaderUserId || undefined}
                  options={userOptions}
                  placeholder={TEXT.selectLeader}
                  onChange={(value) =>
                    updateCollection('sectionLeaderBindings', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, leaderUserId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.sectionLabel,
              render: (_value, record) => (
                <Select
                  value={record.sectionId || undefined}
                  options={sectionOptions}
                  placeholder={TEXT.selectSection}
                  onChange={(value) =>
                    updateCollection('sectionLeaderBindings', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, sectionId: value } : item))
                    )
                  }
                />
              )
            },
            deleteColumn((record) =>
              updateCollection('sectionLeaderBindings', (items) => items.filter((item) => item.id !== record.id))
            )
          ]}
        />
      </SectionCard>

      <SectionCard
        title={TEXT.groupTitle}
        actionLabel={TEXT.addGroupLeader}
        onAdd={() =>
          updateCollection('groupLeaderBindings', (items) => [
            ...items,
            createGroupLeaderBindingRecord(draft.users.at(0)?.id ?? null, draft.reviewGroups.at(0)?.id ?? null)
          ])
        }
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.groupLeaderBindings}
          columns={[
            {
              title: TEXT.leaderLabel,
              render: (_value, record) => (
                <Select
                  value={record.leaderUserId || undefined}
                  options={userOptions}
                  placeholder={TEXT.selectLeader}
                  onChange={(value) =>
                    updateCollection('groupLeaderBindings', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, leaderUserId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.reviewGroupLabel,
              render: (_value, record) => (
                <Select
                  value={record.reviewGroupId || undefined}
                  options={reviewGroupOptions}
                  placeholder={TEXT.selectReviewGroup}
                  onChange={(value) =>
                    updateCollection('groupLeaderBindings', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, reviewGroupId: value } : item))
                    )
                  }
                />
              )
            },
            deleteColumn((record) =>
              updateCollection('groupLeaderBindings', (items) => items.filter((item) => item.id !== record.id))
            )
          ]}
        />
      </SectionCard>
    </Space>
  );
}

export function ReviewGroupSection({
  draft,
  updateCollection,
  memberCountByReviewGroup,
  updateReviewGroup
}: {
  draft: AdminOrgBootstrapInput;
  updateCollection: UpdateCollection;
  memberCountByReviewGroup: Map<string, number>;
  updateReviewGroup: (reviewGroupId: string, patch: Partial<Omit<ReviewGroupRecord, 'memberCount'>>) => void;
}) {
  return (
    <SectionCard
      title={TEXT.reviewGroupsTitle}
      actionLabel={TEXT.addReviewGroup}
      onAdd={() => updateCollection('reviewGroups', (items) => [...items, createReviewGroupRecord()])}
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        {draft.reviewGroups.map((reviewGroup) => {
          const memberCount = memberCountByReviewGroup.get(reviewGroup.id) ?? 0;
          const seatCount = totalQuotaSeats(reviewGroup);
          const overflow = seatCount > memberCount;

          return (
            <Card className="review-group-card" key={reviewGroup.id} variant="borderless">
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <div className="admin-section-card__header">
                  <Input
                    value={reviewGroup.name}
                    placeholder={TEXT.reviewGroupNamePlaceholder}
                    onChange={(event) => updateReviewGroup(reviewGroup.id, { name: event.target.value })}
                  />
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => updateCollection('reviewGroups', (items) => items.filter((item) => item.id !== reviewGroup.id))}
                  >
                    {TEXT.remove}
                  </Button>
                </div>

                <div className="review-group-card__topline">
                  <Space size={12}>
                    <Typography.Text type="secondary">{`${TEXT.memberCount} ${memberCount} \u4eba`}</Typography.Text>
                    <Typography.Text type="secondary">{`${TEXT.seatCount} ${seatCount} \u4eba`}</Typography.Text>
                  </Space>
                  <Space size={8}>
                    <Typography.Text type="secondary">{TEXT.enabled}</Typography.Text>
                    <Switch checked={reviewGroup.isActive} onChange={(checked) => updateReviewGroup(reviewGroup.id, { isActive: checked })} />
                  </Space>
                </div>

                <div className="quota-grid">
                  {reviewGroup.quotas.map((quota) => (
                    <Card className="quota-card" size="small" key={quota.gradeCode}>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Typography.Text strong>{quota.gradeCode}</Typography.Text>
                        <InputNumber
                          min={0}
                          precision={0}
                          value={quota.seatCount}
                          controls={false}
                          style={{ width: '100%' }}
                          onChange={(value) =>
                            updateReviewGroup(reviewGroup.id, {
                              quotas: reviewGroup.quotas.map((entry) =>
                                entry.gradeCode === quota.gradeCode ? { ...entry, seatCount: Number(value ?? 0) } : entry
                              )
                            })
                          }
                        />
                      </Space>
                    </Card>
                  ))}
                </div>

                <Typography.Text type={overflow ? 'danger' : 'secondary'}>
                  {overflow ? TEXT.quotaOverflow : TEXT.quotaHint}
                </Typography.Text>
              </Space>
            </Card>
          );
        })}
      </Space>
    </SectionCard>
  );
}

function SectionCard({
  title,
  actionLabel,
  onAdd,
  children
}: {
  title: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="admin-section-card" variant="borderless">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div className="admin-section-card__header">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {title}
          </Typography.Title>
          <Button icon={<PlusOutlined />} onClick={onAdd}>
            {actionLabel}
          </Button>
        </div>
        {children}
      </Space>
    </Card>
  );
}

function deleteColumn<T extends { id: string }>(onDelete: (record: T) => void) {
  return {
    title: TEXT.actions,
    width: 100,
    render: (_value: unknown, record: T) => (
      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
        {TEXT.remove}
      </Button>
    )
  };
}
