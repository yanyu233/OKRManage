import { FileTextOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { getLeaderWorkbench, updateLeaderKrScore } from '../../shared/api/leader';
import {
  formatNullableScore,
  formatQuarterLabel,
  getCompletionStateLabel,
  getGoalStatusLabel,
  getLeaderEmployeeStatusLabel
} from '../../shared/i18n/labels';
import type { LeaderKeyResult } from '../../shared/types/leader';
import { createScoreDrafts, resolveWorkbenchSelection, type ScoreDraft } from './leader-workbench.helpers';
import './leader.css';

const YEAR = 2026;
const QUARTER = 1;

export function LeaderWorkbenchPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});

  const workbenchQuery = useQuery({
    queryKey: ['leader-workbench', YEAR, QUARTER, employeeId, goalId],
    queryFn: () =>
      getLeaderWorkbench({
        year: YEAR,
        quarter: QUARTER,
        employeeId,
        goalId
      })
  });

  useEffect(() => {
    if (!workbenchQuery.data) {
      return;
    }

    const nextSelection = resolveWorkbenchSelection(workbenchQuery.data, { employeeId, goalId });
    if (nextSelection.employeeId !== employeeId) {
      setEmployeeId(nextSelection.employeeId);
    }
    if (nextSelection.goalId !== goalId) {
      setGoalId(nextSelection.goalId);
    }
    setDrafts(createScoreDrafts(workbenchQuery.data.selectedGoal));
  }, [employeeId, goalId, workbenchQuery.data]);

  const scoreMutation = useMutation({
    mutationFn: ({ krId, draft }: { krId: string; draft: ScoreDraft }) =>
      updateLeaderKrScore(krId, {
        score: draft.score ?? 0,
        comment: draft.comment
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-ranking'] });
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : '评分保存失败。';
      message.error(description);
    }
  });

  const selectedGoal = workbenchQuery.data?.selectedGoal ?? null;
  const selectedEmployee = workbenchQuery.data?.selectedEmployee ?? null;

  const goalTabs = useMemo(
    () =>
      (workbenchQuery.data?.goals ?? []).map((goal) => ({
        key: goal.id,
        label: `${goal.code} ${goal.name}`
      })),
    [workbenchQuery.data?.goals]
  );

  if (workbenchQuery.isLoading) {
    return <Card className="leader-detail-card">正在加载评分工作台...</Card>;
  }

  if (workbenchQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert type="error" showIcon message="评分工作台加载失败。" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              评分工作台
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              按责任范围查看员工季度 OKR，切换目标后可逐条为关键结果评分，修改后立即保存。
            </Typography.Paragraph>
          </div>
          <Space>
            <Tag color="blue">{formatQuarterLabel(YEAR, QUARTER)}</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless" title="人员队列">
            <div className="leader-employee-list">
              {workbenchQuery.data?.employees.map((employee) => (
                <Card
                  key={employee.id}
                  className={`leader-selectable-card ${employee.id === selectedEmployee?.id ? 'leader-selectable-card--active' : ''}`}
                  onClick={() => {
                    setEmployeeId(employee.id);
                    setGoalId(null);
                  }}
                >
                  <div className="leader-ranking-entry">
                    <div>
                      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                        {employee.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                        {employee.sectionName ?? '未分配科室'} / {employee.reviewGroupName ?? '未分配评价组'}
                      </Typography.Paragraph>
                    </div>
                    <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                      {getLeaderEmployeeStatusLabel(employee.status)}
                    </Tag>
                  </div>
                  <Space wrap size={[8, 8]}>
                    <Tag>{employee.goalCount} 个目标</Tag>
                    <Tag>{employee.keyResultCount} 条关键结果</Tag>
                    <Tag>已评 {employee.scoredKeyResultCount} 条</Tag>
                    <Tag>{employee.proofCount} 份材料</Tag>
                  </Space>
                </Card>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless">
              <div className="page-hero">
                <div>
                  <Typography.Title level={2} style={{ marginBottom: 8 }}>
                    {selectedEmployee?.name ?? '未选择员工'}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {selectedEmployee?.sectionName ?? '未分配科室'} / {selectedEmployee?.reviewGroupName ?? '未分配评价组'}
                  </Typography.Paragraph>
                </div>
                <Space size={16}>
                  <Tag color="blue">{getLeaderEmployeeStatusLabel(selectedEmployee?.status ?? 'pending')}</Tag>
                  <Tag icon={<TrophyOutlined />}>季度总分 {formatNullableScore(selectedEmployee?.quarterScore ?? null)}</Tag>
                </Space>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title="目标数" value={selectedEmployee?.goalCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="关键结果数" value={selectedEmployee?.keyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="已评分关键结果" value={selectedEmployee?.scoredKeyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="证明材料" value={selectedEmployee?.proofCount ?? 0} />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless">
              <Tabs activeKey={goalId ?? undefined} items={goalTabs} onChange={(nextGoalId) => setGoalId(nextGoalId)} />

              {selectedGoal ? (
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div className="page-hero">
                    <div>
                      <Typography.Title level={3} style={{ marginBottom: 6 }}>
                        {selectedGoal.code} {selectedGoal.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {selectedGoal.description ?? '暂无目标说明'}
                      </Typography.Paragraph>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag color={selectedGoal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(selectedGoal.status)}</Tag>
                      <Tag>{selectedGoal.totalPoints} 分</Tag>
                      <Tag>{selectedGoal.keyResultCount} 条关键结果</Tag>
                      <Tag>{selectedGoal.proofCount} 份材料</Tag>
                      <Tag>当前得分 {formatNullableScore(selectedGoal.currentScore)}</Tag>
                    </Space>
                  </div>

                  <div className="leader-kr-grid">
                    {selectedGoal.keyResults.map((keyResult) => {
                      const draft = drafts[keyResult.id] ?? {
                        score: keyResult.reviewScore,
                        comment: keyResult.reviewComment ?? ''
                      };

                      return (
                        <Card key={keyResult.id} className="leader-kr-card" variant="borderless">
                          <Space direction="vertical" size={16} style={{ width: '100%' }}>
                            <div className="page-hero">
                              <div>
                                <Typography.Title level={4} style={{ marginBottom: 6 }}>
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
                              </Space>
                            </div>

                            <Row gutter={[16, 16]}>
                              <Col xs={24} lg={8}>
                                <Typography.Text strong>评分</Typography.Text>
                                <InputNumber
                                  style={{ width: '100%', marginTop: 8 }}
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={draft.score ?? undefined}
                                  onChange={(value) => updateDraft(keyResult.id, { score: typeof value === 'number' ? value : null })}
                                  onBlur={() => commitDraft(keyResult)}
                                />
                              </Col>
                              <Col xs={24} lg={16}>
                                <Typography.Text strong>评分备注</Typography.Text>
                                <Input.TextArea
                                  rows={3}
                                  style={{ marginTop: 8 }}
                                  value={draft.comment}
                                  onChange={(event) => updateDraft(keyResult.id, { comment: event.target.value })}
                                  onBlur={() => commitDraft(keyResult)}
                                />
                              </Col>
                            </Row>

                            <div className="leader-proof-list">
                              {keyResult.proofs.length ? (
                                keyResult.proofs.map((proof) => (
                                  <Card key={proof.id} size="small">
                                    <div className="leader-proof-row">
                                      <div className="leader-proof-meta">
                                        <Typography.Text strong>{proof.fileName}</Typography.Text>
                                        <Typography.Text type="secondary">{proof.note ?? '无备注'}</Typography.Text>
                                        <Typography.Text type="secondary">{new Date(proof.uploadedAt).toLocaleString()}</Typography.Text>
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
                      );
                    })}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前员工暂无目标" />
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );

  function updateDraft(krId: string, patch: Partial<ScoreDraft>) {
    setDrafts((current) => ({
      ...current,
      [krId]: {
        score: current[krId]?.score ?? null,
        comment: current[krId]?.comment ?? '',
        ...patch
      }
    }));
  }

  function commitDraft(keyResult: LeaderKeyResult) {
    const draft = drafts[keyResult.id];
    if (!draft || draft.score === null) {
      return;
    }
    if (draft.score === keyResult.reviewScore && draft.comment === (keyResult.reviewComment ?? '')) {
      return;
    }
    scoreMutation.mutate({
      krId: keyResult.id,
      draft
    });
  }
}
