import { useMemo, useState } from 'react';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, InputNumber, Select, Space, Switch, Tag, Typography } from 'antd';
import type { AdminOrgBootstrapInput } from '../../shared/types/admin-config';
import { createGoalTemplateKeyResultRecord, createGoalTemplateRecord } from './admin-org-form';

type UpdateCollection = <Key extends keyof AdminOrgBootstrapInput>(
  key: Key,
  updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
) => void;

const TEXT = {
  title: '\u6a21\u677f\u76ee\u6807',
  addTemplate: '\u65b0\u589e\u6a21\u677f',
  allDepartments: '\u5168\u90e8\u90e8\u95e8',
  noDepartmentTitle: '\u8bf7\u5148\u7ef4\u62a4\u90e8\u95e8',
  noDepartmentDescription: '\u6a21\u677f\u76ee\u6807\u9700\u8981\u5148\u7ed1\u5b9a\u90e8\u95e8\uff0c\u8bf7\u5148\u5728\u7ec4\u7ec7\u7ed3\u6784\u4e2d\u65b0\u589e\u90e8\u95e8\u3002',
  empty: '\u5f53\u524d\u6761\u4ef6\u4e0b\u8fd8\u6ca1\u6709\u6a21\u677f\u76ee\u6807',
  department: '\u6240\u5c5e\u90e8\u95e8',
  departmentPlaceholder: '\u8bf7\u9009\u62e9\u6240\u5c5e\u90e8\u95e8',
  templateName: '\u6a21\u677f\u76ee\u6807\u540d\u79f0',
  templateNamePlaceholder: '\u8bf7\u8f93\u5165\u6a21\u677f\u76ee\u6807\u540d\u79f0',
  description: '\u76ee\u6807\u8bf4\u660e',
  descriptionPlaceholder: '\u8f93\u5165\u6a21\u677f\u76ee\u6807\u8bf4\u660e',
  enabled: '\u542f\u7528',
  disabled: '\u505c\u7528',
  keyResults: '\u5173\u952e\u7ed3\u679c',
  addKeyResult: '\u65b0\u589e\u5173\u952e\u7ed3\u679c',
  keyResultCode: '\u7f16\u53f7',
  keyResultCodePlaceholder: 'KR1',
  keyResultName: '\u540d\u79f0',
  keyResultNamePlaceholder: '\u8bf7\u8f93\u5165\u5173\u952e\u7ed3\u679c\u540d\u79f0',
  keyResultDescription: '\u8bf4\u660e',
  keyResultDescriptionPlaceholder: '\u8f93\u5165\u5173\u952e\u7ed3\u679c\u8bf4\u660e',
  keyResultPoints: '\u5206\u503c',
  keyResultScoreType: '\u8bc4\u5206\u7c7b\u578b',
  scoreTypeObjective: '\u5ba2\u89c2\u8bc4\u5206\u9879',
  scoreTypeSubjective: '\u4e3b\u89c2\u8bc4\u5206\u9879',
  totalPoints: '\u603b\u5206\u503c',
  remove: '\u5220\u9664'
} as const;

