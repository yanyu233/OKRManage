import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Empty, Input, Row, Select, Space, Statistic, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployeeGoalTemplates, getEmployeeOkr, importEmployeeGoalTemplates } from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatQuarterLabel, formatNullableScore, getGoalStatusLabel } from '../../shared/i18n/labels';
import { buildQuarterOptions, buildToolbarYearOptions } from '../../shared/ui/toolbar-options';
import { buildYearOptions, filterEmployeeGoals } from './employee.helpers';
import { EmployeeTemplateImportDialog } from './EmployeeTemplateImportDialog';
import './employee.css';

const START_YEAR = 2026;
const DEFAULT_YEAR = 2026;
const DEFAULT_QUARTER = 1;
const TEXT = {
  title: '\u6211\u7684 OKR',
  loading: '\u6b63\u5728\u52a0\u8f7d\u6211\u7684 OKR...',
  loadFailedTitle: '\u52a0\u8f7d\u5931\u8d25',
  loadFailedDescription: '\u5458\u5de5 OKR \u52a0\u8f7d\u5931\u8d25\u3002',
  refresh: '\u5237\u65b0',
  searchPlaceholder: '\u641c\u7d22\u76ee\u6807\u540d\u79f0\u6216\u8bf4\u660e',
  sectionFallback: '\u672a\u5206\u914d\u79d1\u5ba4',
  groupFallback: '\u672a\u5206\u914d\u8bc4\u4ef7\u7ec4',
  goalCount: '\u76ee\u6807\u6570',
  keyResultCount: '\u5173\u952e\u7ed3\u679c\u6570',
  completedKeyResultCount: '\u5df2\u5b8c\u6210\u5173\u952e\u7ed3\u679c',
  proofCount: '\u8bc1\u660e\u6750\u6599',
  quarterScore: '\u5f53\u524d\u5b63\u5ea6\u5f97\u5206',
  importTemplates: '\u5bfc\u5165\u6a21\u677f\u76ee\u6807',
  importSuccess: '\u6a21\u677f\u76ee\u6807\u5bfc\u5165\u6210\u529f\u3002',
  goalsTitle: '\u672c\u5b63\u5ea6\u76ee\u6807',
  goalsDescription:
    '\u5728\u8fd9\u91cc\u67e5\u770b\u672c\u5b63\u5ea6\u7684\u76ee\u6807\u4e0e\u5173\u952e\u7ed3\u679c\u8fdb\u5c55\uff0c\u70b9\u51fb\u76ee\u6807\u540e\u53ef\u8fdb\u5165\u8be6\u60c5\u9875\u9762\u3002',
  goalDescriptionFallback: '\u6682\u65e0\u76ee\u6807\u8bf4\u660e',
  keyResultCountTag: '\u6761\u5173\u952e\u7ed3\u679c',
  completedTag: '\u6761\u5df2\u5b8c\u6210',
  proofTag: '\u4efd\u6750\u6599',
  currentScoreTagPrefix: '\u5f53\u524d\u5f97\u5206',
  viewGoalDetail: '\u67e5\u770b\u76ee\u6807\u8be6\u60c5',
  emptyGoals: '\u5f53\u524d\u7b5b\u9009\u6761\u4ef6\u4e0b\u6ca1\u6709\u5339\u914d\u76ee\u6807'
} as const;

