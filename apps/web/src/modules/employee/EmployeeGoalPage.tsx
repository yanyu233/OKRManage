import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Segmented, Space, Tag, Typography, Upload } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getEmployeeGoalDetail,
  submitEmployeeGoalReview,
  updateEmployeeGoal,
  updateEmployeeKrCompletion,
  uploadEmployeeProof
} from '../../shared/api/employee';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getCompletionStateLabel, getGoalStatusLabel, getScoreTypeLabel } from '../../shared/i18n/labels';
import type { EmployeeKeyResult } from '../../shared/types/employee';
import { EmployeeCreateGoalDialog } from './EmployeeCreateGoalDialog';
import { formatProofSize } from './employee.helpers';
import './employee.css';

const TEXT = {
  loading: '正在加载目标详情...',
  loadFailedTitle: '加载失败',
  loadFailedDescription: '目标详情加载失败',
  back: '返回我的 OKR',
  draftMeta: '草稿状态不对外显示，当前仍可继续修改目标内容。',
  goalDescriptionFallback: '暂无目标说明',
  keyResultDescriptionFallback: '暂无关键结果说明',
  currentScorePrefix: '当前得分',
  scorePrefix: '得分',
  editGoal: '编辑目标',
  draftHint: '当前仍可继续修改目标、关键结果、分值和说明。',
  confirmedHint: '目标已确认，不能修改目标或关键结果内容，但仍可补充材料和确认关键结果完成。',
  pendingReviewHint: '已提交评分申请，等待负责人评分。此时仍可继续上传证明材料。',
  completedHint: '目标已完成评分。结果只读，但仍可继续上传证明材料。',
  completionTitle: '完成确认',
  incomplete: '待补充',
  completed: '已完成',
  noteTitle: '补充说明',
  notePlaceholder: '选填，上传时会一并记录',
  uploadProof: '上传证明材料',
  noProofs: '当前还没有上传证明材料',
  openFile: '打开文件',
  noNote: '无补充说明',
  editSuccess: '目标修改已保存。',
  editFailed: '目标修改失败，请稍后重试。',
  completionSuccess: '关键结果完成状态已更新。',
  completionFailed: '完成状态更新失败，请稍后重试。',
  proofUploadSuccess: '证明材料上传成功。',
  proofUploadFailed: '证明材料上传失败，请稍后重试。',
  submitReview: '确认目标完成并提交评分',
  submitReviewSuccess: '已提交评分申请，目标进入待评分状态。',
  submitReviewFailed: '提交评分申请失败，请稍后重试。',
  submitReviewDisabled: '请先将该目标下所有关键结果标记为已完成，再提交评分。',
  saveChanges: '保存修改',
  uploadAllowed: '材料上传入口在已确认、待评分、已完成阶段都保留。'
} as const;

function canEditGoal(status: string) {
  return status === 'draft';
}

function canToggleCompletion(status: string) {
  return status === 'draft' || status === 'confirmed';
}

function canSubmitReview(status: string, allCompleted: boolean) {
  return status === 'confirmed' && allCompleted;
}

