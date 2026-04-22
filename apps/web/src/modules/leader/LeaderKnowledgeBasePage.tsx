import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Empty, Input, Modal, Space, Tag, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, resolveApiUrl, resolveAppAwareUrl } from '../../shared/api/http';
import {
  deleteLeaderManualKnowledgeAsset,
  downloadLeaderKnowledgeBase,
  getLeaderKnowledgeBase,
  updateLeaderProofKnowledge,
  updateLeaderKnowledgeProof,
  updateLeaderManualKnowledgeAsset,
  uploadLeaderManualKnowledgeAsset
} from '../../shared/api/leader';
import { useSessionStore } from '../../shared/store/session-store';
import type { LeaderKnowledgeEntry } from '../../shared/types/leader';
import { formatProofSize } from '../employee/employee.helpers';
import './leader.css';

const { Dragger } = Upload;

const T = {
  title: '知识库',
  desc: '集中展示知识材料。已标记的 OKR 证明材料和自由上传的知识文件会一起在这里管理。',
  loading: '正在加载知识库...',
  loadFailed: '知识库加载失败。',
  refresh: '刷新',
  upload: '上传知识文件',
  search: '搜索文件名、说明、上传人、员工、目标或关键结果',
  empty: '当前还没有收录到知识库的文件。',
  preview: '预览',
  download: '下载',
  bulkDownload: '批量下载',
  selectAll: '全选',
  clearSelection: '取消全选',
  bulkDownloadEmpty: '请先选择要下载的知识文件。',
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
  uploader: '上传人',
  source: '来源',
  updatedAt: '最近更新',
  updateTitle: '更新知识资料',
  updateHint: '可只更新说明，也可以替换为新的文件。',
  uploadTitle: '上传知识文件',
  uploadHint: '仅科室负责人和小组负责人可自由上传，不关联目标和关键结果。',
  noteLabel: '说明',
  notePlaceholder: '补充这份知识文件的用途、背景或使用方式',
  fileLabel: '文件',
  fileHint: '不上传新文件时，会保留当前文件。',
  currentFile: '当前文件',
  save: '保存更新',
  create: '确认上传',
  cancel: '取消',
  updateSuccess: '知识资料已更新。',
  updateFailed: '知识资料更新失败。',
  uploadSuccess: '知识文件已上传。',
  uploadFailed: '知识文件上传失败。',
  uploadRequired: '请先选择要上传的文件。',
  knowledgeTag: '知识材料',
  okrSourceTag: 'OKR材料',
  manualSourceTag: '自由上传',
  uploadSourceLabel: '自由上传文件',
  viewMore: '展开',
  unassignedSection: '未分配科室',
  unassignedGroup: '未分配小组'
  , remove: '删除',
  removeTitle: '确认从知识库移除',
  removeImportedHint: '删除后不会移除原始证明材料，只会取消“标记为知识”并从知识库列表中移除。',
  removeManualHint: '删除后会移除这份自由上传的知识文件，且无法恢复。',
  removeSuccess: '已从知识库移除',
  removeFailed: '从知识库移除失败'
} as const;

