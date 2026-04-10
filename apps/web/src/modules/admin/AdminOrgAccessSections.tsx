import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput, RoleScopeType, UserRoleCode } from '../../shared/types/admin-config';
import { createLocalAccountRecord, createRoleAssignmentRecord } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

const ROLE_OPTIONS: Array<{ label: string; value: UserRoleCode }> = [
  { label: 'System Admin', value: 'system-admin' },
  { label: 'Section Leader', value: 'section-leader' },
  { label: 'Group Leader', value: 'group-leader' },
  { label: 'Employee', value: 'employee' }
];

const ROLE_SCOPE_OPTIONS: Array<{ label: string; value: RoleScopeType }> = [
  { label: 'System', value: 'system' },
  { label: 'Department', value: 'department' },
  { label: 'Section', value: 'section' },
  { label: 'Review Group', value: 'review-group' },
  { label: 'User', value: 'user' }
];

export function AccessSections({ draft, updateCollection }: { draft: AdminOrgBootstrapInput; updateCollection: UpdateCollection }) {
  const userOptions = draft.users.map((user) => ({ label: user.name || user.id, value: user.id }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard title="Local Fallback Accounts" actionLabel="Add Local Account" onAdd={() => updateCollection('localAccounts', (items) => [...items, createLocalAccountRecord(draft.users.at(0)?.id ?? null)])}>
        <Table
          rowKey={(record) => `${record.userId}:${record.loginName}`}
          pagination={false}
          scroll={{ x: 1000 }}
          dataSource={draft.localAccounts}
          columns={[
            {
              title: 'User',
              render: (_value, record) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions}
                  placeholder="Choose user"
                  onChange={(value) => updateCollection('localAccounts', (items) => items.map((item) => (item.userId === record.userId ? { ...item, userId: value } : item)))}
                />
              )
            },
            {
              title: 'Login Name',
              render: (_value, record) => (
                <Input
                  value={record.loginName}
                  placeholder="Login name"
                  onChange={(event) => updateCollection('localAccounts', (items) => items.map((item) => (item.userId === record.userId ? { ...item, loginName: event.target.value.toLowerCase() } : item)))}
                />
              )
            },
            {
              title: 'Reset Password',
              render: (_value, record) => (
                <Input.Password
                  value={record.password ?? ''}
                  placeholder="Blank keeps current password"
                  onChange={(event) => updateCollection('localAccounts', (items) => items.map((item) => (item.userId === record.userId ? { ...item, password: event.target.value } : item)))}
                />
              )
            },
            {
              title: 'Enabled',
              width: 120,
              render: (_value, record) => (
                <Switch
                  checked={record.localLoginEnabled}
                  onChange={(checked) => updateCollection('localAccounts', (items) => items.map((item) => (item.userId === record.userId ? { ...item, localLoginEnabled: checked } : item)))}
                />
              )
            },
            {
              title: 'Actions',
              width: 100,
              render: (_value, record) => (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => updateCollection('localAccounts', (items) => items.filter((item) => item.userId !== record.userId))}>
                  Delete
                </Button>
              )
            }
          ]}
        />
      </SectionCard>

      <SectionCard title="Role Assignments" actionLabel="Add Role" onAdd={() => updateCollection('roleAssignments', (items) => [...items, createRoleAssignmentRecord(draft.users.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.roleAssignments}
          columns={[
            {
              title: 'User',
              render: (_value, record) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions}
                  placeholder="Choose user"
                  onChange={(value) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, userId: value } : item)))}
                />
              )
            },
            {
              title: 'Role',
              render: (_value, record) => (
                <Select
                  value={record.roleCode}
                  options={ROLE_OPTIONS}
                  onChange={(value) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, roleCode: value, scopeType: value === 'system-admin' ? 'system' : item.scopeType, scopeId: value === 'system-admin' ? 'system' : item.scopeId } : item)))}
                />
              )
            },
            {
              title: 'Scope Type',
              render: (_value, record) => (
                <Select
                  value={record.scopeType}
                  options={ROLE_SCOPE_OPTIONS}
                  onChange={(value) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, scopeType: value } : item)))}
                />
              )
            },
            {
              title: 'Scope',
              render: (_value, record) => (
                <Select
                  value={record.scopeId || undefined}
                  options={scopeOptions(record.scopeType, draft)}
                  showSearch
                  placeholder="Choose scope"
                  onChange={(value) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, scopeId: value } : item)))}
                />
              )
            },
            {
              title: 'Primary',
              width: 110,
              render: (_value, record) => (
                <Switch
                  checked={record.isPrimary}
                  onChange={(checked) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, isPrimary: checked } : item)))}
                />
              )
            },
            {
              title: 'Enabled',
              width: 110,
              render: (_value, record) => (
                <Switch
                  checked={record.isEnabled}
                  onChange={(checked) => updateCollection('roleAssignments', (items) => items.map((item) => (item.id === record.id ? { ...item, isEnabled: checked } : item)))}
                />
              )
            },
            {
              title: 'Actions',
              width: 100,
              render: (_value, record) => (
                <Button danger type="text" icon={<DeleteOutlined />} onClick={() => updateCollection('roleAssignments', (items) => items.filter((item) => item.id !== record.id))}>
                  Delete
                </Button>
              )
            }
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

function scopeOptions(scopeType: RoleScopeType, draft: AdminOrgBootstrapInput) {
  switch (scopeType) {
    case 'system':
      return [{ label: 'System', value: 'system' }];
    case 'department':
      return draft.departments.map((department) => ({ label: department.name || department.id, value: department.id }));
    case 'section':
      return draft.sections.map((section) => ({ label: section.name || section.id, value: section.id }));
    case 'review-group':
      return draft.reviewGroups.map((group) => ({ label: group.name || group.id, value: group.id }));
    case 'user':
      return draft.users.map((user) => ({ label: user.name || user.id, value: user.id }));
    default:
      return [];
  }
}
