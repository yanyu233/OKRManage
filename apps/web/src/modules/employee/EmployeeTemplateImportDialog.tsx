import { useEffect, useMemo, useState } from 'react';
import { Alert, Checkbox, Empty, Modal, Space, Tag, Typography } from 'antd';
import { getScoreTypeLabel } from '../../shared/i18n/labels';
import type { EmployeeGoalTemplate } from '../../shared/types/employee';

const TEXT = {
  title: '\u5bfc\u5165\u6a21\u677f\u76ee\u6807',
  departmentPrefix: '\u9002\u7528\u90e8\u95e8',
  empty: '\u5f53\u524d\u90e8\u95e8\u8fd8\u6ca1\u6709\u53ef\u7528\u6a21\u677f',
  imported: '\u5df2\u5bfc\u5165',
  available: '\u53ef\u5bfc\u5165',
  totalPoints: '\u603b\u5206\u503c',
  keyResultCount: '\u5173\u952e\u7ed3\u679c',
  confirm: '\u5bfc\u5165\u9009\u4e2d\u6a21\u677f',
  cancel: '\u53d6\u6d88',
  descriptionFallback: '\u6682\u65e0\u6a21\u677f\u8bf4\u660e',
  currentAllocated: '\u5df2\u5206\u914d',
  selectedPoints: '\u672c\u6b21\u5bfc\u5165',
  projectedPoints: '\u5bfc\u5165\u540e\u5408\u8ba1',
  keyResultPreview: '\u5173\u952e\u7ed3\u679c\u9884\u89c8',
  keyResultDescriptionFallback: '\u6682\u65e0\u8bf4\u660e',
  emptyKeyResults: '\u6682\u65e0\u5173\u952e\u7ed3\u679c',
  pointLimitExceeded: '\u5f53\u524d\u5b63\u5ea6\u6240\u6709\u76ee\u6807\u7684\u5173\u952e\u7ed3\u679c\u5206\u503c\u5408\u8ba1\u4e0d\u80fd\u8d85\u8fc7 100 \u5206\u3002'
} as const;

export function EmployeeTemplateImportDialog({
  open,
  loading,
  confirmLoading,
  departmentName,
  allocatedPoints,
  maxQuarterPoints,
  templates,
  onCancel,
  onConfirm
}: {
  open: boolean;
  loading: boolean;
  confirmLoading: boolean;
  departmentName: string | null;
  allocatedPoints: number;
  maxQuarterPoints: number;
  templates: EmployeeGoalTemplate[];
  onCancel: () => void;
  onConfirm: (templateIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
    }
  }, [open]);

  const availableTemplateIds = useMemo(
    () => templates.filter((template) => !template.alreadyImported).map((template) => template.id),
    [templates]
  );
  const selectedTemplatePoints = useMemo(
    () =>
      templates
        .filter((template) => selectedIds.includes(template.id))
        .reduce((sum, template) => sum + template.totalPoints, 0),
    [selectedIds, templates]
  );
  const projectedPoints = allocatedPoints + selectedTemplatePoints;
  const pointLimitExceeded = projectedPoints > maxQuarterPoints;

  return (
    <Modal
      open={open}
      width={1080}
      title={TEXT.title}
      okText={TEXT.confirm}
      cancelText={TEXT.cancel}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      wrapClassName="employee-template-dialog"
      okButtonProps={{ disabled: !selectedIds.length || pointLimitExceeded }}
      onOk={() => onConfirm(selectedIds)}
      destroyOnHidden
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {`${TEXT.departmentPrefix}\uff1a${departmentName ?? '\u672a\u5206\u914d\u90e8\u95e8'}`}
        </Typography.Text>

        <div className="employee-template-card__summary-row">
          <Tag className="employee-template-card__summary-tag" color="blue">
            {`${TEXT.currentAllocated} ${allocatedPoints} / ${maxQuarterPoints}`}
          </Tag>
          <Tag className="employee-template-card__summary-tag" color="cyan">
            {`${TEXT.selectedPoints} ${selectedTemplatePoints}`}
          </Tag>
          <Tag className="employee-template-card__summary-tag" color={pointLimitExceeded ? 'error' : 'green'}>
            {`${TEXT.projectedPoints} ${projectedPoints} / ${maxQuarterPoints}`}
          </Tag>
        </div>

        {pointLimitExceeded ? <Alert showIcon type="error" message={TEXT.pointLimitExceeded} /> : null}

        {templates.length ? (
          <Checkbox.Group
            value={selectedIds}
            style={{ width: '100%' }}
            onChange={(values) => setSelectedIds(values.filter((value) => availableTemplateIds.includes(String(value))).map(String))}
          >
            <div className="employee-template-list">
              {templates.map((template) => {
                const isSelected = selectedIds.includes(template.id);

                return (
                  <label
                    key={template.id}
                    className={`employee-template-card ${isSelected ? 'employee-template-card--selected' : ''} ${
                      template.alreadyImported ? 'employee-template-card--disabled' : ''
                    }`}
                  >
                    <div className="employee-template-card__checkbox">
                      <Checkbox value={template.id} disabled={template.alreadyImported || loading} />
                    </div>
                    <div className="employee-template-card__content">
                      <div className="employee-template-card__overview">
                        <div className="employee-template-card__header">
                          <Typography.Title level={4} style={{ marginBottom: 0 }}>
                            {template.name}
                          </Typography.Title>
                          <Tag color={template.alreadyImported ? 'default' : 'blue'}>
                            {template.alreadyImported ? TEXT.imported : TEXT.available}
                          </Tag>
                        </div>
                        <Typography.Paragraph type="secondary" className="employee-template-card__description">
                          {template.description ?? TEXT.descriptionFallback}
                        </Typography.Paragraph>
                        <Space wrap size={[8, 8]} className="employee-goal-chip-row">
                          <Tag>{`${TEXT.totalPoints} ${template.totalPoints}`}</Tag>
                          <Tag>{`${template.keyResultCount} ${TEXT.keyResultCount}`}</Tag>
                        </Space>
                      </div>
                      <div className="employee-template-card__key-results">
                        <Typography.Text strong>{TEXT.keyResultPreview}</Typography.Text>
                        {template.keyResults.length ? (
                          <div className="employee-template-card__key-results-grid">
                            {template.keyResults.map((keyResult) => (
                              <div key={keyResult.id} className="employee-template-card__key-result">
                                <div className="employee-template-card__key-result-header">
                                  <Typography.Text strong>{`${keyResult.code} ${keyResult.name}`}</Typography.Text>
                                  <Tag color="blue">{`${keyResult.points}\u5206`}</Tag>
                                </div>
                                <div className="employee-template-card__key-result-meta">
                                  <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                                    {getScoreTypeLabel(keyResult.scoreType)}
                                  </Tag>
                                </div>
                                <Typography.Paragraph
                                  type="secondary"
                                  className="employee-template-card__key-result-description"
                                >
                                  {keyResult.description ?? TEXT.keyResultDescriptionFallback}
                                </Typography.Paragraph>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyKeyResults} />
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </Checkbox.Group>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
        )}
      </Space>
    </Modal>
  );
}
