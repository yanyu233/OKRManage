import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput } from '../../shared/types/admin-config';
import { createDepartmentRecord, createSectionRecord, createUserRecord } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

export function StructureSections({ draft, updateCollection }: { draft: AdminOrgBootstrapInput; updateCollection: UpdateCollection }) {
  const departmentOptions = draft.departments.map((department) => ({ label: department.name || department.id, value: department.id }));
  const reviewGroupOptions = draft.reviewGroups.map((group) => ({ label: group.name || group.id, value: group.id }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard title="Departments" actionLabel="Add Department" onAdd={() => updateCollection('departments', (items) => [...items, createDepartmentRecord()])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.departments}
          columns={[
            {
              title: 'Name',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="Department name"
                  onChange={(event) => updateCollection('departments', (items) => items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item)))}
                />
              )
            },
            {
              title: 'Active',
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) => updateCollection('departments', (items) => items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item)))}
                />
              )
            },
            deleteColumn((record) => updateCollection('departments', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>

      <SectionCard title="Sections" actionLabel="Add Section" onAdd={() => updateCollection('sections', (items) => [...items, createSectionRecord(draft.departments.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.sections}
          columns={[
            {
              title: 'Name',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="Section name"
                  onChange={(event) => updateCollection('sections', (items) => items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item)))}
                />
              )
            },
            {
              title: 'Department',
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  placeholder="Choose department"
                  onChange={(value) => updateCollection('sections', (items) => items.map((item) => (item.id === record.id ? { ...item, departmentId: value } : item)))}
                />
              )
            },
            {
              title: 'Active',
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) => updateCollection('sections', (items) => items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item)))}
                />
              )
            },
            deleteColumn((record) => updateCollection('sections', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>

      <SectionCard title="Users" actionLabel="Add User" onAdd={() => updateCollection('users', (items) => [...items, createUserRecord(draft.departments.at(0)?.id ?? null, draft.sections.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.users}
          columns={[
            {
              title: 'Name',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="User name"
                  onChange={(event) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item)))}
                />
              )
            },
            {
              title: 'Employee No',
              render: (_value, record) => (
                <Input
                  value={record.employeeNo ?? ''}
                  placeholder="Optional"
                  onChange={(event) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, employeeNo: event.target.value || null } : item)))}
                />
              )
            },
            {
              title: 'Department',
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  allowClear
                  placeholder="Choose department"
                  onChange={(value) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, departmentId: value ?? null, sectionId: null } : item)))}
                />
              )
            },
            {
              title: 'Section',
              render: (_value, record) => (
                <Select
                  value={record.sectionId || undefined}
                  allowClear
                  options={draft.sections.filter((section) => (record.departmentId ? section.departmentId === record.departmentId : true)).map((section) => ({ label: section.name || section.id, value: section.id }))}
                  placeholder="Choose section"
                  onChange={(value) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, sectionId: value ?? null } : item)))}
                />
              )
            },
            {
              title: 'Review Group',
              render: (_value, record) => (
                <Select
                  value={record.reviewGroupId || undefined}
                  allowClear
                  options={reviewGroupOptions}
                  placeholder="Choose review group"
                  onChange={(value) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, reviewGroupId: value ?? null } : item)))}
                />
              )
            },
            {
              title: 'Active',
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.isActive}
                  onChange={(checked) => updateCollection('users', (items) => items.map((item) => (item.id === record.id ? { ...item, isActive: checked } : item)))}
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
