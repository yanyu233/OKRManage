import type { ReactNode } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, Select, Space, Switch, Table, Typography } from 'antd';
import type { AdminOrgBootstrapInput, UserRoleCode } from '../../shared/types/admin-config';
import { applyDerivedRoleAssignmentScope, createLocalAccountRecord, createRoleAssignmentRecord } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

const TEXT = {
  localAccountTitle: '\u672c\u5730\u515c\u5e95\u8d26\u53f7',
  addLocalAccount: '\u65b0\u589e\u672c\u5730\u8d26\u53f7',
  linkedUser: '\u5173\u8054\u5458\u5de5',
  selectUser: '\u8bf7\u9009\u62e9\u5458\u5de5',
  loginName: '\u767b\u5f55\u540d',
  loginNamePlaceholder: '\u8bf7\u8f93\u5165\u767b\u5f55\u540d',
  resetPassword: '\u91cd\u7f6e\u5bc6\u7801',
  passwordPlaceholder: '\u7559\u7a7a\u5219\u4fdd\u6301\u5f53\u524d\u5bc6\u7801',
  enableLocalLogin: '\u542f\u7528\u672c\u5730\u767b\u5f55',
  actions: '\u64cd\u4f5c',
  remove: '\u5220\u9664',
  rolesTitle: '\u89d2\u8272\u5206\u914d',
  addRole: '\u65b0\u589e\u89d2\u8272',
  rolesTipTitle: '\u540c\u4e00\u5458\u5de5\u53ef\u4ee5\u5206\u914d\u591a\u4e2a\u89d2\u8272',
  rolesTipDescription:
    '\u53ea\u8981\u4e3a\u540c\u4e00\u5458\u5de5\u6dfb\u52a0\u5e76\u542f\u7528\u5bf9\u5e94\u89d2\u8272\uff0c\u7cfb\u7edf\u5c31\u4f1a\u81ea\u52a8\u5f00\u653e\u76f8\u5e94\u529f\u80fd\u83dc\u5355\u548c\u6743\u9650\uff0c\u4e0d\u9700\u8981\u518d\u989d\u5916\u7ef4\u62a4\u4e3b\u89d2\u8272\u3002',
  role: '\u89d2\u8272',
  enabled: '\u542f\u7528'
} as const;

const ROLE_OPTIONS: Array<{ label: string; value: UserRoleCode }> = [
  { label: '\u7cfb\u7edf\u7ba1\u7406\u5458', value: 'system-admin' },
  { label: '\u90e8\u95e8\u8d1f\u8d23\u4eba', value: 'department-head' },
  { label: '\u79d1\u5ba4\u9886\u5bfc', value: 'section-leader' },
  { label: '\u5c0f\u7ec4\u8d1f\u8d23\u4eba', value: 'group-leader' },
  { label: '\u5458\u5de5', value: 'employee' }
];

