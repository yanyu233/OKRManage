import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Empty, Modal, Space, Tag, Typography } from 'antd';
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
  descriptionFallback: '\u6682\u65e0\u6a21\u677f\u8bf4\u660e'
} as const;

export function EmployeeTemplateImportDialog({
  open,
  loading,
  confirmLoading,
  departmentName,
  templates,
  onCancel,
  onConfirm
}: {
  open: boolean;
  loading: boolean;
  confirmLoading: boolean;
  departmentName: string | null;
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

  return (
    <Modal
      open={open}
      width={760}
      title={TEXT.title}
      okText={TEXT.confirm}
      cancelText={TEXT.cancel}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: !selectedIds.length }}
      onOk={() => onConfirm(selectedIds)}
      destroyOnClose
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {`${TEXT.departmentPrefix}\uff1a${departmentName ?? '\u672a\u5206\u914d\u90e8\u95e8'}`}
        </Typography.Text>

        {templates.length ? (
          <Checkbox.Group
            value={selectedIds}
            style={{ width: '100%' }}
            onChange={(values) => setSelectedIds(values.filter((value) => availableTemplateIds.includes(String(value))).map(String))}
          >
            <div className="employee-template-list">
              {templates.map((template) => (
                <label key={template.id} className={`employee-template-card ${template.alreadyImported ? 'employee-template-card--disabled' : ''}`}>
                  <div className="employee-template-card__checkbox">
                    <Checkbox value={template.id} disabled={template.alreadyImported || loading} />
                  </div>
                  <div className="employee-template-card__content">
                    <div className="employee-template-card__header">
                      <Typography.Title level={4} style={{ marginBottom: 0 }}>
                        {template.name}
                      </Typography.Title>
                      <Tag color={template.alreadyImported ? 'default' : 'blue'}>
                        {template.alreadyImported ? TEXT.imported : TEXT.available}
                      </Tag>
                    </div>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                      {template.description ?? TEXT.descriptionFallback}
                    </Typography.Paragraph>
                    <Space wrap size={[8, 8]}>
                      <Tag>{`${TEXT.totalPoints} ${template.totalPoints}`}</Tag>
                      <Tag>{`${template.keyResultCount} ${TEXT.keyResultCount}`}</Tag>
                    </Space>
                  </div>
                </label>
              ))}
            </div>
          </Checkbox.Group>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
        )}
      </Space>
    </Modal>
  );
}