export function EmployeeOkrPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [quarter, setQuarter] = useState(DEFAULT_QUARTER);
  const [keyword, setKeyword] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const okrQuery = useQuery({
    queryKey: ['employee-okr', year, quarter],
    queryFn: () =>
      getEmployeeOkr({
        year,
        quarter
      })
  });

  const yearOptions = useMemo(
    () => buildToolbarYearOptions(START_YEAR, Math.max(START_YEAR, new Date().getFullYear() + 4)),
    []
  );
  const quarterOptions = useMemo(() => buildQuarterOptions(), []);
  const yearValues = useMemo(() => buildYearOptions(START_YEAR, Math.max(START_YEAR, new Date().getFullYear() + 4)), []);

  const summaryCards = useMemo(
    () =>
      okrQuery.data
        ? [
            [TEXT.goalCount, okrQuery.data.employee.goalCount],
            [TEXT.keyResultCount, okrQuery.data.employee.keyResultCount],
            [TEXT.completedKeyResultCount, okrQuery.data.employee.completedKeyResultCount],
            [TEXT.proofCount, okrQuery.data.employee.proofCount]
          ]
        : [],
    [okrQuery.data]
  );

  const filteredGoals = useMemo(
    () => filterEmployeeGoals(okrQuery.data?.goals ?? [], keyword),
    [keyword, okrQuery.data?.goals]
  );

  const templatesQuery = useQuery({
    queryKey: ['employee-goal-templates', year, quarter],
    queryFn: () =>
      getEmployeeGoalTemplates({
        year,
        quarter
      }),
    enabled: importDialogOpen
  });

  const importMutation = useMutation({
    mutationFn: (templateIds: string[]) =>
      importEmployeeGoalTemplates({
        year,
        quarter,
        templateIds
      }),
    onSuccess: async () => {
      message.success(TEXT.importSuccess);
      setImportDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['employee-okr'] });
      await queryClient.invalidateQueries({ queryKey: ['employee-goal-templates'] });
    },
    onError: (error) => {
      const description = error instanceof ApiError ? error.message : TEXT.loadFailedDescription;
      message.error(description);
    }
  });

  if (okrQuery.isLoading) {
    return <Card className="employee-toolbar-card">{TEXT.loading}</Card>;
  }

  if (okrQuery.isError) {
    const message = okrQuery.error instanceof ApiError ? okrQuery.error.message : TEXT.loadFailedDescription;
    return (
      <Card className="employee-toolbar-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={message} />
      </Card>
    );
  }

  const payload = okrQuery.data!;

  return (
    <Space direction="vertical" size={24} className="employee-page">
      <Card className="employee-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {TEXT.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {`${payload.employee.name} / ${payload.employee.sectionName ?? TEXT.sectionFallback} / ${
                payload.employee.reviewGroupName ?? TEXT.groupFallback
              }`}
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
              options={yearOptions.filter((option) => yearValues.includes(option.value))}
              onChange={(value) => setYear(value)}
              style={{ minWidth: 140 }}
            />
            <Select
              value={quarter}
              options={quarterOptions}
              onChange={(value) => setQuarter(value)}
              style={{ minWidth: 140 }}
            />
            <Button type="primary" onClick={() => setImportDialogOpen(true)}>
              {TEXT.importTemplates}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => okrQuery.refetch()}>
              {TEXT.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <div className="employee-summary-grid">
        {summaryCards.map(([title, value]) => (
          <Card key={title} className="employee-summary-card" variant="borderless">
            <Statistic title={title} value={value as number} />
          </Card>
        ))}
        <Card className="employee-summary-card" variant="borderless">
          <Statistic title={TEXT.quarterScore} value={formatNullableScore(payload.employee.quarterScore)} />
        </Card>
      </div>

      <Card className="employee-detail-card" variant="borderless">
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div className="page-hero">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 6 }}>
                {TEXT.goalsTitle}
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {`${formatQuarterLabel(payload.year, payload.quarter)} / ${TEXT.goalsDescription}`}
              </Typography.Paragraph>
            </div>
          </div>

          {filteredGoals.length ? (
            <Row gutter={[20, 20]}>
              {filteredGoals.map((goal) => (
                <Col xs={24} xl={12} key={goal.id}>
                  <Card className="employee-goal-card" variant="borderless" onClick={() => navigate(`/employee/goal/${goal.id}`)}>
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div className="employee-goal-row">
                        <div>
                          <Typography.Title level={4} style={{ marginBottom: 8 }}>
                            {goal.code} {goal.name}
                          </Typography.Title>
                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            {goal.description ?? TEXT.goalDescriptionFallback}
                          </Typography.Paragraph>
                        </div>
                        <Tag color={goal.status === 'confirmed' ? 'green' : 'default'}>{getGoalStatusLabel(goal.status)}</Tag>
                      </div>

                      <Space wrap size={[8, 8]}>
                        <Tag>{`${goal.totalPoints} \u5206`}</Tag>
                        <Tag>{`${goal.keyResultCount} ${TEXT.keyResultCountTag}`}</Tag>
                        <Tag>{`${goal.completedKeyResultCount} ${TEXT.completedTag}`}</Tag>
                        <Tag>{`${goal.proofCount} ${TEXT.proofTag}`}</Tag>
                        <Tag>{`${TEXT.currentScoreTagPrefix} ${formatNullableScore(goal.currentScore)}`}</Tag>
                      </Space>

                      <Button type="link" style={{ paddingInline: 0 }}>
                        {TEXT.viewGoalDetail}
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.emptyGoals} />
          )}
        </Space>
      </Card>

      <EmployeeTemplateImportDialog
        open={importDialogOpen}
        loading={templatesQuery.isLoading}
        confirmLoading={importMutation.isPending}
        departmentName={templatesQuery.data?.departmentName ?? payload.employee.sectionName ?? null}
        templates={templatesQuery.data?.templates ?? []}
        onCancel={() => setImportDialogOpen(false)}
        onConfirm={(templateIds) => importMutation.mutate(templateIds)}
      />
    </Space>
  );
}
