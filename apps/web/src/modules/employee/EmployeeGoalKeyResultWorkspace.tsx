import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  InboxOutlined,
  UpOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Popconfirm, Space, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useEffect, useMemo, useRef, useState } from 'react';
import { updateEmployeeKrCompletion, uploadEmployeeProof } from '../../shared/api/employee';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { formatNullableScore, getCompletionStateLabel, getScoreTypeLabel } from '../../shared/i18n/labels';
import type { EmployeeGoalDetail, EmployeeKeyResult } from '../../shared/types/employee';
import { filterEmployeeGoalKeyResults, formatProofSize, isEmployeeKeyResultActionRequired } from './employee.helpers';

const { Dragger } = Upload;

const TEXT = {
  descriptionFallback: '暂无关键结果说明',
  noteTitle: '补充说明',
  notePlaceholder: '可选填写，本次上传的文件会统一使用这段说明',
  uploadTitle: '上传证明材料',
  uploadAction: '上传材料',
  uploadSubtitle: '支持拖拽上传和多选上传',
  uploadHint: '上传成功后会自动标记为已完成，仍可手动改回未完成。',
  noProofs: '当前还没有上传证明材料',
  noVisibleKrs: '当前没有待处理的关键结果',
  previewFile: '预览',
  downloadFile: '下载',
  noNote: '无补充说明',
  completionSuccess: '关键结果状态已更新。',
  completionFailed: '关键结果状态更新失败，请稍后重试。',
  proofUploadSuccess: '证明材料上传成功。',
  proofUploadFailed: '证明材料上传失败，请稍后重试。',
  markCompleted: '标记完成',
  markIncomplete: '改回未完成',
  completionRequiresProof: '上传材料后会自动完成，也可在已有材料后手动标记完成。',
  revertConfirmTitle: '确认改回未完成？',
  revertConfirmDescription: '改回后这个 KR 会重新出现在待处理列表中，但已上传材料会保留。',
  scorePrefix: '得分',
  proofReady: '材料已提交',
  proofMissing: '待上传材料',
  lastUploadedPrefix: '最近上传',
  pendingProofGoalHint: (count: number) => `还有 ${count} 个 KR 待上传材料`,
  pendingProofAfterReviewHint: (count: number) => `已进入待评分，仍有 ${count} 个 KR 未提交材料`,
} as const;

type EmployeeGoalKeyResultWorkspaceProps = {
  goal: EmployeeGoalDetail;
  onlyActionRequired?: boolean;
};

