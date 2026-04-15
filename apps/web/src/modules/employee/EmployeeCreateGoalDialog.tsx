import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, InputNumber, Modal, Segmented, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { CreateEmployeeGoalInput, EmployeeGoalDetail, UpdateEmployeeGoalInput } from '../../shared/types/employee';

export const SUBJECTIVE_CONFIRM_TEXT =
  '员工自定目标及关键结果项通常建议使用客观评分项，主观评分项指的是目标任务综合评价、工作态度表现等由科室负责人主观打分的关键结果项。';

const TEXT = {
  createTitle: '新建目标',
  editTitle: '编辑目标',
  goalName: '目标名称',
  goalNamePlaceholder: '请输入目标名称',
  goalDescription: '目标说明',
  goalDescriptionPlaceholder: '请输入目标说明',
  keyResults: '关键结果',
  addKeyResult: '新增关键结果',
  keyResultNamePlaceholder: '请输入关键结果名称',
  keyResultDescriptionPlaceholder: '请输入关键结果说明',
  keyResultPoints: '分值',
  scoreType: '评分类型',
  objective: '客观评分项',
  subjective: '主观评分项',
  cancel: '取消',
  createConfirm: '保存目标',
  editConfirm: '保存修改',
  remove: '删除',
  keyResultPrefix: '关键结果',
  currentQuarterPoints: '当前季度已分配',
  currentGoalPoints: '本目标分值',
  remainingPoints: '剩余可分配',
  pointLimitExceeded: '当前季度所有目标的关键结果分值合计不能超过 100 分。'
} as const;

type DraftKeyResult = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  points: number;
  scoreType: 'objective' | 'subjective';
};

type GoalDialogInitialValue = Pick<EmployeeGoalDetail, 'name' | 'description' | 'keyResults'>;

function createDraftKeyResult(index: number): DraftKeyResult {
  return {
    code: `KR${index + 1}`,
    name: '',
    description: null,
    points: 0,
    scoreType: 'objective'
  };
}

function toDraftKeyResults(initialValue?: GoalDialogInitialValue): DraftKeyResult[] {
  if (!initialValue?.keyResults?.length) {
    return [createDraftKeyResult(0)];
  }

  return initialValue.keyResults.map((keyResult, index) => ({
    id: keyResult.id,
    code: keyResult.code || `KR${index + 1}`,
    name: keyResult.name,
    description: keyResult.description ?? null,
    points: keyResult.points,
    scoreType: keyResult.scoreType ?? 'objective'
  }));
}

function buildPayloadKeyResults(keyResults: DraftKeyResult[]) {
  return keyResults.map((keyResult, index) => ({
    id: keyResult.id,
    code: keyResult.code || `KR${index + 1}`,
    name: keyResult.name.trim(),
    description: keyResult.description?.trim() || null,
    points: keyResult.points,
    scoreType: keyResult.scoreType
  }));
}