export function EmployeeGoalPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goalId = '' } = useParams();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);

  const goalQuery = useQuery({
    queryKey: ['employee-goal', goalId],
    queryFn: () => getEmployeeGoalDetail(goalId),
    enabled: Boolean(goalId)
  });

  const updateGoalMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateEmployeeGoal>[1]) => updateEmployeeGoal(goalId, payload),
    onSuccess: async () => {
      setEditOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] })
      ]);
      message.success(TEXT.editSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.editFailed);
    }
  });

  const submitReviewMutation = useMutation({
    mutationFn: () => submitEmployeeGoalReview(goalId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-workbench'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-ranking'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-annual-ranking'] })
      ]);
      message.success(TEXT.submitReviewSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.submitReviewFailed);
    }
  });

  const completionMutation = useMutation({
    mutationFn: ({ krId, completionState }: { krId: string; completionState: 'incomplete' | 'completed' }) =>
      updateEmployeeKrCompletion(krId, { completionState }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] })
      ]);
      message.success(TEXT.completionSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.completionFailed);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ krId, file, note }: { krId: string; file: File; note?: string }) => uploadEmployeeProof(krId, file, note),
    onSuccess: async (_payload, variables) => {
      setNoteDrafts((current) => ({ ...current, [variables.krId]: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-workbench'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-ranking'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-annual-ranking'] })
      ]);
      message.success(TEXT.proofUploadSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.proofUploadFailed);
    }
  });

  const goal = goalQuery.data;
  const allKeyResultsCompleted = useMemo(
    () => (goal ? goal.keyResults.every((keyResult) => keyResult.completionState === 'completed') : false),
    [goal]
  );

  if (goalQuery.isLoading) {
    return <Card className="employee-toolbar-card">{TEXT.loading}</Card>;
  }

  if (goalQuery.isError || !goal) {
    const description = goalQuery.error instanceof ApiError ? goalQuery.error.message : TEXT.loadFailedDescription;

    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={description} />
      </Card>
    );
  }

  const showStatusTag = goal.status !== 'draft';

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }} onClick={() => navigate('/employee/okr')}>
              {TEXT.back}
            </Button>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              {goal.code} {goal.name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {[
                formatQuarterLabel(goal.year, goal.quarter),
                showStatusTag ? getGoalStatusLabel(goal.status) : null,
                `${goal.totalPoints} 分`
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Paragraph>
          </div>
          <Space wrap size={[8, 8]}>
            {showStatusTag ? <Tag color={goal.status === 'completed' ? 'green' : 'blue'}>{getGoalStatusLabel(goal.status)}</Tag> : null}
            <Tag>{`${goal.keyResultCount} 条关键结果`}</Tag>
            <Tag>{`${goal.completedKeyResultCount} 条已完成`}</Tag>
            <Tag>{`${goal.proofCount} 份材料`}</Tag>
            <Tag>{`${TEXT.currentScorePrefix} ${formatNullableScore(goal.currentScore)}`}</Tag>
          </Space>
        </div>
      </Card>

      <Card className="employee-detail-card" variant="borderless">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {goal.description ?? TEXT.goalDescriptionFallback}
          </Typography.Paragraph>

          {goal.status === 'draft' ? <Alert type="info" showIcon message={TEXT.draftHint} /> : null}
          {goal.status === 'confirmed' ? <Alert type="info" showIcon message={TEXT.confirmedHint} description={TEXT.uploadAllowed} /> : null}
          {goal.status === 'pending-review' ? <Alert type="warning" showIcon message={TEXT.pendingReviewHint} description={TEXT.uploadAllowed} /> : null}
          {goal.status === 'completed' ? <Alert type="success" showIcon message={TEXT.completedHint} description={TEXT.uploadAllowed} /> : null}

          <Space wrap>
            {canEditGoal(goal.status) ? (
              <Button onClick={() => setEditOpen(true)}>{TEXT.editGoal}</Button>
            ) : null}
            {goal.status === 'confirmed' ? (
              <Button
                type="primary"
                onClick={() => submitReviewMutation.mutate()}
                loading={submitReviewMutation.isPending}
                disabled={!canSubmitReview(goal.status, allKeyResultsCompleted)}
                title={!allKeyResultsCompleted ? TEXT.submitReviewDisabled : undefined}
              >
                {TEXT.submitReview}
              </Button>
            ) : null}
          </Space>
        </Space>
      </Card>

      <div className="employee-kr-list">
        {goal.keyResults.map((keyResult) => {
          const completionEditable = canToggleCompletion(goal.status);

          return (
            <Card key={keyResult.id} className="employee-kr-card" variant="borderless">
              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                <div className="employee-goal-row">
                  <div>
                    <Typography.Title level={4} style={{ marginBottom: 8 }}>
                      {keyResult.code} {keyResult.name}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {keyResult.description ?? TEXT.keyResultDescriptionFallback}
                    </Typography.Paragraph>
                  </div>
                  <Space wrap size={[8, 8]}>
                    <Tag>{`${keyResult.points} 分`}</Tag>
                    <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                      {getScoreTypeLabel(keyResult.scoreType)}
                    </Tag>
                    <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                      {getCompletionStateLabel(keyResult.completionState)}
                    </Tag>
                    <Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} 份材料`}</Tag>
                    <Tag>{`${TEXT.scorePrefix} ${formatNullableScore(keyResult.reviewScore)}`}</Tag>
                  </Space>
                </div>

                <div>
                  <Typography.Text strong>{TEXT.completionTitle}</Typography.Text>
                  <div style={{ marginTop: 10 }}>
                    <Segmented
                      value={keyResult.completionState}
                      disabled={!completionEditable}
                      options={[
                        { label: TEXT.incomplete, value: 'incomplete' },
                        { label: TEXT.completed, value: 'completed' }
                      ]}
                      onChange={(value) =>
                        completionMutation.mutate({
                          krId: keyResult.id,
                          completionState: value as 'incomplete' | 'completed'
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Typography.Text strong>{TEXT.noteTitle}</Typography.Text>
                  <Input
                    style={{ marginTop: 8 }}
                    placeholder={TEXT.notePlaceholder}
                    value={noteDrafts[keyResult.id] ?? ''}
                    onChange={(event) =>
                      setNoteDrafts((current) => ({
                        ...current,
                        [keyResult.id]: event.target.value
                      }))
                    }
                  />
                </div>

                <Upload showUploadList={false} customRequest={(options) => uploadProof(options, keyResult)} accept="*">
                  <Button type="primary" loading={uploadMutation.isPending}>
                    {TEXT.uploadProof}
                  </Button>
                </Upload>

                <div className="employee-proof-list">
                  {keyResult.proofs.length ? (
                    keyResult.proofs.map((proof) => (
                      <Card key={proof.id} size="small">
                        <div className="employee-proof-row">
                          <div className="employee-proof-meta">
                            <Typography.Text strong>{proof.fileName}</Typography.Text>
                            <Typography.Text type="secondary">
                              {proof.note?.trim() ? proof.note : TEXT.noNote}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {new Date(proof.uploadedAt).toLocaleString()} · {formatProofSize(proof.fileSize)}
                            </Typography.Text>
                          </div>
                          <a href={resolveApiUrl(proof.fileUrl)} target="_blank" rel="noreferrer">
                            {TEXT.openFile}
                          </a>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noProofs} />
                  )}
                </div>
              </Space>
            </Card>
          );
        })}
      </div>

      <EmployeeCreateGoalDialog
        open={editOpen}
        mode="edit"
        initialValue={goal}
        confirmLoading={updateGoalMutation.isPending}
        onCancel={() => setEditOpen(false)}
        onConfirm={(payload) => updateGoalMutation.mutate(payload)}
      />
    </Space>
  );

  function uploadProof(options: UploadRequestOption, keyResult: EmployeeKeyResult) {
    const file = options.file as File;

    uploadMutation.mutate(
      {
        krId: keyResult.id,
        file,
        note: noteDrafts[keyResult.id]
      },
      {
        onSuccess: (proof) => {
          options.onSuccess?.(proof);
        },
        onError: (error) => {
          options.onError?.(error as Error);
        }
      }
    );
  }
}
