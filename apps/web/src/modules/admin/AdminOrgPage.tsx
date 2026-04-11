import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Row, Space, Statistic, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getAdminBootstrap, saveAdminBootstrap } from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import type { AdminOrgBootstrapInput, ReviewGroupRecord } from '../../shared/types/admin-config';
import { createEmptyBootstrap, summarizeBootstrap, toAdminBootstrapInput } from './admin-org-form';
import { AccessSections, LeaderSections, ReviewGroupSection, StructureSections } from './AdminOrgSections';

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
      message.success('系统配置已保存。');
    },
    onError: (error) => {
      const nextError = error instanceof ApiError ? error.message : '保存失败，请稍后重试。';
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
    return <Card className="admin-page" variant="borderless">正在加载系统配置...</Card>;
  }

  if (bootstrapQuery.isError) {
    return (
      <Card className="admin-page" variant="borderless">
        <Alert type="error" showIcon message="系统配置加载失败。" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div className="page-hero">
        <div>
          <Typography.Title level={1} style={{ marginBottom: 8 }}>
            系统管理员配置台
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            统一维护部门、科室、员工角色、本地登录账号、负责人绑定以及评价组固定名额。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} size="large" onClick={() => bootstrapQuery.data && resetDraft()}>
            重置草稿
          </Button>
          <Button type="primary" icon={<SaveOutlined />} size="large" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
            保存变更
          </Button>
        </Space>
      </div>

      {saveError ? <Alert type="error" showIcon message="保存失败" description={saveError} /> : null}

      <Row gutter={[20, 20]}>
        {[
          ['部门数', summary.departmentCount],
          ['科室数', summary.sectionCount],
          ['员工数', summary.userCount],
          ['评价组数', summary.reviewGroupCount],
          ['本地账号数', summary.localAccountCount],
          ['角色绑定数', summary.roleAssignmentCount]
        ].map(([title, value]) => (
          <Col xs={24} md={12} xl={4} key={title}>
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
            { key: 'structure', label: '组织结构', children: <StructureSections draft={draft} updateCollection={updateCollection} /> },
            { key: 'access', label: '员工与角色', children: <AccessSections draft={draft} updateCollection={updateCollection} /> },
            { key: 'leaders', label: '负责人绑定', children: <LeaderSections draft={draft} updateCollection={updateCollection} /> },
            {
              key: 'review-groups',
              label: '评价组与档位名额',
              children: (
                <ReviewGroupSection
                  draft={draft}
                  updateCollection={updateCollection}
                  memberCountByReviewGroup={memberCountByReviewGroup}
                  updateReviewGroup={updateReviewGroup}
                />
              )
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
