import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Segmented, Space, Tag, Typography, Upload } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEmployeeGoalDetail, updateEmployeeKrCompletion, uploadEmployeeProof } from '../../shared/api/employee';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getCompletionStateLabel, getGoalStatusLabel } from '../../shared/i18n/labels';
import type { EmployeeKeyResult } from '../../shared/types/employee';
import { formatProofSize } from './employee.helpers';
import './employee.css';

export function EmployeeGoalPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goalId = '' } = useParams();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const goalQuery = useQuery({
    queryKey: ['employee-goal', goalId],
    queryFn: () => getEmployeeGoalDetail(goalId),
    enabled: Boolean(goalId)
  });

  const completionMutation = useMutation({
    mutationFn: ({ krId, completionState }: { krId: string; completionState: 'incomplete' | 'completed' }) =>
      updateEmployeeKrCompletion(krId, { completionState }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] })
      ]);
      message.success('关键结果完成状态已更新');
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '完成状态更新失败。');
    }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ krId, file, note }: { krId: string; file: File; note?: string }) => uploadEmployeeProof(krId, file, note),
    onSuccess: async (_payload, variables) => {
      setNoteDrafts((current) => ({
        ...current,
        [variables.krId]: ''
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employee-goal', goalId] }),
        queryClient.invalidateQueries({ queryKey: ['employee-okr'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-workbench'] }),
        queryClient.invalidateQueries({ queryKey: ['leader-ranking'] })
      ]);
      message.success('证明材料上传成功');
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '证明材料上传失败。');
    }
  });

  if (goalQuery.isLoading) {
    return <Card className="employee-toolbar-card">正在加载目标详情...</Card>;
  }

  if (goalQuery.isError || !goalQuery.data) {
    const description = goalQuery.error instanceof ApiError ? goalQuery.error.message : '目标详情加载失败。';
    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message="加载失败" description={description} />
      </Card>
    );
  }

  const goal = goalQuery.data;

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }} onClick={() => navigate('/employee/okr')}>
              返回我的 OKR
            </Button>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              {goal.code} {goal.name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {formatQuarterLabel(goal.year, goal.quarter)} · {getGoalStatusLabel(goal.status)} · {goal.totalPoints} 分
            </Typography.Paragraph>
          </div>
          <Space wrap size={[8, 8]}>
            <Tag color={goal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(goal.status)}</Tag>
            <Tag>{goal.keyResultCount} 条关键结果</Tag>
            <Tag>{goal.completedKeyResultCount} 条已完成</Tag>
            <Tag>{goal.proofCount} 份材料</Tag>
            <Tag>当前得分 {formatNullableScore(goal.currentScore)}</Tag>
          </Space>
        </div>
      </Card>

      <Card className="employee-detail-card" variant="borderless">
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {goal.description ?? '暂无目标说明'}
        </Typography.Paragraph>
      </Card>

      <div className="employee-kr-list">
        {goal.keyResults.map((keyResult) => (
          <Card key={keyResult.id} className="employee-kr-card" variant="borderless">
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div className="employee-goal-row">
                <div>
                  <Typography.Title level={4} style={{ marginBottom: 8 }}>
                    {keyResult.code} {keyResult.name}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {keyResult.description ?? '暂无关键结果说明'}
                  </Typography.Paragraph>
                </div>
                <Space wrap size={[8, 8]}>
                  <Tag>{keyResult.points} 分</Tag>
                  <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                    {getCompletionStateLabel(keyResult.completionState)}
                  </Tag>
                  <Tag icon={<FileTextOutlined />}>{keyResult.proofCount} 份材料</Tag>
                  <Tag>评分 {formatNullableScore(keyResult.reviewScore)}</Tag>
                </Space>
              </div>

              <div>
                <Typography.Text strong>完成确认</Typography.Text>
                <div style={{ marginTop: 10 }}>
                  <Segmented
                    value={keyResult.completionState}
                    options={[
                      { label: '待补充', value: 'incomplete' },
                      { label: '已完成', value: 'completed' }
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
                <Typography.Text strong>补充说明</Typography.Text>
                <Input
                  style={{ marginTop: 10 }}
                  placeholder="选填，上传时会一并记录"
                  value={noteDrafts[keyResult.id] ?? ''}
                  onChange={(event) =>
                    setNoteDrafts((current) => ({
                      ...current,
                      [keyResult.id]: event.target.value
                    }))
                  }
                />
              </div>

              <Upload
                showUploadList={false}
                customRequest={(options) => uploadProof(options, keyResult)}
                accept="*"
              >
                <Button type="primary" loading={uploadMutation.isPending}>
                  上传证明材料
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
                            {proof.note?.trim() ? proof.note : '无补充说明'}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {new Date(proof.uploadedAt).toLocaleString()} · {formatProofSize(proof.fileSize)}
                          </Typography.Text>
                        </div>
                        <a href={resolveApiUrl(proof.fileUrl)} target="_blank" rel="noreferrer">
                          打开文件
                        </a>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有上传证明材料" />
                )}
              </div>
            </Space>
          </Card>
        ))}
      </div>
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
