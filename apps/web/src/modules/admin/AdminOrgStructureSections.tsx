import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput } from '../../shared/types/admin-config';
import { createDepartmentRecord, createSectionRecord, createUserRecord } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

const TEXT = {
  departmentTitle: '\u90e8\u95e8\u7ba1\u7406',
  addDepartment: '\u65b0\u589e\u90e8\u95e8',
  departmentName: '\u90e8\u95e8\u540d\u79f0',
  departmentPlaceholder: '\u8bf7\u8f93\u5165\u90e8\u95e8\u540d\u79f0',
  enabled: '\u542f\u7528',
  actions: '\u64cd\u4f5c',
  remove: '\u5220\u9664',
  sectionTitle: '\u79d1\u5ba4\u7ba1\u7406',
  addSection: '\u65b0\u589e\u79d1\u5ba4',
  sectionName: '\u79d1\u5ba4\u540d\u79f0',
  sectionPlaceholder: '\u8bf7\u8f93\u5165\u79d1\u5ba4\u540d\u79f0',
  parentDepartment: '\u6240\u5c5e\u90e8\u95e8',
  parentDepartmentPlaceholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u90e8\u95e8',
  userTitle: '\u5458\u5de5\u7ba1\u7406',
  addUser: '\u65b0\u589e\u5458\u5de5',
  userName: '\u59d3\u540d',
  userNamePlaceholder: '\u8bf7\u8f93\u5165\u5458\u5de5\u59d3\u540d',
  employeeNo: '\u5de5\u53f7',
  employeeNoPlaceholder: '\u9009\u586b',
  userDepartmentPlaceholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u90e8\u95e8',
  userSectionPlaceholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u79d1\u5ba4',
  reviewGroup: '\u6240\u5c5e\u8bc4\u4ef7\u7ec4',
  reviewGroupPlaceholder: '\u8bf7\u9009\u62e9\u8bc4\u4ef7\u7ec4',
  userSection: '\u6240\u5c5e\u79d1\u5ba4'
} as const;

export function StructureSections({
  draft,
  updateCollection
}: {
  draft: AdminOrgBootstrapInput;
  updateCollection: UpdateCollection;
}) {
  const departmentOptions = draft.departments.map((department) => ({
    label: department.name || department.id,
    value: department.id
  }));
  const reviewGroupOptions = draft.reviewGroups.map((group) => ({
    label: group.name || group.id,
    value: group.id
  }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard
        title={TEXT.departmentTitle}
        actionLabel={TEXT.addDepartment}
        onAdd={() => updateCollection('departments', (items) => [...items, createDepartmentRecord()])}
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.departments}
          columns={[
            {
              title: TEXT.departmentName,
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder={TEXT.departmentPlaceholder}
                  onChange={(event) =>
                    updateCollection('departments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.enabled,
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) =>
                    updateCollection('departments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item))
                    )
                  }
                />
              )
            },
            deleteColumn((record) =>
              updateCollection('departments', (items) => items.filter((item) => item.id !== record.id))
            )
          ]}
        />
      </SectionCard>

      <SectionCard
        title={TEXT.sectionTitle}
        actionLabel={TEXT.addSection}
        onAdd={() =>
          updateCollection('sections', (items) => [...items, createSectionRecord(draft.departments.at(0)?.id ?? null)])
        }
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.sections}
          columns={[
            {
              title: TEXT.sectionName,
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder={TEXT.sectionPlaceholder}
                  onChange={(event) =>
                    updateCollection('sections', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.parentDepartment,
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  placeholder={TEXT.parentDepartmentPlaceholder}
                  onChange={(value) =>
                    updateCollection('sections', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, departmentId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.enabled,
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) =>
                    updateCollection('sections', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item))
                    )
                  }
                />
              )
            },
            deleteColumn((record) => updateCollection('sections', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>

      <SectionCard
        title={TEXT.userTitle}
        actionLabel={TEXT.addUser}
        onAdd={() =>
          updateCollection('users', (items) => [
            ...items,
            createUserRecord(draft.departments.at(0)?.id ?? null, draft.sections.at(0)?.id ?? null)
          ])
        }
      >
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.users}
          columns={[
            {
              title: TEXT.userName,
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder={TEXT.userNamePlaceholder}
                  onChange={(event) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.employeeNo,
              render: (_value, record) => (
                <Input
                  value={record.employeeNo ?? ''}
                  placeholder={TEXT.employeeNoPlaceholder}
                  onChange={(event) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, employeeNo: event.target.value || null } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.parentDepartment,
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  allowClear
                  placeholder={TEXT.userDepartmentPlaceholder}
                  onChange={(value) =>
                    updateCollection('users', (items) =>
                      items.map((item) =>
                        item.id === record.id ? { ...item, departmentId: value ?? null, sectionId: null } : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: TEXT.userSection,
              render: (_value, record) => (
                <Select
                  value={record.sectionId || undefined}
                  allowClear
                  options={draft.sections
                    .filter((section) => (record.departmentId ? section.departmentId === record.departmentId : true))
                    .map((section) => ({ label: section.name || section.id, value: section.id }))}
                  placeholder={TEXT.userSectionPlaceholder}
                  onChange={(value) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, sectionId: value ?? null } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.reviewGroup,
              render: (_value, record) => (
                <Select
                  value={record.reviewGroupId || undefined}
                  allowClear
                  options={reviewGroupOptions}
                  placeholder={TEXT.reviewGroupPlaceholder}
                  onChange={(value) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, reviewGroupId: value ?? null } : item))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.enabled,
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item))
                    )
                  }
                />
              )
            },
            deleteColumn((record) => updateCollection('users', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>
    </Space>
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
