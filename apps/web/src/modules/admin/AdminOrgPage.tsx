import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Row, Space, Statistic, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getAdminBootstrap, saveAdminBootstrap } from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import type { AdminOrgBootstrapInput, ReviewGroupRecord } from '../../shared/types/admin-config';
import { createEmptyBootstrap, summarizeBootstrap, toAdminBootstrapInput } from './admin-org-form';
import {
  AccessSections,
  AdminGoalTemplateSection,
  LeaderSections,
  ReviewGroupSection,
  StructureSections
} from './AdminOrgSections';

const TEXT = {
  loading: '\u6b63\u5728\u52a0\u8f7d\u7cfb\u7edf\u914d\u7f6e...',
  loadFailed: '\u7cfb\u7edf\u914d\u7f6e\u52a0\u8f7d\u5931\u8d25\u3002',
  title: '\u7cfb\u7edf\u7ba1\u7406\u5458\u914d\u7f6e\u53f0',
  description:
    '\u7edf\u4e00\u7ef4\u62a4\u90e8\u95e8\u3001\u79d1\u5ba4\u3001\u5458\u5de5\u89d2\u8272\u3001\u672c\u5730\u767b\u5f55\u8d26\u53f7\u3001\u8d1f\u8d23\u4eba\u7ed1\u5b9a\u3001\u8bc4\u4ef7\u7ec4\u4ee5\u53ca\u6a21\u677f\u76ee\u6807\u3002',
  reset: '\u91cd\u7f6e\u8349\u7a3f',
  save: '\u4fdd\u5b58\u53d8\u66f4',
  saveSuccess: '\u7cfb\u7edf\u914d\u7f6e\u5df2\u4fdd\u5b58\u3002',
  saveFailedTitle: '\u4fdd\u5b58\u5931\u8d25',
  saveFailedDescription: '\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  departmentCount: '\u90e8\u95e8\u6570',
  sectionCount: '\u79d1\u5ba4\u6570',
  userCount: '\u5458\u5de5\u6570',
  reviewGroupCount: '\u8bc4\u4ef7\u7ec4\u6570',
  localAccountCount: '\u672c\u5730\u8d26\u53f7\u6570',
  roleAssignmentCount: '\u89d2\u8272\u7ed1\u5b9a\u6570',
  goalTemplateCount: '\u6a21\u677f\u76ee\u6807\u6570',
  structureTab: '\u7ec4\u7ec7\u7ed3\u6784',
  accessTab: '\u5458\u5de5\u4e0e\u89d2\u8272',
  leaderTab: '\u8d1f\u8d23\u4eba\u7ed1\u5b9a',
  reviewGroupTab: '\u8bc4\u4ef7\u7ec4\u4e0e\u6863\u4f4d\u540d\u989d',
  goalTemplateTab: '\u6a21\u677f\u76ee\u6807'
} as const;

export function AdminOrgPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const bootstrapQuery = useQuery({
    queryKey: ['admin-org-bootstrap'],
    queryFn: getAdminBootstrap
  });
  const [draft, setDraft] = useState<AdminOrgBootstrapInput>(createEmptyBootstrap());
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!bootstrapQuery.data || isDirty) {
      return;
    }

    setDraft(toAdminBootstrapInput(bootstrapQuery.data));
  }, [bootstrapQuery.data, isDirty]);

  const saveMutation = useMutation({
    mutationFn: saveAdminBootstrap,
    onSuccess: async (payload) => {
      setDraft(toAdminBootstrapInput(payload));
      setIsDirty(false);
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-org-bootstrap'] });
      message.success(TEXT.saveSuccess);
    },
    onError: (error) => {
      const nextError = error instanceof ApiError ? error.message : TEXT.saveFailedDescription;
      setSaveError(nextError);
      message.error(nextError);
    }
  });

  const summary = useMemo(() => summarizeBootstrap(draft), [draft]);
  const memberCountByReviewGroup = useMemo(() => {
    const result = new Map<string, number>();
    for (const user of draft.users) {
      if (!user.isActive || !user.reviewGroupId) {
        continue;
      }

      result.set(user.reviewGroupId, (result.get(user.reviewGroupId) ?? 0) + 1);
    }
    return result;
  }, [draft.users]);

  if (bootstrapQuery.isLoading) {
    return (
      <Card className="admin-page" variant="borderless">
        {TEXT.loading}
      </Card>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <Card className="admin-page" variant="borderless">
        <Alert type="error" showIcon message={TEXT.loadFailed} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div className="page-hero">
        <div>
          <Typography.Title level={1} style={{ marginBottom: 8 }}>
            {TEXT.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.description}
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} size="large" onClick={() => bootstrapQuery.data && resetDraft()}>
            {TEXT.reset}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
          >
            {TEXT.save}
          </Button>
        </Space>
      </div>

      {saveError ? <Alert type="error" showIcon message={TEXT.saveFailedTitle} description={saveError} /> : null}

      <Row gutter={[20, 20]}>
        {[
          [TEXT.departmentCount, summary.departmentCount],
          [TEXT.sectionCount, summary.sectionCount],
          [TEXT.userCount, summary.userCount],
          [TEXT.reviewGroupCount, summary.reviewGroupCount],
          [TEXT.localAccountCount, summary.localAccountCount],
          [TEXT.roleAssignmentCount, summary.roleAssignmentCount],
          [TEXT.goalTemplateCount, draft.goalTemplates.length]
        ].map(([title, value]) => (
          <Col xs={24} md={12} xl={6} xxl={4} key={title}>
            <Card className="metric-card" variant="borderless">
              <Statistic title={title as string} value={value as number} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="admin-page" variant="borderless">
        <Tabs
          size="large"
          items={[
            { key: 'structure', label: TEXT.structureTab, children: <StructureSections draft={draft} updateCollection={updateCollection} /> },
            { key: 'access', label: TEXT.accessTab, children: <AccessSections draft={draft} updateCollection={updateCollection} /> },
            { key: 'leaders', label: TEXT.leaderTab, children: <LeaderSections draft={draft} updateCollection={updateCollection} /> },
            {
              key: 'review-groups',
              label: TEXT.reviewGroupTab,
              children: (
                <ReviewGroupSection
                  draft={draft}
                  updateCollection={updateCollection}
                  memberCountByReviewGroup={memberCountByReviewGroup}
                  updateReviewGroup={updateReviewGroup}
                />
              )
            },
            {
              key: 'goal-templates',
              label: TEXT.goalTemplateTab,
              children: <AdminGoalTemplateSection draft={draft} updateCollection={updateCollection} />
            }
          ]}
        />
      </Card>
    </Space>
  );

  function resetDraft() {
    setDraft(toAdminBootstrapInput(bootstrapQuery.data!));
    setIsDirty(false);
    setSaveError(null);
  }

  function updateCollection<Key extends keyof AdminOrgBootstrapInput>(
    key: Key,
    updater: (items: AdminOrgBootstrapInput[Key]) => AdminOrgBootstrapInput[Key]
  ) {
    setDraft((current) => ({ ...current, [key]: updater(current[key]) }));
    setIsDirty(true);
  }

  function updateReviewGroup(reviewGroupId: string, patch: Partial<Omit<ReviewGroupRecord, 'memberCount'>>) {
    updateCollection('reviewGroups', (items) =>
      items.map((item) => (item.id === reviewGroupId ? { ...item, ...patch } : item))
    );
  }
}
