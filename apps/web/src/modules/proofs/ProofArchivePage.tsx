import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileZipOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Input, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { defaultPathForRole } from '../layout/routing';
import { getProofArchiveManifest } from '../../shared/api/employee';
import { ApiError, resolveApiUrl } from '../../shared/api/http';
import { useSessionStore } from '../../shared/store/session-store';
import { formatProofSize } from '../employee/employee.helpers';
import './proof-preview.css';

const TEXT = {
  loading: '正在加载压缩包内容...',
  loadFailedTitle: '压缩包内容加载失败',
  loadFailedDescription: '暂时无法读取压缩包内容，请稍后重试。',
  back: '返回上一页',
  title: '压缩包内容预览',
  hint: '这里展示的是系统先解压后的子文件列表。点击预览时，会直接把解压后的真实文件交给预览服务。',
  originalDownload: '下载原压缩包',
  searchPlaceholder: '搜索文件名或目录路径',
  empty: '压缩包内没有可用文件',
  preview: '预览',
  download: '下载',
  pathLabel: '目录路径',
  entryCount: '文件数'
} as const;

export function ProofArchivePage() {
  const navigate = useNavigate();
  const { proofId = '' } = useParams();
  const [keyword, setKeyword] = useState('');
  const user = useSessionStore((state) => state.user);

  const manifestQuery = useQuery({
    queryKey: ['proof-archive', proofId],
    queryFn: () => getProofArchiveManifest(proofId),
    enabled: Boolean(proofId)
  });

  const manifest = manifestQuery.data;
  const filteredEntries = useMemo(() => {
    if (!manifest) {
      return [];
    }

    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return manifest.entries;
    }

    return manifest.entries.filter((entry) =>
      [entry.name, entry.path, entry.extension ?? ''].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [keyword, manifest]);

  function handleBack() {
    const fallbackPath = defaultPathForRole(user?.activeRole ?? user?.role ?? 'employee');

    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      if (referrer) {
        try {
          const currentUrl = new URL(window.location.href);
          const referrerUrl = new URL(referrer);
          if (referrerUrl.origin === currentUrl.origin && referrerUrl.href !== currentUrl.href) {
            window.location.assign(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`);
            return;
          }
        } catch {
          // Ignore malformed referrers and continue to the next fallback.
        }
      }

      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
    }

    navigate(fallbackPath, { replace: true });
  }

  if (manifestQuery.isLoading) {
    return <Card className="proof-archive-card">{TEXT.loading}</Card>;
  }

  if (manifestQuery.isError || !manifest) {
    const description = manifestQuery.error instanceof ApiError ? manifestQuery.error.message : TEXT.loadFailedDescription;

    return (
      <Card className="proof-archive-card">
        <Alert type="error" showIcon message={TEXT.loadFailedTitle} description={description} />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={20} className="proof-archive-page">
      <Card className="proof-archive-card" variant="borderless">
        <div className="proof-archive-hero">
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }} onClick={handleBack}>
              {TEXT.back}
            </Button>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              <FileZipOutlined style={{ marginRight: 10 }} />
              {manifest.fileName}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {`${TEXT.title} · ${TEXT.entryCount} ${manifest.entryCount}`}
            </Typography.Paragraph>
          </div>
          <Button
            icon={<DownloadOutlined />}
            href={resolveApiUrl(manifest.downloadUrl)}
            target="_blank"
            rel="noreferrer"
          >
            {TEXT.originalDownload}
          </Button>
        </div>

        <Alert type="info" showIcon style={{ marginTop: 16 }} message={TEXT.hint} />

        <Input
          allowClear
          style={{ marginTop: 16 }}
          prefix={<SearchOutlined />}
          placeholder={TEXT.searchPlaceholder}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Card>

      <Card className="proof-archive-card" variant="borderless">
        <div className="proof-archive-list">
          {filteredEntries.length ? (
            filteredEntries.map((entry) => (
              <Card key={entry.path} size="small" className="proof-archive-entry">
                <div className="proof-archive-entry__row">
                  <div className="proof-archive-entry__meta">
                    <Typography.Title level={5} style={{ marginBottom: 6 }}>
                      <Typography.Link href={resolveApiUrl(entry.previewUrl)} target="_blank" rel="noreferrer">
                        {entry.name}
                      </Typography.Link>
                    </Typography.Title>
                    <Typography.Text type="secondary">{TEXT.pathLabel}</Typography.Text>
                    <Typography.Text code className="proof-archive-entry__path">
                      {entry.path}
                    </Typography.Text>
                    <Space wrap size={[8, 8]} style={{ marginTop: 10 }}>
                      {entry.extension ? <Tag color="blue">{entry.extension.toUpperCase()}</Tag> : null}
                      {entry.fileSize !== null ? <Tag>{formatProofSize(entry.fileSize)}</Tag> : null}
                    </Space>
                  </div>
                  <Space wrap size={[8, 8]} className="proof-archive-entry__actions">
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      href={resolveApiUrl(entry.previewUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {TEXT.preview}
                    </Button>
                    <Button
                      icon={<DownloadOutlined />}
                      href={resolveApiUrl(entry.downloadUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {TEXT.download}
                    </Button>
                  </Space>
                </div>
              </Card>
            ))
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={TEXT.empty} />
          )}
        </div>
      </Card>
    </Space>
  );
}
