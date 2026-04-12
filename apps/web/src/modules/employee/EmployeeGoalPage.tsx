import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Segmented, Space, Tag, Typography, Upload } from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEmployeeGoalDetail, updateEmployeeKrCompletion, uploadEmployeeProof } from '../../shared/api/employee';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getCompletionStateLabel, getGoalStatusLabel, getScoreTypeLabel } from '../../shared/i18n/labels';
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
      message.success('\u5173\u952e\u7ed3\u679c\u5b8c\u6210\u72b6\u6001\u5df2\u66f4\u65b0');
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '\u5b8c\u6210\u72b6\u6001\u66f4\u65b0\u5931\u8d25');
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
      message.success('\u8bc1\u660e\u6750\u6599\u4e0a\u4f20\u6210\u529f');
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '\u8bc1\u660e\u6750\u6599\u4e0a\u4f20\u5931\u8d25');
    }
  });

  if (goalQuery.isLoading) {
    return <Card className="employee-toolbar-card">{'\u6b63\u5728\u52a0\u8f7d\u76ee\u6807\u8be6\u60c5...'}</Card>;
  }

  if (goalQuery.isError || !goalQuery.data) {
    const description =
      goalQuery.error instanceof ApiError ? goalQuery.error.message : '\u76ee\u6807\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25';

    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message="\u52a0\u8f7d\u5931\u8d25" description={description} />
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
              {'\u8fd4\u56de\u6211\u7684 OKR'}
            </Button>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              {goal.code} {goal.name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {formatQuarterLabel(goal.year, goal.quarter)} {'\u00b7'} {getGoalStatusLabel(goal.status)} {'\u00b7'} {goal.totalPoints}
              {' \u5206'}
            </Typography.Paragraph>
          </div>
          <Space wrap size={[8, 8]}>
            <Tag color={goal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(goal.status)}</Tag>
            <Tag>{goal.keyResultCount}{'\u0020\u6761\u5173\u952e\u7ed3\u679c'}</Tag>
            <Tag>{goal.completedKeyResultCount}{'\u0020\u6761\u5df2\u5b8c\u6210'}</Tag>
            <Tag>{goal.proofCount}{'\u0020\u4efd\u6750\u6599'}</Tag>
            <Tag>{'\u5f53\u524d\u5f97\u5206 '} {formatNullableScore(goal.currentScore)}</Tag>
          </Space>
        </div>
      </Card>

      <Card className="employee-detail-card" variant="borderless">
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {goal.description ?? '\u6682\u65e0\u76ee\u6807\u8bf4\u660e'}
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
                    {keyResult.description ?? '\u6682\u65e0\u5173\u952e\u7ed3\u679c\u8bf4\u660e'}
                  </Typography.Paragraph>
                </div>
                <Space wrap size={[8, 8]}>
                  <Tag>{keyResult.points}{'\u0020\u5206'}</Tag>
                  <Tag color={keyResult.scoreType === 'objective' ? 'blue' : 'purple'}>
                    {getScoreTypeLabel(keyResult.scoreType)}
                  </Tag>
                  <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                    {getCompletionStateLabel(keyResult.completionState)}
                  </Tag>
                  <Tag icon={<FileTextOutlined />}>{keyResult.proofCount}{'\u0020\u4efd\u6750\u6599'}</Tag>
                  <Tag>{'\u8bc4\u5206 '} {formatNullableScore(keyResult.reviewScore)}</Tag>
                </Space>
              </div>

              <div>
                <Typography.Text strong>{'\u5b8c\u6210\u786e\u8ba4'}</Typography.Text>
                <div style={{ marginTop: 10 }}>
                  <Segmented
                    value={keyResult.completionState}
                    options={[
                      { label: '\u5f85\u8865\u5145', value: 'incomplete' },
                      { label: '\u5df2\u5b8c\u6210', value: 'completed' }
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
                <Typography.Text strong>{'\u8865\u5145\u8bf4\u660e'}</Typography.Text>
                <Input
                  style={{ marginTop: 10 }}
                  placeholder="\u9009\u586b\uff0c\u4e0a\u4f20\u65f6\u4f1a\u4e00\u5e76\u8bb0\u5f55"
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
                  {'\u4e0a\u4f20\u8bc1\u660e\u6750\u6599'}
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
                            {proof.note?.trim() ? proof.note : '\u65e0\u8865\u5145\u8bf4\u660e'}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {new Date(proof.uploadedAt).toLocaleString()} {'\u00b7'} {formatProofSize(proof.fileSize)}
                          </Typography.Text>
                        </div>
                        <a href={resolveApiUrl(proof.fileUrl)} target="_blank" rel="noreferrer">
                          {'\u6253\u5f00\u6587\u4ef6'}
                        </a>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="\u5f53\u524d\u8fd8\u6ca1\u6709\u4e0a\u4f20\u8bc1\u660e\u6750\u6599" />
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
