import {
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Empty, Input, Modal, Space, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import {
  downloadLeaderKnowledgeBase,
  getLeaderKnowledgeBase,
  updateLeaderKnowledgeProof
} from '../../shared/api/leader';
import type { LeaderKnowledgeEntry } from '../../shared/types/leader';
import { formatProofSize } from '../employee/employee.helpers';
import './leader.css';

const T = {
  title: '知识库',
  desc: '集中收录被标记为知识的证明材料，可查看关联员工、目标与关键结果，并维护文件与说明。',
  loading: '正在加载知识库...',
  loadFailed: '知识库加载失败。',
  refresh: '刷新',
  search: '搜索文件名、员工、目标、关键结果或说明',
  empty: '当前还没有被收录到知识库的证明材料。',
  preview: '预览',
  download: '下载',
  bulkDownload: '批量下载',
  selectAll: '全选',
  clearSelection: '取消全选',
  bulkDownloadEmpty: '请先选择要下载的知识材料。',
  bulkDownloadSuccess: '知识库资料已开始下载。',
  bulkDownloadFailed: '知识库资料打包下载失败。',
  selectedCount: '已选',
  selectedUnit: '份资料',
  selectEntry: '选择资料',
  edit: '更新资料',
  noteEmpty: '暂无说明',
  employee: '关联员工',
  goal: '关联目标',
  keyResult: '关联关键结果',
  updatedAt: '最近更新',
  updateTitle: '更新知识资料',
  updateHint: '可只更新说明，也可以替换为新的证明文件，关联员工、目标和关键结果会保持不变。',
  noteLabel: '说明',
  notePlaceholder: '补充这份知识材料的说明或使用场景',
  fileLabel: '替换文件',
  fileHint: '不上传新文件时，会保留当前文件。',
  currentFile: '当前文件',
  save: '保存更新',
  cancel: '取消',
  updateSuccess: '知识资料已更新。',
  updateFailed: '知识资料更新失败。',
  knowledgeTag: '知识材料',
  viewMore: '展开',
  unassignedSection: '未分配科室',
  unassignedGroup: '未分配小组'
} as const;

export function LeaderKnowledgeBasePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [editingEntry, setEditingEntry] = useState<LeaderKnowledgeEntry | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftFiles, setDraftFiles] = useState<UploadFile[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);

  const knowledgeQuery = useQuery({
    queryKey: ['leader-knowledge-base'],
    queryFn: () => getLeaderKnowledgeBase()
  });

  const updateMutation = useMutation({
    mutationFn: ({ proofId, payload }: { proofId: string; payload: FormData }) =>
      updateLeaderKnowledgeProof(proofId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-knowledge-base'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      message.success(T.updateSuccess);
      closeEditor();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.updateFailed)
  });

  const downloadMutation = useMutation({
    mutationFn: (proofIds: string[]) => downloadLeaderKnowledgeBase(proofIds),
    onSuccess: ({ blob, headers }) => {
      downloadBlobFile(blob, resolveDownloadFileName(headers.get('content-disposition'), '知识库资料.zip'));
      message.success(T.bulkDownloadSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.bulkDownloadFailed)
  });

  const entries = knowledgeQuery.data?.entries ?? [];

  useEffect(() => {
    const availableIds = new Set(entries.map((entry) => entry.id));
    setSelectedEntryIds((current) => current.filter((proofId) => availableIds.has(proofId)));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return entries;
    }

    return entries.filter((entry) =>
      [
        entry.fileName,
        entry.note ?? '',
        entry.employeeName,
        entry.sectionName ?? '',
        entry.reviewGroupName ?? '',
        `${entry.goalCode} ${entry.goalName}`,
        `${entry.keyResultCode} ${entry.keyResultName}`
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [entries, keyword]);

  const selectedEntryIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const filteredEntryIds = useMemo(() => filteredEntries.map((entry) => entry.id), [filteredEntries]);
  const selectedVisibleCount = useMemo(
    () => filteredEntryIds.filter((entryId) => selectedEntryIdSet.has(entryId)).length,
    [filteredEntryIds, selectedEntryIdSet]
  );
  const allVisibleSelected = filteredEntryIds.length > 0 && selectedVisibleCount === filteredEntryIds.length;
  const partiallyVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  if (knowledgeQuery.isLoading) {
    return <Card className="leader-detail-card">{T.loading}</Card>;
  }

  if (knowledgeQuery.isError) {
    return (
      <Card className="leader-detail-card">
        <Alert
          type="error"
          showIcon
          message={T.loadFailed}
          description={knowledgeQuery.error instanceof ApiError ? knowledgeQuery.error.message : undefined}
        />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={24} className="leader-page">
      <Card className="leader-toolbar-card" variant="borderless">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={1} style={{ marginBottom: 8 }}>
              {T.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {T.desc}
            </Typography.Paragraph>
          </div>
          <div className="page-toolbar__controls">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              className="page-toolbar__search"
              placeholder={T.search}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button
              onClick={() => toggleSelectVisibleEntries(!allVisibleSelected)}
              disabled={!filteredEntryIds.length}
            >
              {allVisibleSelected ? T.clearSelection : T.selectAll}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              disabled={!selectedEntryIds.length}
              loading={downloadMutation.isPending}
              onClick={() => void handleBulkDownload()}
            >
              {T.bulkDownload}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => knowledgeQuery.refetch()}>
              {T.refresh}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="leader-detail-card" variant="borderless">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="leader-knowledge-toolbar">
            <Typography.Text type="secondary">
              {`${T.selectedCount} ${selectedEntryIds.length} ${T.selectedUnit}`}
            </Typography.Text>
            {partiallyVisibleSelected ? <Tag color="blue">{T.selectAll}</Tag> : null}
          </div>

          <div className="leader-knowledge-list">
            {filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <Card key={entry.id} className="leader-knowledge-card" variant="borderless" size="small">
                  <div className="leader-knowledge-card__header">
                    <div className="leader-knowledge-card__leading">
                      <Checkbox
                        checked={selectedEntryIdSet.has(entry.id)}
                        aria-label={`${T.selectEntry} ${entry.fileName}`}
                        onChange={(event) => toggleEntrySelection(entry.id, event.target.checked)}
                      />
                      <div className="leader-knowledge-card__title">
                        <Typography.Link
                          className="leader-knowledge-card__file-link"
                          href={resolvePreviewUrl(entry)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {entry.fileName}
                        </Typography.Link>
                        <Space wrap size={[6, 6]} className="leader-knowledge-card__tags">
                          <Tag color="blue" className="leader-knowledge-card__tag">
                            {T.knowledgeTag}
                          </Tag>
                          <Tag icon={<FileTextOutlined />} className="leader-knowledge-card__tag">
                            {formatProofSize(entry.fileSize)}
                          </Tag>
                        </Space>
                      </div>
                    </div>
                    <Space wrap size={[4, 4]} className="leader-knowledge-card__actions">
                      <Button type="link" size="small" href={resolvePreviewUrl(entry)} target="_blank" rel="noreferrer">
                        {T.preview}
                      </Button>
                      <Button type="link" size="small" href={resolveDownloadUrl(entry)} target="_blank" rel="noreferrer">
                        {T.download}
                      </Button>
                      <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openEditor(entry)}>
                        {T.edit}
                      </Button>
                    </Space>
                  </div>

                  <div className="leader-knowledge-card__facts">
                    <div className="leader-knowledge-card__fact">
                      <Typography.Text type="secondary">{T.employee}</Typography.Text>
                      <Typography.Text strong>{entry.employeeName}</Typography.Text>
                      <Typography.Text type="secondary">
                        {`${entry.sectionName ?? T.unassignedSection} / ${entry.reviewGroupName ?? T.unassignedGroup}`}
                      </Typography.Text>
                    </div>
                    <div className="leader-knowledge-card__fact">
                      <Typography.Text type="secondary">{T.goal}</Typography.Text>
                      <Typography.Text strong>{`${entry.goalCode} ${entry.goalName}`}</Typography.Text>
                    </div>
                    <div className="leader-knowledge-card__fact">
                      <Typography.Text type="secondary">{T.keyResult}</Typography.Text>
                      <Typography.Text strong>{`${entry.keyResultCode} ${entry.keyResultName}`}</Typography.Text>
                    </div>
                    <div className="leader-knowledge-card__fact">
                      <Typography.Text type="secondary">{T.updatedAt}</Typography.Text>
                      <Typography.Text>{new Date(entry.updatedAt).toLocaleString()}</Typography.Text>
                      <Typography.Text type="secondary">
                        <ClockCircleOutlined style={{ marginRight: 6 }} />
                        {`${new Date(entry.uploadedAt).toLocaleString()} · ${formatProofSize(entry.fileSize)}`}
                      </Typography.Text>
                    </div>
                  </div>

                  <div className="leader-knowledge-card__note">
                    <Typography.Text type="secondary">{T.noteLabel}</Typography.Text>
                    <Typography.Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true, symbol: T.viewMore }}>
                      {entry.note?.trim() ? entry.note : T.noteEmpty}
                    </Typography.Paragraph>
                  </div>
                </Card>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={T.empty} />
            )}
          </div>
        </Space>
      </Card>

      <Modal
        open={Boolean(editingEntry)}
        title={T.updateTitle}
        okText={T.save}
        cancelText={T.cancel}
        okButtonProps={{ loading: updateMutation.isPending }}
        onOk={submitUpdate}
        onCancel={closeEditor}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message={T.updateHint} />
          <div>
            <Typography.Text strong>{T.currentFile}</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {editingEntry?.fileName}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Text strong>{T.noteLabel}</Typography.Text>
            <Input.TextArea
              rows={4}
              style={{ marginTop: 8 }}
              placeholder={T.notePlaceholder}
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
            />
          </div>
          <div>
            <Typography.Text strong>{T.fileLabel}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 8 }}>
              {T.fileHint}
            </Typography.Paragraph>
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              fileList={draftFiles}
              onChange={({ fileList }) => setDraftFiles(fileList.slice(-1))}
            >
              <Button icon={<UploadOutlined />}>{T.fileLabel}</Button>
            </Upload>
          </div>
        </Space>
      </Modal>
    </Space>
  );

  function openEditor(entry: LeaderKnowledgeEntry) {
    setEditingEntry(entry);
    setDraftNote(entry.note ?? '');
    setDraftFiles([]);
  }

  function closeEditor() {
    setEditingEntry(null);
    setDraftNote('');
    setDraftFiles([]);
  }

  function toggleEntrySelection(entryId: string, checked: boolean) {
    setSelectedEntryIds((current) => {
      if (checked) {
        return current.includes(entryId) ? current : [...current, entryId];
      }

      return current.filter((currentId) => currentId !== entryId);
    });
  }

  function toggleSelectVisibleEntries(checked: boolean) {
    setSelectedEntryIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredEntryIds]));
      }

      const visibleIdSet = new Set(filteredEntryIds);
      return current.filter((entryId) => !visibleIdSet.has(entryId));
    });
  }

  function submitUpdate() {
    if (!editingEntry) {
      return;
    }

    const payload = new FormData();
    payload.append('note', draftNote);
    const nextFile = draftFiles[0]?.originFileObj;
    if (nextFile instanceof File) {
      payload.append('file', nextFile);
    }

    updateMutation.mutate({
      proofId: editingEntry.id,
      payload
    });
  }

  async function handleBulkDownload() {
    if (!selectedEntryIds.length) {
      message.warning(T.bulkDownloadEmpty);
      return;
    }

    await downloadMutation.mutateAsync(selectedEntryIds);
  }

  function resolvePreviewUrl(entry: LeaderKnowledgeEntry) {
    return resolveApiUrl(entry.previewUrl ?? entry.fileUrl);
  }

  function resolveDownloadUrl(entry: LeaderKnowledgeEntry) {
    return resolveApiUrl(entry.downloadUrl ?? entry.fileUrl);
  }
}

function resolveDownloadFileName(contentDisposition: string | null | undefined, fallback: string) {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  return fallback;
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