export function AdminGoalTemplateSection({
  draft,
  updateCollection
}: {
  draft: AdminOrgBootstrapInput;
  updateCollection: UpdateCollection;
}) {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  const filteredTemplates = useMemo(() => {
    if (departmentFilter === 'all') {
      return draft.goalTemplates;
    }

    return draft.goalTemplates.filter((template) => template.departmentId === departmentFilter);
  }, [departmentFilter, draft.goalTemplates]);

  const departmentOptions = useMemo(
    () => [
      { label: TEXT.allDepartments, value: 'all' },
      ...draft.departments.map((department) => ({
        label: department.name || department.id,
        value: department.id
      }))
    ],
    [draft.departments]
  );

  if (!draft.departments.length) {
    return (
      <Card className="admin-section-card" variant="borderless">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{TEXT.noDepartmentTitle}</Typography.Text>
              <Typography.Text type="secondary">{TEXT.noDepartmentDescription}</Typography.Text>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="admin-section-card" variant="borderless">
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="admin-section-card__header">
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {TEXT.title}
          </Typography.Title>
          <Space>
            <Select
              value={departmentFilter}
              options={departmentOptions}
              style={{ minWidth: 220 }}
              onChange={setDepartmentFilter}
            />
            <Button
              icon={<PlusOutlined />}
              onClick={() =>
                updateCollection('goalTemplates', (items) => [
                  ...items,
                  createGoalTemplateRecord(
                    departmentFilter !== 'all' ? departmentFilter : draft.departments.at(0)?.id ?? null,
                    buildNextTemplateName(items)
                  )
                ])
              }
            >
              {TEXT.addTemplate}
            </Button>
          </Space>
        </div>

        {filteredTemplates.length ? (
          <div className="goal-template-list">
            {filteredTemplates.map((template) => {
              const totalPoints = template.keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0);
              return (
                <Card key={template.id} className="goal-template-card" variant="borderless">
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div className="admin-section-card__header">
                      <Space wrap size={[12, 12]}>
                        <Tag color={template.isActive ? 'green' : 'default'}>{template.isActive ? TEXT.enabled : TEXT.disabled}</Tag>
                        <Tag>{`${TEXT.totalPoints} ${totalPoints}`}</Tag>
                      </Space>
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          updateCollection('goalTemplates', (items) => items.filter((item) => item.id !== template.id))
                        }
                      >
                        {TEXT.remove}
                      </Button>
                    </div>

                    <div className="goal-template-meta-grid">
                      <div>
                        <Typography.Text strong>{TEXT.department}</Typography.Text>
                        <Select
                          value={template.departmentId || undefined}
                          options={draft.departments.map((department) => ({
                            label: department.name || department.id,
                            value: department.id
                          }))}
                          style={{ width: '100%', marginTop: 8 }}
                          placeholder={TEXT.departmentPlaceholder}
                          onChange={(value) => updateTemplate(template.id, { departmentId: value })}
                        />
                      </div>
                      <div>
                        <Typography.Text strong>{TEXT.templateName}</Typography.Text>
                        <Input
                          value={template.name}
                          style={{ marginTop: 8 }}
                          placeholder={TEXT.templateNamePlaceholder}
                          onChange={(event) => updateTemplate(template.id, { name: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="goal-template-meta-grid">
                      <div>
                        <Typography.Text strong>{TEXT.description}</Typography.Text>
                        <Input.TextArea
                          value={template.description ?? ''}
                          rows={3}
                          style={{ marginTop: 8 }}
                          placeholder={TEXT.descriptionPlaceholder}
                          onChange={(event) =>
                            updateTemplate(template.id, {
                              description: event.target.value || null
                            })
                          }
                        />
                      </div>
                      <div>
                        <Typography.Text strong>{TEXT.enabled}</Typography.Text>
                        <div style={{ marginTop: 14 }}>
                          <Switch checked={template.isActive} onChange={(checked) => updateTemplate(template.id, { isActive: checked })} />
                        </div>
                      </div>
                    </div>

                    <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                      <Typography.Title level={4} style={{ marginBottom: 0 }}>
                        {TEXT.keyResults}
                      </Typography.Title>
                      <Button icon={<PlusOutlined />} onClick={() => addTemplateKeyResult(template.id, template.keyResults.length)}>
                        {TEXT.addKeyResult}
                      </Button>
                    </Space>

                    <div className="goal-template-kr-grid">
                      {template.keyResults.map((keyResult, index) => (
                        <Card key={keyResult.id} size="small" className="goal-template-kr-card">
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <div className="goal-template-kr-header">
                              <Typography.Text strong>{`\u5173\u952e\u7ed3\u679c ${index + 1}`}</Typography.Text>
                              <Button
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => removeTemplateKeyResult(template.id, keyResult.id)}
                              >
                                {TEXT.remove}
                              </Button>
                            </div>

                            <div className="goal-template-kr-meta-grid">
                              <div>
                                <Typography.Text strong>{TEXT.keyResultCode}</Typography.Text>
                                <Input
                                  value={keyResult.code}
                                  style={{ marginTop: 8 }}
                                  placeholder={TEXT.keyResultCodePlaceholder}
                                  onChange={(event) =>
                                    updateTemplateKeyResult(template.id, keyResult.id, { code: event.target.value })
                                  }
                                />
                              </div>
                              <div>
                                <Typography.Text strong>{TEXT.keyResultPoints}</Typography.Text>
                                <InputNumber
                                  min={0}
                                  precision={0}
                                  controls={false}
                                  value={keyResult.points}
                                  style={{ width: '100%', marginTop: 8 }}
                                  onChange={(value) =>
                                    updateTemplateKeyResult(template.id, keyResult.id, { points: Number(value ?? 0) })
                                  }
                                />
                              </div>
                              <div>
                                <Typography.Text strong>{TEXT.keyResultScoreType}</Typography.Text>
                                <Select
                                  value={keyResult.scoreType}
                                  style={{ width: '100%', marginTop: 8 }}
                                  options={[
                                    { label: TEXT.scoreTypeObjective, value: 'objective' },
                                    { label: TEXT.scoreTypeSubjective, value: 'subjective' }
                                  ]}
                                  onChange={(value) => updateTemplateKeyResult(template.id, keyResult.id, { scoreType: value })}
                                />
                              </div>
                            </div>

                            <div>
                              <Typography.Text strong>{TEXT.keyResultName}</Typography.Text>
                              <Input
                                value={keyResult.name}
                                style={{ marginTop: 8 }}
                                placeholder={TEXT.keyResultNamePlaceholder}
                                onChange={(event) =>
                                  updateTemplateKeyResult(template.id, keyResult.id, { name: event.target.value })
                                }
                              />
                            </div>

                            <div>
                              <Typography.Text strong>{TEXT.keyResultDescription}</Typography.Text>
                              <Input.TextArea
                                value={keyResult.description ?? ''}
                                rows={2}
                                style={{ marginTop: 8 }}
                                placeholder={TEXT.keyResultDescriptionPlaceholder}
                                onChange={(event) =>
                                  updateTemplateKeyResult(template.id, keyResult.id, {
                                    description: event.target.value || null
                                  })
                                }
                              />
                            </div>
                          </Space>
                        </Card>
                      ))}
                    </div>
                  </Space>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
        )}
      </Space>
    </Card>
  );

  function updateTemplate(templateId: string, patch: Partial<AdminOrgBootstrapInput['goalTemplates'][number]>) {
    updateCollection('goalTemplates', (items) =>
      items.map((item) => (item.id === templateId ? { ...item, ...patch } : item))
    );
  }

  function addTemplateKeyResult(templateId: string, length: number) {
    updateCollection('goalTemplates', (items) =>
      items.map((item) =>
        item.id === templateId
          ? {
              ...item,
              keyResults: [
                ...item.keyResults,
                createGoalTemplateKeyResultRecord(`KR${length + 1}`, `关键结果${length + 1}`)
              ]
            }
          : item
      )
    );
  }

  function updateTemplateKeyResult(
    templateId: string,
    keyResultId: string,
    patch: Partial<AdminOrgBootstrapInput['goalTemplates'][number]['keyResults'][number]>
  ) {
    updateCollection('goalTemplates', (items) =>
      items.map((item) =>
        item.id === templateId
          ? {
              ...item,
              keyResults: item.keyResults.map((entry) => (entry.id === keyResultId ? { ...entry, ...patch } : entry))
            }
          : item
      )
    );
  }

  function removeTemplateKeyResult(templateId: string, keyResultId: string) {
    updateCollection('goalTemplates', (items) =>
      items.map((item) =>
        item.id === templateId
          ? {
              ...item,
              keyResults:
                item.keyResults.length > 1 ? item.keyResults.filter((entry) => entry.id !== keyResultId) : item.keyResults
            }
          : item
      )
    );
  }

  function buildNextTemplateName(templates: AdminOrgBootstrapInput['goalTemplates']) {
    const existingNames = new Set(
      templates
        .map((template) => template.name.trim())
        .filter((name) => name.length > 0)
    );

    let index = templates.length + 1;
    let candidate = `新模板目标${index}`;

    while (existingNames.has(candidate)) {
      index += 1;
      candidate = `新模板目标${index}`;
    }

    return candidate;
  }
}