export function LeaderKnowledgeBasePage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const isKnowledgeEditor = useSessionStore((state) =>
    (state.user?.roles ?? []).some((assignment) => assignment.role === 'section-leader' || assignment.role === 'group-leader')
  );
  const [keyword, setKeyword] = useState('');
  const [editingEntry, setEditingEntry] = useState<LeaderKnowledgeEntry | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editFiles, setEditFiles] = useState<UploadFile[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [selectedEntryKeys, setSelectedEntryKeys] = useState<string[]>([]);

  const knowledgeQuery = useQuery({
    queryKey: ['leader-knowledge-base'],
    queryFn: () => getLeaderKnowledgeBase()
  });

  const updateMutation = useMutation({
    mutationFn: ({ entry, payload }: { entry: LeaderKnowledgeEntry; payload: FormData }) =>
      entry.entryType === 'manual'
        ? updateLeaderManualKnowledgeAsset(entry.id, payload)
        : updateLeaderKnowledgeProof(entry.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-knowledge-base'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      message.success(T.updateSuccess);
      closeEditor();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.updateFailed)
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: FormData) => uploadLeaderManualKnowledgeAsset(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leader-knowledge-base'] });
      message.success(T.uploadSuccess);
      closeUploader();
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.uploadFailed)
  });

  const removeMutation = useMutation({
    mutationFn: async (entry: LeaderKnowledgeEntry) => {
      if (entry.entryType === 'manual') {
        await deleteLeaderManualKnowledgeAsset(entry.id);
        return;
      }

      await updateLeaderProofKnowledge(entry.id, { isKnowledge: false });
    },
    onSuccess: async (_data, entry) => {
      await queryClient.invalidateQueries({ queryKey: ['leader-knowledge-base'] });
      await queryClient.invalidateQueries({ queryKey: ['leader-workbench'] });
      if (editingEntry?.entryKey === entry.entryKey) {
        closeEditor();
      }
      message.success(T.removeSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.removeFailed)
  });

  const downloadMutation = useMutation({
    mutationFn: (entryKeys: string[]) => downloadLeaderKnowledgeBase(entryKeys),
    onSuccess: ({ blob, headers }) => {
      downloadBlobFile(blob, resolveDownloadFileName(headers.get('content-disposition'), 'knowledge-base.zip'));
      message.success(T.bulkDownloadSuccess);
    },
    onError: (error) => message.error(error instanceof ApiError ? error.message : T.bulkDownloadFailed)
  });

  const entries = knowledgeQuery.data?.entries ?? [];

  useEffect(() => {
    const availableKeys = new Set(entries.map((entry) => entry.entryKey));
    setSelectedEntryKeys((current) => current.filter((entryKey) => availableKeys.has(entryKey)));
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
        entry.uploaderName ?? '',
        entry.employeeName ?? '',
        entry.sectionName ?? '',
        entry.reviewGroupName ?? '',
        entry.goalCode ?? '',
        entry.goalName ?? '',
        entry.keyResultCode ?? '',
        entry.keyResultName ?? '',
        entry.entryType === 'manual' ? T.manualSourceTag : T.okrSourceTag
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [entries, keyword]);

  const selectedEntryKeySet = useMemo(() => new Set(selectedEntryKeys), [selectedEntryKeys]);
  const filteredEntryKeys = useMemo(() => filteredEntries.map((entry) => entry.entryKey), [filteredEntries]);
  const selectedVisibleCount = useMemo(
    () => filteredEntryKeys.filter((entryKey) => selectedEntryKeySet.has(entryKey)).length,
    [filteredEntryKeys, selectedEntryKeySet]
  );
  const allVisibleSelected = filteredEntryKeys.length > 0 && selectedVisibleCount === filteredEntryKeys.length;

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
            <Button onClick={() => toggleSelectVisibleEntries(!allVisibleSelected)} disabled={!filteredEntryKeys.length}>
              {allVisibleSelected ? T.clearSelection : T.selectAll}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              disabled={!selectedEntryKeys.length}
              loading={downloadMutation.isPending}
              onClick={() => void handleBulkDownload()}
            >
              {T.bulkDownload}
            </Button>
            {isKnowledgeEditor ? (
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={openUploader}>
                {T.upload}
              </Button>
            ) : null}
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
              {`${T.selectedCount} ${selectedEntryKeys.length} ${T.selectedUnit}`}
            </Typography.Text>
          </div>

          <div className="leader-knowledge-list">
            {filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <Card key={entry.entryKey} className="leader-knowledge-card" variant="borderless" size="small">
                  <div className="leader-knowledge-card__header">
                    <div className="leader-knowledge-card__leading">
                      <Checkbox
                        checked={selectedEntryKeySet.has(entry.entryKey)}
                        aria-label={`${T.selectEntry} ${entry.fileName}`}
                        onChange={(event) => toggleEntrySelection(entry.entryKey, event.target.checked)}
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
                          <Tag color="blue" className="leader-knowledge-card__tag leader-knowledge-card__tag--label">
                            {T.knowledgeTag}
                          </Tag>
                          <Tag className="leader-knowledge-card__tag leader-knowledge-card__tag--label">
                            {entry.entryType === 'manual' ? T.manualSourceTag : T.okrSourceTag}
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
                      {entry.canManageKnowledge ? (
                        <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openEditor(entry)}>
                          {T.edit}
                        </Button>
                      ) : null}
                      {entry.canManageKnowledge ? (
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={removeMutation.isPending && removeMutation.variables?.entryKey === entry.entryKey}
                          onClick={() => confirmRemove(entry)}
                        >
                          {T.remove}
                        </Button>
                      ) : null}
                    </Space>
                  </div>

                  <div className="leader-knowledge-card__facts">
                    {entry.entryType === 'manual' ? (
                      <>
                        <KnowledgeFact label={T.uploader} primary={entry.uploaderName ?? '-'} />
                        <KnowledgeFact label={T.source} primary={T.uploadSourceLabel} />
                        <KnowledgeFact
                          label={T.updatedAt}
                          primary={new Date(entry.updatedAt).toLocaleString()}
                          secondary={
                            <>
                              <ClockCircleOutlined style={{ marginRight: 6 }} />
                              {new Date(entry.uploadedAt).toLocaleString()}
                            </>
                          }
                        />
                        <KnowledgeFact label={T.fileLabel} primary={formatProofSize(entry.fileSize)} />
                      </>
                    ) : (
                      <>
                        <KnowledgeFact
                          label={T.employee}
                          primary={entry.employeeName ?? '-'}
                          secondary={`${entry.sectionName ?? T.unassignedSection} / ${entry.reviewGroupName ?? T.unassignedGroup}`}
                        />
                        <KnowledgeFact
                          label={T.goal}
                          primary={formatCodeName(entry.goalCode, entry.goalName)}
                        />
                        <KnowledgeFact
                          label={T.keyResult}
                          primary={formatCodeName(entry.keyResultCode, entry.keyResultName)}
                        />
                        <KnowledgeFact
                          label={T.updatedAt}
                          primary={new Date(entry.updatedAt).toLocaleString()}
                          secondary={
                            <>
                              <ClockCircleOutlined style={{ marginRight: 6 }} />
                              {new Date(entry.uploadedAt).toLocaleString()}
                            </>
                          }
                        />
                      </>
                    )}
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
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
            />
          </div>
          <div>
            <Typography.Text strong>{T.fileLabel}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 8 }}>
              {T.fileHint}
            </Typography.Paragraph>
            <Dragger
              beforeUpload={() => false}
              maxCount={1}
              fileList={editFiles}
              onChange={({ fileList }) => setEditFiles(fileList.slice(-1))}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">{T.fileLabel}</p>
            </Dragger>
          </div>
        </Space>
      </Modal>

      <Modal
        open={uploadOpen}
        title={T.uploadTitle}
        okText={T.create}
        cancelText={T.cancel}
        okButtonProps={{ loading: uploadMutation.isPending }}
        onOk={submitUpload}
        onCancel={closeUploader}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert type="info" showIcon message={T.uploadHint} />
          <div>
            <Typography.Text strong>{T.noteLabel}</Typography.Text>
            <Input.TextArea
              rows={4}
              style={{ marginTop: 8 }}
              placeholder={T.notePlaceholder}
              value={uploadNote}
              onChange={(event) => setUploadNote(event.target.value)}
            />
          </div>
          <div>
            <Typography.Text strong>{T.fileLabel}</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Dragger
                beforeUpload={() => false}
                maxCount={1}
                fileList={uploadFiles}
                onChange={({ fileList }) => setUploadFiles(fileList.slice(-1))}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">{T.upload}</p>
              </Dragger>
            </div>
          </div>
        </Space>
      </Modal>
    </Space>
  );

  function openEditor(entry: LeaderKnowledgeEntry) {
    if (!entry.canManageKnowledge) {
      return;
    }

    setEditingEntry(entry);
    setEditNote(entry.note ?? '');
    setEditFiles([]);
  }

  function closeEditor() {
    setEditingEntry(null);
    setEditNote('');
    setEditFiles([]);
  }

  function openUploader() {
    if (!isKnowledgeEditor) {
      return;
    }

    setUploadOpen(true);
    setUploadNote('');
    setUploadFiles([]);
  }

  function closeUploader() {
    setUploadOpen(false);
    setUploadNote('');
    setUploadFiles([]);
  }

  function toggleEntrySelection(entryKey: string, checked: boolean) {
    setSelectedEntryKeys((current) => {
      if (checked) {
        return current.includes(entryKey) ? current : [...current, entryKey];
      }

      return current.filter((currentKey) => currentKey !== entryKey);
    });
  }

  function toggleSelectVisibleEntries(checked: boolean) {
    setSelectedEntryKeys((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredEntryKeys]));
      }

      const visibleKeySet = new Set(filteredEntryKeys);
      return current.filter((entryKey) => !visibleKeySet.has(entryKey));
    });
  }

  function submitUpdate() {
    if (!editingEntry) {
      return;
    }

    const payload = new FormData();
    payload.append('note', editNote);
    const nextFile = editFiles[0]?.originFileObj;
    if (nextFile instanceof File) {
      payload.append('file', nextFile);
    }

    updateMutation.mutate({
      entry: editingEntry,
      payload
    });
  }

  function submitUpload() {
    const nextFile = uploadFiles[0]?.originFileObj;
    if (!(nextFile instanceof File)) {
      message.warning(T.uploadRequired);
      return;
    }

    const payload = new FormData();
    payload.append('note', uploadNote);
    payload.append('file', nextFile);
    uploadMutation.mutate(payload);
  }

  async function handleBulkDownload() {
    if (!selectedEntryKeys.length) {
      message.warning(T.bulkDownloadEmpty);
      return;
    }

    await downloadMutation.mutateAsync(selectedEntryKeys);
  }

  function resolvePreviewUrl(entry: LeaderKnowledgeEntry) {
    return resolveAppAwareUrl(entry.previewUrl ?? entry.fileUrl);
  }

  function resolveDownloadUrl(entry: LeaderKnowledgeEntry) {
    return resolveApiUrl(entry.downloadUrl ?? entry.fileUrl);
  }

  function confirmRemove(entry: LeaderKnowledgeEntry) {
    void modal.confirm({
      title: T.removeTitle,
      content: entry.entryType === 'manual' ? T.removeManualHint : T.removeImportedHint,
      okText: T.remove,
      cancelText: T.cancel,
      okButtonProps: {
        danger: true
      },
      onOk: async () => {
        await removeMutation.mutateAsync(entry);
      }
    });
  }
}

type KnowledgeFactProps = {
  label: string;
  primary: string;
  secondary?: ReactNode;
};

function KnowledgeFact({ label, primary, secondary }: KnowledgeFactProps) {
  return (
    <div className="leader-knowledge-card__fact">
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text strong>{primary}</Typography.Text>
      {secondary ? <Typography.Text type="secondary">{secondary}</Typography.Text> : null}
    </div>
  );
}

function formatCodeName(code: string | null, name: string | null) {
  const normalized = [code, name].filter(Boolean).join(' ');
  return normalized || '-';
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