export function EmployeeCreateGoalDialog({
  open,
  year,
  quarter,
  mode = 'create',
  initialValue,
  quarterAllocatedPoints,
  maxQuarterPoints = 100,
  confirmLoading,
  onCancel,
  onConfirm
}: {
  open: boolean;
  year?: number;
  quarter?: number;
  mode?: 'create' | 'edit';
  initialValue?: GoalDialogInitialValue | null;
  quarterAllocatedPoints?: number;
  maxQuarterPoints?: number;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (payload: CreateEmployeeGoalInput | UpdateEmployeeGoalInput) => void | Promise<EmployeeGoalDetail | void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keyResults, setKeyResults] = useState<DraftKeyResult[]>([createDraftKeyResult(0)]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setKeyResults(toDraftKeyResults(initialValue ?? undefined));
  }, [initialValue, open]);

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      keyResults.length > 0 &&
      keyResults.every((keyResult) => keyResult.name.trim().length > 0 && Number.isFinite(keyResult.points)),
    [keyResults, name]
  );
  const draftTotalPoints = useMemo(() => keyResults.reduce((sum, keyResult) => sum + keyResult.points, 0), [keyResults]);
  const nextQuarterPoints =
    typeof quarterAllocatedPoints === 'number' ? quarterAllocatedPoints + draftTotalPoints : null;
  const quarterPointLimitExceeded = nextQuarterPoints !== null && nextQuarterPoints > maxQuarterPoints;
  const remainingPoints = nextQuarterPoints === null ? null : Math.max(maxQuarterPoints - nextQuarterPoints, 0);

  const isEdit = mode === 'edit';

  return (
    <Modal
      open={open}
      title={isEdit ? TEXT.editTitle : TEXT.createTitle}
      width={860}
      destroyOnClose
      confirmLoading={confirmLoading}
      okText={isEdit ? TEXT.editConfirm : TEXT.createConfirm}
      cancelText={TEXT.cancel}
      okButtonProps={{ disabled: !canSubmit || quarterPointLimitExceeded }}
      onCancel={onCancel}
      onOk={() => {
        if (quarterPointLimitExceeded) {
          return;
        }

        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          keyResults: buildPayloadKeyResults(keyResults)
        };

        if (isEdit) {
          onConfirm(payload);
          return;
        }

        onConfirm({
          year: year ?? 2026,
          quarter: quarter ?? 1,
          ...payload
        });
      }}
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>{TEXT.goalName}</Typography.Text>
          <Input
            value={name}
            style={{ marginTop: 8 }}
            placeholder={TEXT.goalNamePlaceholder}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <Typography.Text strong>{TEXT.goalDescription}</Typography.Text>
          <Input.TextArea
            value={description}
            rows={3}
            style={{ marginTop: 8 }}
            placeholder={TEXT.goalDescriptionPlaceholder}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        {typeof quarterAllocatedPoints === 'number' ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap size={[8, 8]}>
              <Tag>{`${TEXT.currentQuarterPoints} ${quarterAllocatedPoints} 分`}</Tag>
              <Tag color="blue">{`${TEXT.currentGoalPoints} ${draftTotalPoints} 分`}</Tag>
              <Tag color={quarterPointLimitExceeded ? 'red' : 'green'}>{`${TEXT.remainingPoints} ${remainingPoints ?? 0} 分`}</Tag>
            </Space>
            {quarterPointLimitExceeded ? <Alert type="error" showIcon message={TEXT.pointLimitExceeded} /> : null}
          </Space>
        ) : null}

        <div className="employee-create-goal__header">
          <Typography.Title level={4} style={{ marginBottom: 0 }}>
            {TEXT.keyResults}
          </Typography.Title>
          <Button icon={<PlusOutlined />} onClick={() => setKeyResults((current) => [...current, createDraftKeyResult(current.length)])}>
            {TEXT.addKeyResult}
          </Button>
        </div>

        <div className="employee-create-goal__list">
          {keyResults.map((keyResult, index) => (
            <Card key={keyResult.id ?? `${keyResult.code}-${index}`} size="small" className="employee-create-goal__item">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <div className="employee-create-goal__item-header">
                  <Typography.Text strong>{`${TEXT.keyResultPrefix} ${index + 1}`}</Typography.Text>
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    disabled={keyResults.length === 1}
                    onClick={() =>
                      setKeyResults((current) =>
                        current
                          .filter((_, currentIndex) => currentIndex !== index)
                          .map((entry, nextIndex) => ({
                            ...entry,
                            code: `KR${nextIndex + 1}`
                          }))
                      )
                    }
                  >
                    {TEXT.remove}
                  </Button>
                </div>

                <Input
                  value={keyResult.name}
                  placeholder={TEXT.keyResultNamePlaceholder}
                  onChange={(event) => updateKeyResult(index, { name: event.target.value })}
                />

                <Input.TextArea
                  value={keyResult.description ?? ''}
                  rows={2}
                  placeholder={TEXT.keyResultDescriptionPlaceholder}
                  onChange={(event) => updateKeyResult(index, { description: event.target.value || null })}
                />

                <div className="employee-create-goal__meta-grid">
                  <div>
                    <Typography.Text strong>{TEXT.keyResultPoints}</Typography.Text>
                    <InputNumber
                      min={0}
                      precision={0}
                      controls={false}
                      value={keyResult.points}
                      style={{ width: '100%', marginTop: 8 }}
                      onChange={(value) => updateKeyResult(index, { points: Number(value ?? 0) })}
                    />
                  </div>
                  <div>
                    <Typography.Text strong>{TEXT.scoreType}</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Segmented
                        value={keyResult.scoreType}
                        options={[
                          { label: TEXT.objective, value: 'objective' },
                          { label: TEXT.subjective, value: 'subjective' }
                        ]}
                        onChange={(value) => handleScoreTypeChange(index, value as 'objective' | 'subjective')}
                      />
                    </div>
                  </div>
                </div>
              </Space>
            </Card>
          ))}
        </div>
      </Space>
    </Modal>
  );

  function updateKeyResult(index: number, patch: Partial<DraftKeyResult>) {
    setKeyResults((current) =>
      current.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry))
    );
  }

  function handleScoreTypeChange(index: number, nextScoreType: 'objective' | 'subjective') {
    const current = keyResults[index];
    if (!current || current.scoreType === nextScoreType) {
      return;
    }

    if (current.scoreType === 'objective' && nextScoreType === 'subjective') {
      const confirmed = window.confirm(SUBJECTIVE_CONFIRM_TEXT);
      if (!confirmed) {
        return;
      }
    }

    updateKeyResult(index, { scoreType: nextScoreType });
  }
}
