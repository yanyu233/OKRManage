import { DeleteOutlined, DownOutlined, EditOutlined, UpOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Space, Spin, Tag, Typography } from 'antd';
import { getEmployeeGoalDetail } from '../../shared/api/employee';
import { ApiError } from '../../shared/api/http';
import { formatNullableScore, getGoalStatusLabel } from '../../shared/i18n/labels';
import type { EmployeeGoalSummary, EmployeeKeyResult } from '../../shared/types/employee';
import { EmployeeGoalKeyResultWorkspace } from './EmployeeGoalKeyResultWorkspace';

const TEXT = {
  descriptionFallback: '暂无目标说明',
  loading: '正在加载目标内容...',
  loadFailed: '目标详情加载失败',
  editGoal: '编辑目标',
  missingProofTag: (count: number) => `待上传材料 ${count} 项`
} as const;

type EmployeeGoalAccordionItemProps = {
  goal: EmployeeGoalSummary;
  expanded: boolean;
  onlyActionRequired: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteKeyResult: (keyResult: EmployeeKeyResult) => void;
  editing: boolean;
  deleting: boolean;
  deletingKeyResultId: string | null;
};

export function EmployeeGoalAccordionItem({
  goal,
  expanded,
  onlyActionRequired,
  onToggle,
  onEdit,
  onDelete,
  onDeleteKeyResult,
  editing,
  deleting,
  deletingKeyResultId
}: EmployeeGoalAccordionItemProps) {
  const detailQuery = useQuery({
    queryKey: ['employee-goal', goal.id],
    queryFn: () => getEmployeeGoalDetail(goal.id),
    enabled: expanded
  });

  const goalEditable = goal.status === 'draft';

  return (
    <Card className={`employee-goal-accordion${expanded ? ' employee-goal-accordion--expanded' : ''}`} variant="borderless">
      <div className="employee-goal-accordion__summary">
        <button type="button" className="employee-goal-accordion__trigger" onClick={onToggle}>
          <div className="employee-goal-accordion__content">
            <Typography.Title level={4} style={{ margin: '0 0 6px' }}>
              {goal.code} {goal.name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="employee-goal-accordion__description" style={{ marginBottom: 0 }}>
              {goal.description ?? TEXT.descriptionFallback}
            </Typography.Paragraph>
          </div>

          <Space wrap size={[6, 6]} className="employee-goal-accordion__tags employee-goal-chip-row">
            {goal.status !== 'draft' ? <Tag color={goal.status === 'completed' ? 'green' : 'blue'}>{getGoalStatusLabel(goal.status)}</Tag> : null}
            <Tag>{`${goal.totalPoints} 分`}</Tag>
            <Tag>{`${goal.keyResultCount} 条 KR`}</Tag>
            <Tag>{`${goal.proofCount} 份材料`}</Tag>
            {goal.missingProofKeyResultCount > 0 ? <Tag color="gold">{TEXT.missingProofTag(goal.missingProofKeyResultCount)}</Tag> : null}
            <Tag>{`当前得分 ${formatNullableScore(goal.currentScore)}`}</Tag>
          </Space>
        </button>

        <Space size={8} className="employee-goal-accordion__actions">
          {goalEditable ? (
            <Button size="small" icon={<EditOutlined />} loading={editing} onClick={onEdit}>
              {TEXT.editGoal}
            </Button>
          ) : null}
          {goalEditable ? (
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleting} onClick={onDelete}>
              删除目标
            </Button>
          ) : null}
          <Button size="small" type="text" onClick={onToggle}>
            {expanded ? <UpOutlined /> : <DownOutlined />}
          </Button>
        </Space>
      </div>

      {expanded ? (
        <div className="employee-goal-accordion__details">
          {detailQuery.isLoading ? (
            <div className="employee-goal-accordion__loading">
              <Spin size="small" />
              <Typography.Text type="secondary">{TEXT.loading}</Typography.Text>
            </div>
          ) : detailQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message={TEXT.loadFailed}
              description={detailQuery.error instanceof ApiError ? detailQuery.error.message : undefined}
            />
          ) : detailQuery.data ? (
            <EmployeeGoalKeyResultWorkspace
              goal={detailQuery.data}
              onlyActionRequired={onlyActionRequired}
              deletingKeyResultId={deletingKeyResultId}
              onDeleteKeyResult={onDeleteKeyResult}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
