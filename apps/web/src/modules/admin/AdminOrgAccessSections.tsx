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
  { label: '系统管理员', value: 'system-admin' },
  { label: '科室领导', value: 'section-leader' },
  { label: '小组负责人', value: 'group-leader' },
  { label: '员工', value: 'employee' }
];

const ROLE_SCOPE_OPTIONS: Array<{ label: string; value: RoleScopeType }> = [
  { label: '系统', value: 'system' },
  { label: '部门', value: 'department' },
  { label: '科室', value: 'section' },
  { label: '评价组', value: 'review-group' },
  { label: '用户', value: 'user' }
];

export function AccessSections({ draft, updateCollection }: { draft: AdminOrgBootstrapInput; updateCollection: UpdateCollection }) {
  const userOptions = draft.users.map((user) => ({ label: user.name || user.id, value: user.id }));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard title="本地兜底账号" actionLabel="新增本地账号" onAdd={() => updateCollection('localAccounts', (items) => [...items, createLocalAccountRecord(draft.users.at(0)?.id ?? null)])}>
        <Table
          rowKey={(record) => `${record.userId}:${record.loginName}`}
          pagination={false}
          scroll={{ x: 1080 }}
          dataSource={draft.localAccounts}
          columns={[
            {
              title: '关联员工',
              render: (_value, record) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions}
                  placeholder="请选择员工"
                  onChange={(value) =>
                    updateCollection('localAccounts', (items) =>
                      items.map((item) => (item.userId === record.userId ? { ...item, userId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '登录名',
              render: (_value, record) => (
                <Input
                  value={record.loginName}
                  placeholder="请输入登录名"
                  onChange={(event) =>
                    updateCollection('localAccounts', (items) =>
                      items.map((item) =>
                        item.userId === record.userId ? { ...item, loginName: event.target.value.toLowerCase() } : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: '重置密码',
              render: (_value, record) => (
                <Input.Password
                  value={record.password ?? ''}
                  placeholder="留空则保持当前密码"
                  onChange={(event) =>
                    updateCollection('localAccounts', (items) =>
                      items.map((item) => (item.userId === record.userId ? { ...item, password: event.target.value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '启用本地登录',
              width: 140,
              render: (_value, record) => (
                <Switch
                  checked={record.localLoginEnabled}
                  onChange={(checked) =>
                    updateCollection('localAccounts', (items) =>
                      items.map((item) => (item.userId === record.userId ? { ...item, localLoginEnabled: checked } : item))
                    )
                  }
                />
              )
            },
            {
              title: '操作',
              width: 100,
              render: (_value, record) => (
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    updateCollection('localAccounts', (items) => items.filter((item) => item.userId !== record.userId))
                  }
                >
                  删除
                </Button>
              )
            }
          ]}
        />
      </SectionCard>

      <SectionCard title="角色分配" actionLabel="新增角色" onAdd={() => updateCollection('roleAssignments', (items) => [...items, createRoleAssignmentRecord(draft.users.at(0)?.id ?? null)])}>
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.roleAssignments}
          columns={[
            {
              title: '关联员工',
              render: (_value, record) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions}
                  placeholder="请选择员工"
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, userId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '角色',
              render: (_value, record) => (
                <Select
                  value={record.roleCode}
                  options={ROLE_OPTIONS}
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) =>
                        item.id === record.id
                          ? {
                              ...item,
                              roleCode: value,
                              scopeType: value === 'system-admin' ? 'system' : item.scopeType,
                              scopeId: value === 'system-admin' ? 'system' : item.scopeId
                            }
                          : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: '范围类型',
              render: (_value, record) => (
                <Select
                  value={record.scopeType}
                  options={ROLE_SCOPE_OPTIONS}
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, scopeType: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '范围',
              render: (_value, record) => (
                <Select
                  value={record.scopeId || undefined}
                  options={scopeOptions(record.scopeType, draft)}
                  showSearch
                  placeholder="请选择范围"
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, scopeId: value } : item))
                    )
                  }
                />
              )
            },
            {
              title: '主角色',
              width: 110,
              render: (_value, record) => (
                <Switch
                  checked={record.isPrimary}
                  onChange={(checked) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, isPrimary: checked } : item))
                    )
                  }
                />
              )
            },
            {
              title: '启用',
              width: 110,
              render: (_value, record) => (
                <Switch
                  checked={record.isEnabled}
                  onChange={(checked) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) => (item.id === record.id ? { ...item, isEnabled: checked } : item))
                    )
                  }
                />
              )
            },
            {
              title: '操作',
              width: 100,
              render: (_value, record) => (
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    updateCollection('roleAssignments', (items) => items.filter((item) => item.id !== record.id))
                  }
                >
                  删除
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
      return [{ label: '系统', value: 'system' }];
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
