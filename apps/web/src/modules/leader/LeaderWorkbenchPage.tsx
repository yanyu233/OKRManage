import { FileTextOutlined, ReloadOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons';
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
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { getLeaderWorkbench, updateLeaderKrScore } from '../../shared/api/leader';
import { formatNullableScore, formatQuarterLabel, getCompletionStateLabel, getGoalStatusLabel, getLeaderEmployeeStatusLabel } from '../../shared/i18n/labels';
import { buildQuarterOptions, buildToolbarYearOptions } from '../../shared/ui/toolbar-options';
import type { LeaderKeyResult } from '../../shared/types/leader';
import {
  createScoreDrafts,
  filterWorkbenchEmployees,
  filterWorkbenchGoals,
  filterWorkbenchKeyResults,
  type ScoreDraft,
  resolveWorkbenchSelection
} from './leader-workbench.helpers';
import './leader.css';

const START_YEAR = 2026;
const DEFAULT_YEAR = 2026;
const DEFAULT_QUARTER = 1;
const TEXT = {
  title: '\u8bc4\u5206\u5de5\u4f5c\u53f0',
  description:
    '\u6309\u8d23\u4efb\u8303\u56f4\u67e5\u770b\u5458\u5de5\u5b63\u5ea6 OKR\uff0c\u53ef\u5207\u6362\u65f6\u95f4\u3001\u641c\u7d22\u5173\u952e\u5bf9\u8c61\uff0c\u5e76\u9010\u6761\u4e3a\u5173\u952e\u7ed3\u679c\u8bc4\u5206\u3002',
  loading: '\u6b63\u5728\u52a0\u8f7d\u8bc4\u5206\u5de5\u4f5c\u53f0...',
  loadFailed: '\u8bc4\u5206\u5de5\u4f5c\u53f0\u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u5458\u5de5\u3001\u76ee\u6807\u6216\u5173\u952e\u7ed3\u679c',
  employeeListTitle: '\u4eba\u5458\u961f\u5217',
  employeeEmpty: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u5458\u5de5',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  reviewGroupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  goalDescriptionFallback: '\u6682\u65e0\u76ee\u6807\u8bf4\u660e',
  krDescriptionFallback: '\u6682\u65e0\u5173\u952e\u7ed3\u679c\u8bf4\u660e',
  noEmployeeSelected: '\u672a\u9009\u62e9\u5458\u5de5',
  noGoals: '\u5f53\u524d\u5458\u5de5\u6682\u65e0\u76ee\u6807',
  scoreLabel: '\u8bc4\u5206',
  commentLabel: '\u8bc4\u5206\u5907\u6ce8',
  commentPlaceholder: '\u8f93\u5165\u8bc4\u5206\u5907\u6ce8',
  proofEmpty: '\u5f53\u524d\u8fd8\u6ca1\u6709\u4e0a\u4f20\u8bc1\u660e\u6750\u6599',
  openFile: '\u6253\u5f00\u6587\u4ef6',
  goalCount: '\u76ee\u6807\u6570',
  keyResultCount: '\u5173\u952e\u7ed3\u679c\u6570',
  scoredKeyResultCount: '\u5df2\u8bc4\u5206\u5173\u952e\u7ed3\u679c',
  proofCount: '\u8bc1\u660e\u6750\u6599',
  quarterScorePrefix: '\u5b63\u5ea6\u603b\u5206',
  employeeGoalCountTag: '\u4e2a\u76ee\u6807',
  employeeKeyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  employeeScoredTagPrefix: '\u5df2\u8bc4',
  employeeProofTag: '\u4efd\u6750\u6599',
  goalKeyResultTag: '\u6761\u5173\u952e\u7ed3\u679c',
  goalProofTag: '\u4efd\u6750\u6599',
  currentScoreTagPrefix: '\u5f53\u524d\u5f97\u5206'
} as const;

export function LeaderWorkbenchPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [quarter, setQuarter] = useState(DEFAULT_QUARTER);
  const [keyword, setKeyword] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});

  const yearOptions = useMemo(
    () => buildToolbarYearOptions(START_YEAR, Math.max(START_YEAR, new Date().getFullYear() + 4)),
    []
  );
  const quarterOptions = useMemo(() => buildQuarterOptions(), []);

  const workbenchQuery = useQuery({
    queryKey: ['leader-workbench', year, quarter, employeeId, goalId],
    queryFn: () =>
      getLeaderWorkbench({
        year,
        quarter,
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
      const description = error instanceof ApiError ? error.message : '\u8bc4\u5206\u4fdd\u5b58\u5931\u8d25\u3002';
      message.error(description);
    }
  });

  const selectedGoal = workbenchQuery.data?.selectedGoal ?? null;
  const selectedEmployee = workbenchQuery.data?.selectedEmployee ?? null;

  const filteredEmployees = useMemo(
    () => filterWorkbenchEmployees(workbenchQuery.data?.employees ?? [], keyword),
    [keyword, workbenchQuery.data?.employees]
  );
  const filteredGoals = useMemo(
    () => filterWorkbenchGoals(workbenchQuery.data?.goals ?? [], keyword),
    [keyword, workbenchQuery.data?.goals]
  );
  const visibleGoals = useMemo(() => {
    if (!selectedGoal) {
      return filteredGoals;
    }

    if (!keyword.trim()) {
      return workbenchQuery.data?.goals ?? [];
    }

    if (filteredGoals.some((goal) => goal.id === selectedGoal.id)) {
      return filteredGoals;
    }

    return [selectedGoal, ...filteredGoals];
  }, [filteredGoals, keyword, selectedGoal, workbenchQuery.data?.goals]);
  const filteredKeyResults = useMemo(
    () => filterWorkbenchKeyResults(selectedGoal?.keyResults ?? [], keyword),
    [keyword, selectedGoal]
  );

  const goalTabs = useMemo(
    () =>
      visibleGoals.map((goal) => ({
        key: goal.id,
        label: `${goal.code} ${goal.name}`
      })),
    [visibleGoals]
  );

  if (workbenchQuery.isLoading) {
    return <Card className="leader-detail-card">{TEXT.loading}</Card>;
  }

  if (workbenchQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert type="error" showIcon message={TEXT.loadFailed} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {TEXT.description}
            </Typography.Paragraph>
          </div>
          <div className="page-toolbar__controls">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              className="page-toolbar__search"
              placeholder={TEXT.searchPlaceholder}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Select
              value={year}
              options={yearOptions}
              onChange={(value) => {
                setYear(value);
                setEmployeeId(null);
                setGoalId(null);
              }}
              style={{ minWidth: 140 }}
            />
            <Select
              value={quarter}
              options={quarterOptions}
              onChange={(value) => {
                setQuarter(value);
                setEmployeeId(null);
                setGoalId(null);
              }}
              style={{ minWidth: 140 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => workbenchQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="leader-side-card" variant="borderless" title={TEXT.employeeListTitle}>
            <div className="leader-employee-list">
              {filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
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
                          {`${employee.sectionName ?? TEXT.sectionFallback} / ${employee.reviewGroupName ?? TEXT.reviewGroupFallback}`}
                        </Typography.Paragraph>
                      </div>
                      <Tag color={employee.status === 'completed' ? 'green' : employee.status === 'in-progress' ? 'gold' : 'default'}>
                        {getLeaderEmployeeStatusLabel(employee.status)}
                      </Tag>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag>{`${employee.goalCount} ${TEXT.employeeGoalCountTag}`}</Tag>
                      <Tag>{`${employee.keyResultCount} ${TEXT.employeeKeyResultCountTag}`}</Tag>
                      <Tag>{`${TEXT.employeeScoredTagPrefix} ${employee.scoredKeyResultCount} \u6761`}</Tag>
                      <Tag>{`${employee.proofCount} ${TEXT.employeeProofTag}`}</Tag>
                    </Space>
                  </Card>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.employeeEmpty} />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Card className="leader-detail-card" variant="borderless">
              <div className="page-hero">
                <div>
                  <Typography.Title level={2} style={{ marginBottom: 8 }}>
                    {selectedEmployee?.name ?? TEXT.noEmployeeSelected}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {`${selectedEmployee?.sectionName ?? TEXT.sectionFallback} / ${
                      selectedEmployee?.reviewGroupName ?? TEXT.reviewGroupFallback
                    } / ${formatQuarterLabel(year, quarter)}`}
                  </Typography.Paragraph>
                </div>
                <Space size={16}>
                  <Tag color="blue">{getLeaderEmployeeStatusLabel(selectedEmployee?.status ?? 'pending')}</Tag>
                  <Tag icon={<TrophyOutlined />}>{`${TEXT.quarterScorePrefix} ${formatNullableScore(selectedEmployee?.quarterScore ?? null)}`}</Tag>
                </Space>
              </div>

              <div className="leader-summary-grid" style={{ marginTop: 20 }}>
                <Card variant="borderless">
                  <Statistic title={TEXT.goalCount} value={selectedEmployee?.goalCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.keyResultCount} value={selectedEmployee?.keyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.scoredKeyResultCount} value={selectedEmployee?.scoredKeyResultCount ?? 0} />
                </Card>
                <Card variant="borderless">
                  <Statistic title={TEXT.proofCount} value={selectedEmployee?.proofCount ?? 0} />
                </Card>
              </div>
            </Card>

            <Card className="leader-detail-card" variant="borderless">
              <Tabs activeKey={selectedGoal?.id ?? goalId ?? undefined} items={goalTabs} onChange={(nextGoalId) => setGoalId(nextGoalId)} />

              {selectedGoal ? (
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div className="page-hero">
                    <div>
                      <Typography.Title level={3} style={{ marginBottom: 6 }}>
                        {selectedGoal.code} {selectedGoal.name}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {selectedGoal.description ?? TEXT.goalDescriptionFallback}
                      </Typography.Paragraph>
                    </div>
                    <Space wrap size={[8, 8]}>
                      <Tag color={selectedGoal.status === 'confirmed' ? 'green' : 'default'}>
                        {getGoalStatusLabel(selectedGoal.status)}
                      </Tag>
                      <Tag>{`${selectedGoal.totalPoints} \u5206`}</Tag>
                      <Tag>{`${selectedGoal.keyResultCount} ${TEXT.goalKeyResultTag}`}</Tag>
                      <Tag>{`${selectedGoal.proofCount} ${TEXT.goalProofTag}`}</Tag>
                      <Tag>{`${TEXT.currentScoreTagPrefix} ${formatNullableScore(selectedGoal.currentScore)}`}</Tag>
                    </Space>
                  </div>

                  <div className="leader-kr-grid">
                    {filteredKeyResults.length ? (
                      filteredKeyResults.map((keyResult) => {
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
                                    {keyResult.description ?? TEXT.krDescriptionFallback}
                                  </Typography.Paragraph>
                                </div>
                                <Space wrap size={[8, 8]}>
                                  <Tag>{`${keyResult.points} \u5206`}</Tag>
                                  <Tag color={keyResult.completionState === 'completed' ? 'green' : 'red'}>
                                    {getCompletionStateLabel(keyResult.completionState)}
                                  </Tag>
                                  <Tag icon={<FileTextOutlined />}>{`${keyResult.proofCount} ${TEXT.goalProofTag}`}</Tag>
                                </Space>
                              </div>

                              <Row gutter={[16, 16]}>
                                <Col xs={24} lg={8}>
                                  <Typography.Text strong>{TEXT.scoreLabel}</Typography.Text>
                                  <InputNumber
                                    style={{ width: '100%', marginTop: 8 }}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    value={draft.score ?? undefined}
                                    onChange={(value) =>
                                      updateDraft(keyResult.id, {
                                        score: typeof value === 'number' ? value : null
                                      })
                                    }
                                    onBlur={() => commitDraft(keyResult)}
                                  />
                                </Col>
                                <Col xs={24} lg={16}>
                                  <Typography.Text strong>{TEXT.commentLabel}</Typography.Text>
                                  <Input.TextArea
                                    rows={3}
                                    style={{ marginTop: 8 }}
                                    placeholder={TEXT.commentPlaceholder}
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
                                          <Typography.Text type="secondary">{proof.note ?? '-'}</Typography.Text>
                                          <Typography.Text type="secondary">
                                            {new Date(proof.uploadedAt).toLocaleString()}
                                          </Typography.Text>
                                        </div>
                                        <a href={resolveApiUrl(proof.fileUrl)} target="_blank" rel="noreferrer">
                                          {TEXT.openFile}
                                        </a>
                                      </div>
                                    </Card>
                                  ))
                                ) : (
                                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.proofEmpty} />
                                )}
                              </div>
                            </Space>
                          </Card>
                        );
                      })
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.proofEmpty} />
                    )}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.noGoals} />
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