export function AccessSections({
  draft,
  updateCollection,
  persistedLocalAccountUserIds = new Set<string>()
}: {
  draft: AdminOrgBootstrapInput;
  updateCollection: UpdateCollection;
  persistedLocalAccountUserIds?: Set<string>;
}) {
  const sectionNameById = new Map(draft.sections.map((section) => [section.id, section.name]));
  const firstAvailableUserId =
    draft.users.find((user) => !draft.localAccounts.some((account) => account.userId === user.id))?.id ?? null;
  const userOptions = draft.users.map((user) => {
    const extras = [user.employeeNo, sectionNameById.get(user.sectionId ?? '') ?? null].filter(
      (value): value is string => Boolean(value)
    );

    return {
      label: extras.length ? `${user.name || user.id} (${extras.join(' / ')})` : user.name || user.id,
      value: user.id
    };
  });
  const assignedLocalAccountUserIds = new Set(draft.localAccounts.map((account) => account.userId).filter((userId) => Boolean(userId)));

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <SectionCard
        title={TEXT.localAccountTitle}
        actionLabel={TEXT.addLocalAccount}
        onAdd={() => updateCollection('localAccounts', (items) => [...items, createLocalAccountRecord(firstAvailableUserId)])}
      >
        <Table
          rowKey={(record) => `local-account:${resolveLocalAccountRowIndex(draft.localAccounts, record)}`}
          pagination={false}
          scroll={{ x: 1080 }}
          dataSource={draft.localAccounts}
          columns={[
            {
              title: TEXT.linkedUser,
              render: (_value, record, rowIndex) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions.map((option) => ({
                    ...option,
                    disabled: option.value !== record.userId && assignedLocalAccountUserIds.has(option.value)
                  }))}
                  disabled={Boolean(record.userId) && persistedLocalAccountUserIds.has(record.userId)}
                  placeholder={TEXT.selectUser}
                  onChange={(value) =>
                    updateCollection('localAccounts', (items) => updateLocalAccountsByIndex(items, rowIndex, (item) => ({ ...item, userId: value })))
                  }
                />
              )
            },
            {
              title: TEXT.loginName,
              render: (_value, record, rowIndex) => (
                <Input
                  value={record.loginName}
                  placeholder={TEXT.loginNamePlaceholder}
                  onChange={(event) =>
                    updateCollection('localAccounts', (items) =>
                      updateLocalAccountsByIndex(items, rowIndex, (item) => ({
                        ...item,
                        loginName: event.target.value.toLowerCase()
                      }))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.resetPassword,
              render: (_value, record, rowIndex) => (
                <Input.Password
                  value={record.password ?? ''}
                  placeholder={TEXT.passwordPlaceholder}
                  onChange={(event) =>
                    updateCollection('localAccounts', (items) =>
                      updateLocalAccountsByIndex(items, rowIndex, (item) => ({ ...item, password: event.target.value }))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.enableLocalLogin,
              width: 160,
              render: (_value, record, rowIndex) => (
                <Switch
                  checked={record.localLoginEnabled}
                  onChange={(checked) =>
                    updateCollection('localAccounts', (items) =>
                      updateLocalAccountsByIndex(items, rowIndex, (item) => ({ ...item, localLoginEnabled: checked }))
                    )
                  }
                />
              )
            },
            {
              title: TEXT.actions,
              width: 100,
              render: (_value, _record, rowIndex) => (
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => updateCollection('localAccounts', (items) => items.filter((_item, itemIndex) => itemIndex !== rowIndex))}
                >
                  {TEXT.remove}
                </Button>
              )
            }
          ]}
        />
      </SectionCard>

      <SectionCard
        title={TEXT.rolesTitle}
        actionLabel={TEXT.addRole}
        onAdd={() =>
          updateCollection('roleAssignments', (items) => [...items, createRoleAssignmentRecord(draft.users.at(0)?.id ?? null)])
        }
      >
        <Alert type="info" showIcon message={TEXT.rolesTipTitle} description={TEXT.rolesTipDescription} />

        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
          dataSource={draft.roleAssignments}
          columns={[
            {
              title: TEXT.linkedUser,
              render: (_value, record) => (
                <Select
                  value={record.userId || undefined}
                  options={userOptions}
                  placeholder={TEXT.selectUser}
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) =>
                        item.id === record.id ? applyDerivedRoleAssignmentScope({ ...item, userId: value }) : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: TEXT.role,
              render: (_value, record) => (
                <Select
                  value={record.roleCode}
                  options={ROLE_OPTIONS}
                  onChange={(value) =>
                    updateCollection('roleAssignments', (items) =>
                      items.map((item) =>
                        item.id === record.id
                          ? applyDerivedRoleAssignmentScope({
                              ...item,
                              roleCode: value
                            })
                          : item
                      )
                    )
                  }
                />
              )
            },
            {
              title: TEXT.enabled,
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
              title: TEXT.actions,
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
                  {TEXT.remove}
                </Button>
              )
            }
          ]}
        />
      </SectionCard>
    </Space>
  );
}

function updateLocalAccountsByIndex(
  items: AdminOrgBootstrapInput['localAccounts'],
  rowIndex: number | undefined,
  updater: (item: AdminOrgBootstrapInput['localAccounts'][number]) => AdminOrgBootstrapInput['localAccounts'][number]
) {
  if (typeof rowIndex !== 'number' || rowIndex < 0) {
    return items;
  }

  return items.map((item, itemIndex) => (itemIndex === rowIndex ? updater(item) : item));
}

function resolveLocalAccountRowIndex(
  items: AdminOrgBootstrapInput['localAccounts'],
  record: AdminOrgBootstrapInput['localAccounts'][number]
) {
  const index = items.indexOf(record);
  return index >= 0 ? index : `${record.userId}:${record.loginName}`;
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
