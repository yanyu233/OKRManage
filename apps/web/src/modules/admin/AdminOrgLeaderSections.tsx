import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, InputNumber, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput, ReviewGroupRecord } from '../../shared/types/admin-config';
import { createGroupLeaderBindingRecord, createReviewGroupRecord, createSectionLeaderBindingRecord, totalQuotaSeats } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

export function LeaderSections({ draft, updateCollection }: { draft: AdminOrgBootstrapInput; updateCollection: UpdateCollection }) {
  const userOptions = draft.users.map((user) => ({ label: user.name || user.id, value: user.id }));
  const sectionOptions = draft.sections.map((section) => ({ label: section.name || section.id, value: section.id }));
  const reviewGroupOptions = draft.reviewGroups.map((group) => ({ label: group.name || group.id, value: group.id }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard title="Section Leader Bindings" actionLabel="Add Section Leader" onAdd={() => updateCollection('sectionLeaderBindings', (items) => [...items, createSectionLeaderBindingRecord(draft.users.at(0)?.id ?? null, draft.sections.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.sectionLeaderBindings}
          columns={[
            {
              title: 'Leader',
              render: (_value, record) => (
                <Select
                  value={record.leaderUserId || undefined}
                  options={userOptions}
                  placeholder="Choose leader"
                  onChange={(value) => updateCollection('sectionLeaderBindings', (items) => items.map((item) => (item.id === record.id ? { ...item, leaderUserId: value } : item)))}
                />
              )
            },
            {
              title: 'Section',
              render: (_value, record) => (
                <Select
                  value={record.sectionId || undefined}
                  options={sectionOptions}
                  placeholder="Choose section"
                  onChange={(value) => updateCollection('sectionLeaderBindings', (items) => items.map((item) => (item.id === record.id ? { ...item, sectionId: value } : item)))}
                />
              )
            },
            deleteColumn((record) => updateCollection('sectionLeaderBindings', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>

      <SectionCard title="Group Leader Bindings" actionLabel="Add Group Leader" onAdd={() => updateCollection('groupLeaderBindings', (items) => [...items, createGroupLeaderBindingRecord(draft.users.at(0)?.id ?? null, draft.reviewGroups.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.groupLeaderBindings}
          columns={[
            {
              title: 'Leader',
              render: (_value, record) => (
                <Select
                  value={record.leaderUserId || undefined}
                  options={userOptions}
                  placeholder="Choose leader"
                  onChange={(value) => updateCollection('groupLeaderBindings', (items) => items.map((item) => (item.id === record.id ? { ...item, leaderUserId: value } : item)))}
                />
              )
            },
            {
              title: 'Review Group',
              render: (_value, record) => (
                <Select
                  value={record.reviewGroupId || undefined}
                  options={reviewGroupOptions}
                  placeholder="Choose review group"
                  onChange={(value) => updateCollection('groupLeaderBindings', (items) => items.map((item) => (item.id === record.id ? { ...item, reviewGroupId: value } : item)))}
                />
              )
            },
            deleteColumn((record) => updateCollection('groupLeaderBindings', (items) => items.filter((item) => item.id !== record.id)))
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
    <SectionCard title="Review Groups & Fixed Seats" actionLabel="Add Review Group" onAdd={() => updateCollection('reviewGroups', (items) => [...items, createReviewGroupRecord()])}>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        {draft.reviewGroups.map((reviewGroup) => {
          const memberCount = memberCountByReviewGroup.get(reviewGroup.id) ?? 0;
          const seatCount = totalQuotaSeats(reviewGroup);
          const overflow = seatCount > memberCount;

          return (
            <Card className="review-group-card" key={reviewGroup.id} variant="borderless">
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <div className="admin-section-card__header">
                  <Input value={reviewGroup.name} placeholder="Review group name" onChange={(event) => updateReviewGroup(reviewGroup.id, { name: event.target.value })} />
                  <Button danger type="text" icon={<DeleteOutlined />} onClick={() => updateCollection('reviewGroups', (items) => items.filter((item) => item.id !== reviewGroup.id))}>
                    Delete
                  </Button>
                </div>
                <div className="review-group-card__topline">
                  <Space size={12}>
                    <Typography.Text type="secondary">Members {memberCount}</Typography.Text>
                    <Typography.Text type="secondary">Seats {seatCount}</Typography.Text>
                  </Space>
                  <Space size={8}>
                    <Typography.Text type="secondary">Active</Typography.Text>
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
                          style={{ width: '100%' }}
                          onChange={(value) => updateReviewGroup(reviewGroup.id, { quotas: reviewGroup.quotas.map((entry) => (entry.gradeCode === quota.gradeCode ? { ...entry, seatCount: Number(value ?? 0) } : entry)) })}
                        />
                      </Space>
                    </Card>
                  ))}
                </div>
                {overflow ? <Typography.Text type="danger">Total seats exceed active member count. Save will be blocked.</Typography.Text> : null}
              </Space>
            </Card>
          );
        })}
      </Space>
    </SectionCard>
  );
}

function SectionCard({ title, actionLabel, onAdd, children }: { title: string; actionLabel: string; onAdd: () => void; children: ReactNode }) {
  return (
    <Card className="admin-section-card" variant="borderless">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div className="admin-section-card__header">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>{title}</Typography.Title>
          <Button icon={<PlusOutlined />} onClick={onAdd}>{actionLabel}</Button>
        </div>
        {children}
      </Space>
    </Card>
  );
}

function deleteColumn<T extends { id: string }>(onDelete: (record: T) => void) {
  return {
    title: 'Actions',
    width: 100,
    render: (_value: unknown, record: T) => (
      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
        Delete
      </Button>
    )
  };
}
