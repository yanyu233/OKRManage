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
      <SectionCard title="部门管理" actionLabel="新增部门" onAdd={() => updateCollection('departments', (items) => [...items, createDepartmentRecord()])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.departments}
          columns={[
            {
              title: '部门名称',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="请输入部门名称"
                  onChange={(event) =>
                    updateCollection('departments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '启用',
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
            deleteColumn((record) => updateCollection('departments', (items) => items.filter((item) => item.id !== record.id)))
          ]}
        />
      </SectionCard>

      <SectionCard title="科室管理" actionLabel="新增科室" onAdd={() => updateCollection('sections', (items) => [...items, createSectionRecord(draft.departments.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          dataSource={draft.sections}
          columns={[
            {
              title: '科室名称',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="请输入科室名称"
                  onChange={(event) =>
                    updateCollection('sections', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '所属部门',
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  placeholder="请选择所属部门"
                  onChange={(value) =>
                    updateCollection('sections', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, departmentId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '启用',
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

      <SectionCard title="员工管理" actionLabel="新增员工" onAdd={() => updateCollection('users', (items) => [...items, createUserRecord(draft.departments.at(0)?.id ?? null, draft.sections.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.users}
          columns={[
            {
              title: '姓名',
              render: (_value, record) => (
                <Input
                  value={record.name}
                  placeholder="请输入员工姓名"
                  onChange={(event) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, name: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '工号',
              render: (_value, record) => (
                <Input
                  value={record.employeeNo ?? ''}
                  placeholder="选填"
                  onChange={(event) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, employeeNo: event.target.value || null } : item))
                    )
                  }
                />
              )
            },
            {
              title: '所属部门',
              render: (_value, record) => (
                <Select
                  value={record.departmentId || undefined}
                  options={departmentOptions}
                  allowClear
                  placeholder="请选择所属部门"
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
              title: '所属科室',
              render: (_value, record) => (
                <Select
                  value={record.sectionId || undefined}
                  allowClear
                  options={draft.sections
                    .filter((section) => (record.departmentId ? section.departmentId === record.departmentId : true))
                    .map((section) => ({ label: section.name || section.id, value: section.id }))}
                  placeholder="请选择所属科室"
                  onChange={(value) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, sectionId: value ?? null } : item))
                    )
                  }
                />
              )
            },
            {
              title: '所属评价组',
              render: (_value, record) => (
                <Select
                  value={record.reviewGroupId || undefined}
                  allowClear
                  options={reviewGroupOptions}
                  placeholder="请选择评价组"
                  onChange={(value) =>
                    updateCollection('users', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, reviewGroupId: value ?? null } : item))
                    )
                  }
                />
              )
            },
            {
              title: '启用',
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
    title: '操作',
    width: 100,
    render: (_value: unknown, record: T) => (
      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
        删除
      </Button>
    )
  };
}