export function EmployeeGoalKeyResultWorkspace({
  goal,
  onlyActionRequired = false
}: EmployeeGoalKeyResultWorkspaceProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [expandedKrIds, setExpandedKrIds] = useState<string[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [uploadFileLists, setUploadFileLists] = useState<Record<string, UploadFile[]>>({});
  const uploadAnchors = useRef<Record<string, HTMLDivElement | null>>({});

  const completionEditable = goal.status === 'draft' || goal.status === 'confirmed';
  const visibleKeyResults = useMemo(
    () => filterEmployeeGoalKeyResults(goal.keyResults, onlyActionRequired),
    [goal.keyResults, onlyActionRequired]
  );

  useEffect(() => {
    setExpandedKrIds((current) => current.filter((keyResultId) => goal.keyResults.some((keyResult) => keyResult.id === keyResultId)));
  }, [goal.keyResults]);

  useEffect(() => {
    if (!onlyActionRequired) {
      return;
    }

    const nextActionIds = visibleKeyResults
      .filter((keyResult) => isEmployeeKeyResultActionRequired(keyResult))
      .map((keyResult) => keyResult.id);

    setExpandedKrIds((current) => Array.from(new Set([...current, ...nextActionIds])));
  }, [onlyActionRequired, visibleKeyResults]);

  const completionMutation = useMutation({
    mutationFn: ({ krId, completionState }: { krId: string; completionState: 'incomplete' | 'completed' }) =>
      updateEmployeeKrCompletion(krId, { completionState }),
    onSuccess: async () => {
      await invalidateGoalRelatedQueries(queryClient, goal.id);
      message.success(TEXT.completionSuccess);
    },
    onError: (error) => {
      const description =
        error instanceof ApiError && error.message === 'key result requires at least one proof before marking completed'
          ? TEXT.completionRequiresProof
          : error instanceof ApiError
            ? error.message
            : TEXT.completionFailed;
      message.error(description);
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ krId, file, note }: { krId: string; file: File; note?: string }) => uploadEmployeeProof(krId, file, note),
    onSuccess: async (_payload, variables) => {
      setNoteDrafts((current) => ({ ...current, [variables.krId]: '' }));
      await invalidateGoalRelatedQueries(queryClient, goal.id);
      message.success(TEXT.proofUploadSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.proofUploadFailed);
    }
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {goal.missingProofKeyResultCount > 0 ? (
        <Alert
          type={goal.status === 'pending-review' || goal.status === 'completed' ? 'warning' : 'info'}
          showIcon
          message={
            goal.status === 'pending-review' || goal.status === 'completed'
              ? TEXT.pendingProofAfterReviewHint(goal.missingProofKeyResultCount)
              : TEXT.pendingProofGoalHint(goal.missingProofKeyResultCount)
          }
        />
      ) : null}

      {visibleKeyResults.length ? (
        <div className="employee-kr-panels">
          {visibleKeyResults.map((keyResult) => {
            const expanded = expandedKrIds.includes(keyResult.id);

            return (
              <Card key={keyResult.id} className={`employee-kr-panel${expanded ? ' employee-kr-panel--expanded' : ''}`} variant="borderless">
                <div className="employee-kr-panel__summary">
                  <button
                    type="button"
                    className="employee-kr-panel__trigger"
                    onClick={() => toggleKrExpanded(keyResult.id)}
                  >
                    <div className="employee-kr-panel__content">
                      <Typography.Title level={5} style={{ margin: '0 0 4px' }}>
                        {keyResult.code} {keyResult.name}
                      </Typography.Title>
                      <Typography.Paragraph
                        type="secondary"
                        className="employee-kr-panel__description"
                        style={{ marginBottom: 0 }}
                      >
                        {keyResult.description ?? TEXT.descriptionFallback}
                      </Typography.Paragraph>
                    </div>

                    <Space wrap size={[8, 8]} className="employee-kr-panel__tags">
                      <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                        {getCompletionStateLabel(keyResult.completionState)}
                      </Tag>
                      <Tag color={keyResult.isProofMissing ? 'gold' : 'blue'}>
                        {keyResult.isProofMissing ? TEXT.proofMissing : TEXT.proofReady}
                      </Tag>
                      <Tag>{`${keyResult.points} 分`}</Tag>
                      <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                        {getScoreTypeLabel(keyResult.scoreType)}
                      </Tag>
                      <Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} 份材料`}</Tag>
                      {keyResult.latestProofUploadedAt ? (
                        <Tag icon={<ClockCircleOutlined />}>{`${TEXT.lastUploadedPrefix} ${formatDateTime(keyResult.latestProofUploadedAt)}`}</Tag>
                      ) : null}
                      <Tag>{`${TEXT.scorePrefix} ${formatNullableScore(keyResult.reviewScore)}`}</Tag>
                    </Space>
                  </button>

                  <Space size={8} className="employee-kr-panel__actions">
                    <Button
                      size="small"
                      icon={<UploadOutlined />}
                      onClick={() => openUploadArea(keyResult.id)}
                    >
                      {TEXT.uploadAction}
                    </Button>
                    <Button size="small" type="text" onClick={() => toggleKrExpanded(keyResult.id)}>
                      {expanded ? <UpOutlined /> : <DownOutlined />}
                    </Button>
                  </Space>
                </div>

                {expanded ? (
                  <div className="employee-kr-panel__details">
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      {completionEditable ? (
                        <div className="employee-kr-panel__completion">
                          <Typography.Text strong>完成状态</Typography.Text>
                          <Space wrap size={[8, 8]}>
                            {keyResult.completionState === 'completed' ? (
                              <Popconfirm
                                title={TEXT.revertConfirmTitle}
                                description={TEXT.revertConfirmDescription}
                                okText="确认"
                                cancelText="取消"
                                onConfirm={() => handleCompletionChange(keyResult.id, 'incomplete')}
                              >
                                <Button size="small">{TEXT.markIncomplete}</Button>
                              </Popconfirm>
                            ) : (
                              <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                disabled={!keyResult.hasProofs}
                                onClick={() => handleCompletionChange(keyResult.id, 'completed')}
                              >
                                {TEXT.markCompleted}
                              </Button>
                            )}
                            {!keyResult.hasProofs ? (
                              <Typography.Text type="secondary">{TEXT.completionRequiresProof}</Typography.Text>
                            ) : null}
                          </Space>
                        </div>
                      ) : null}

                      <div ref={(node) => { uploadAnchors.current[keyResult.id] = node; }}>
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

                      <Dragger
                        multiple
                        accept="*"
                        className="employee-proof-dragger"
                        fileList={uploadFileLists[keyResult.id] ?? []}
                        customRequest={(options) => {
                          void uploadProof(options, keyResult);
                        }}
                        onChange={({ fileList }) =>
                          setUploadFileLists((current) => ({
                            ...current,
                            [keyResult.id]: fileList.slice(-8)
                          }))
                        }
                      >
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <InboxOutlined className="employee-proof-dragger__icon" />
                          <Typography.Text strong>{TEXT.uploadTitle}</Typography.Text>
                          <Typography.Text className="employee-proof-dragger__title">{TEXT.uploadSubtitle}</Typography.Text>
                          <Typography.Text type="secondary" className="employee-proof-dragger__hint">
                            {TEXT.uploadHint}
                          </Typography.Text>
                        </Space>
                      </Dragger>

                      <div className="employee-proof-list">
                        {keyResult.proofs.length ? (
                          keyResult.proofs.map((proof) => (
                            <Card key={proof.id} size="small">
                              <div className="employee-proof-row">
                                <div className="employee-proof-meta">
                                  <Typography.Link href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                                    {proof.fileName}
                                  </Typography.Link>
                                  <Typography.Text type="secondary">
                                    {proof.note?.trim() ? proof.note : TEXT.noNote}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">
                                    {`${formatDateTime(proof.uploadedAt)} · ${formatProofSize(proof.fileSize)}`}
                                  </Typography.Text>
                                </div>
                                <Space size={8} className="employee-proof-actions">
                                  <Button type="link" size="small" href={resolveProofPreviewUrl(proof)} target="_blank" rel="noreferrer">
                                    {TEXT.previewFile}
                                  </Button>
                                  <Button type="link" size="small" href={resolveProofDownloadUrl(proof)} target="_blank" rel="noreferrer">
                                    {TEXT.downloadFile}
                                  </Button>
                                </Space>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noProofs} />
                        )}
                      </div>
                    </Space>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noVisibleKrs} />
      )}
    </Space>
  );

  function toggleKrExpanded(krId: string) {
    setExpandedKrIds((current) => (current.includes(krId) ? current.filter((entry) => entry !== krId) : [...current, krId]));
  }

  function openUploadArea(krId: string) {
    setExpandedKrIds((current) => (current.includes(krId) ? current : [...current, krId]));

    requestAnimationFrame(() => {
      uploadAnchors.current[krId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });
  }

  function handleCompletionChange(krId: string, completionState: 'incomplete' | 'completed') {
    completionMutation.mutate({
      krId,
      completionState
    });
  }

  async function uploadProof(options: UploadRequestOption, keyResult: EmployeeKeyResult) {
    const file = options.file as File;

    options.onProgress?.({ percent: 15 });

    try {
      options.onProgress?.({ percent: 60 });

      const proof = await uploadMutation.mutateAsync({
        krId: keyResult.id,
        file,
        note: noteDrafts[keyResult.id]
      });

      options.onProgress?.({ percent: 100 });
      options.onSuccess?.(proof);
    } catch (error) {
      options.onError?.(error as Error);
    }
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

async function invalidateGoalRelatedQueries(queryClient: ReturnType<typeof useQueryClient>, goalId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
    queryClient.invalidateQueries({ queryKey: ['employee-okr'] }),
    queryClient.invalidateQueries({ queryKey: ['leader-workbench'] }),
    queryClient.invalidateQueries({ queryKey: ['leader-ranking'] }),
    queryClient.invalidateQueries({ queryKey: ['leader-annual-ranking'] })
  ]);
}

function resolveProofPreviewUrl(proof: EmployeeKeyResult['proofs'][number]) {
  return resolveApiUrl(proof.previewUrl ?? proof.fileUrl);
}

function resolveProofDownloadUrl(proof: EmployeeKeyResult['proofs'][number]) {
  return resolveApiUrl(proof.downloadUrl ?? proof.fileUrl);
}
