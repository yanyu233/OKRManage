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
import { ApiError } from '../../shared/api/http';
import { getLeaderWorkbench, updateLeaderKrScore } from '../../shared/api/leader';
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
      const description = error instanceof ApiError ? error.message : 'Failed to save score.';
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
    return <Card className="leader-detail-card">Loading leader workbench...</Card>;
  }

  if (workbenchQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert type="error" showIcon message="Failed to load leader workbench." />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-hero">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              Scoring Workbench
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Review employees in scope, switch quarter goals, and save key-result scores immediately.
            </Typography.Paragraph>
          </div>
          <Space>
            <Tag color="blue">{YEAR} Q{QUARTER}</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless" title="Employees in Scope">
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
                        {employee.sectionName ?? 'No section'} / {employee.reviewGroupName ?? 'No review group'}
                      </Typography.Paragraph>
                    </div>
                    <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                      {employee.status}
                    </Tag>
                  </div>
                  <Space wrap size={[8, 8]}>
                    <Tag>{employee.goalCount} goals</Tag>
                    <Tag>{employee.keyResultCount} key results</Tag>
                    <Tag>{employee.scoredKeyResultCount} scored</Tag>
                    <Tag>{employee.proofCount} proofs</Tag>
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
                    {selectedEmployee?.name ?? 'No employee selected'}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {selectedEmployee?.sectionName ?? 'No section'} / {selectedEmployee?.reviewGroupName ?? 'No review group'}
                  </Typography.Paragraph>
                </div>
                <Space size={16}>
                  <Tag color="blue">{selectedEmployee?.status ?? 'pending'}</Tag>
                  <Tag icon={<TrophyOutlined />}>Quarter score {selectedEmployee?.quarterScore?.toFixed(1) ?? '-'}</Tag>
                </Space>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title="Goals" value={selectedEmployee?.goalCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="Key Results" value={selectedEmployee?.keyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="Scored" value={selectedEmployee?.scoredKeyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title="Proofs" value={selectedEmployee?.proofCount ?? 0} />
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
                        {selectedGoal.description ?? 'No goal description'}
                      </Typography.Paragraph>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag>{selectedGoal.totalPoints} pts</Tag>
                      <Tag>{selectedGoal.keyResultCount} key results</Tag>
                      <Tag>{selectedGoal.proofCount} proofs</Tag>
                      <Tag>Current {selectedGoal.currentScore?.toFixed(1) ?? '-'}</Tag>
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
                                  {keyResult.description ?? 'No key result description'}
                                </Typography.Paragraph>
                              </div>
                              <Space wrap size={[8, 8]}>
                                <Tag>{keyResult.points} pts</Tag>
                                <Tag>{keyResult.completionState}</Tag>
                                <Tag icon={<FileTextOutlined />}>{keyResult.proofCount} proofs</Tag>
                              </Space>
                            </div>

                            <Row gutter={[16, 16]}>
                              <Col xs={24} lg={8}>
                                <Typography.Text strong>Score</Typography.Text>
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
                                <Typography.Text strong>Review note</Typography.Text>
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
                                        <Typography.Text type="secondary">{proof.note ?? 'No note'}</Typography.Text>
                                        <Typography.Text type="secondary">{new Date(proof.uploadedAt).toLocaleString()}</Typography.Text>
                                      </div>
                                      <a href={proof.fileUrl} target="_blank" rel="noreferrer">
                                        Open
                                      </a>
                                    </div>
                                  </Card>
                                ))
                              ) : (
                                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No proofs uploaded yet" />
                              )}
                            </div>
                          </Space>
                        </Card>
                      );
                    })}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No goals available for the selected employee" />
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
