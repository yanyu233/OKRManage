import { DownloadOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  InputNumber,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportAdminHistoricalPerformanceExcel,
  getAdminHistoricalPerformance,
  importAdminHistoricalPerformanceExcel,
  saveAdminHistoricalPerformance
} from '../../shared/api/admin';
import { ApiError } from '../../shared/api/http';
import type {
  AdminHistoricalPerformanceEmployeeRecord,
  AdminHistoricalPerformanceResponse
} from '../../shared/types/admin-config';
import { YearPickerPopover } from '../../shared/ui/PeriodPickerPopover';
import { downloadAdminExcelFile, resolveAdminExcelFilename } from './admin-excel';

type EditableHistoricalPerformanceRecord = AdminHistoricalPerformanceEmployeeRecord;

const TEXT = {
  title: '历史绩效补录',
  description: '补录未上系统前的季度绩效分数，仅用于年度评分排名，不会生成或修改 OKR 数据。',
  tip: '同一季度如果已经存在系统内 OKR 得分，年度评分排名优先使用系统得分；这里只对没有系统 OKR 的季度生效。',
  loading: '正在加载历史绩效补录数据...',
  loadFailed: '历史绩效补录数据加载失败。',
  saveSuccess: '历史绩效补录已保存。',
  saveFailed: '历史绩效补录保存失败。',
  exportExcel: '导出 Excel',
  importExcel: '导入 Excel',
  importSuccess: '历史绩效补录 Excel 已导入。',
  importFailed: '历史绩效补录 Excel 导入失败。',
  exportFailed: '历史绩效补录 Excel 导出失败。',
  reload: '刷新',
  save: '保存补录',
  searchPlaceholder: '搜索员工姓名、工号、科室、组别',
  employeeCount: '员工数',
  editableQuarterCount: '可补录季度数',
  supplementedQuarterCount: '已补录季度数',
  annualPreview: '年度计入总分',
  employee: '员工',
  position: '岗位',
  org: '科室 / 小组',
  systemScore: '系统得分',
  manualScore: '补录得分',
  notSupplemented: '未补录',
  systemPriority: '系统优先',
  noGroup: '未分组',
  noSection: '未分配科室'
} as const;

export function AdminHistoricalPerformancePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => currentYear - 5 + index).map((year) => ({
        label: `${year}年`,
        value: year
      })),
    [currentYear]
  );

  const [year, setYear] = useState(currentYear);
  const [keyword, setKeyword] = useState('');
  const [draftRecords, setDraftRecords] = useState<EditableHistoricalPerformanceRecord[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20
  });

  const historicalQuery = useQuery({
    queryKey: ['admin-historical-performance', year],
    queryFn: () => getAdminHistoricalPerformance(year)
  });

  useEffect(() => {
    if (!historicalQuery.data || isDirty) {
      return;
    }

    setDraftRecords(cloneHistoricalPerformanceRecords(historicalQuery.data.records));
  }, [historicalQuery.data, isDirty]);

  const saveMutation = useMutation({
    mutationFn: (payload: AdminHistoricalPerformanceResponse) =>
      saveAdminHistoricalPerformance({
        year: payload.year,
        items: payload.records.flatMap((record) =>
          record.quarters.map((quarter) => ({
            userId: record.employeeId,
            quarter: quarter.quarter,
            score: quarter.manualScore
          }))
        )
      }),
    onSuccess: async (payload) => {
      const normalized = cloneHistoricalPerformanceRecords(payload.records);
      setDraftRecords(normalized);
      setIsDirty(false);
      queryClient.setQueryData(['admin-historical-performance', year], payload);
      await queryClient.invalidateQueries({ queryKey: ['admin-historical-performance', year] });
      message.success(TEXT.saveSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.saveFailed);
    }
  });

  const exportMutation = useMutation({
    mutationFn: () => exportAdminHistoricalPerformanceExcel(year),
    onSuccess: ({ blob, headers }) => {
      downloadAdminExcelFile(
        blob,
        resolveAdminExcelFilename(headers.get('content-disposition'), `历史绩效补录-${year}.xlsx`)
      );
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.exportFailed);
    }
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importAdminHistoricalPerformanceExcel(year, file),
    onSuccess: async (payload) => {
      const normalized = cloneHistoricalPerformanceRecords(payload.records);
      setDraftRecords(normalized);
      setIsDirty(false);
      setPagination((current) => ({
        ...current,
        current: 1
      }));
      queryClient.setQueryData(['admin-historical-performance', year], payload);
      await queryClient.invalidateQueries({ queryKey: ['admin-historical-performance', year] });
      message.success(TEXT.importSuccess);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : TEXT.importFailed);
    }
  });

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return draftRecords;
    }

    return draftRecords.filter((record) => {
      const candidate = [
        record.employeeName,
        record.employeeNo ?? '',
        record.positionName ?? '',
        record.sectionName ?? '',
        record.reviewGroupName ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return candidate.includes(normalizedKeyword);
    });
  }, [draftRecords, keyword]);

  useEffect(() => {
    setPagination((current) => {
      const totalPages = Math.max(1, Math.ceil(filteredRecords.length / current.pageSize));
      if (current.current <= totalPages) {
        return current;
      }

      return {
        ...current,
        current: totalPages
      };
    });
  }, [filteredRecords.length]);

  const summary = useMemo(() => {
    let editableQuarterCount = 0;
    let supplementedQuarterCount = 0;
    let annualPreview = 0;

    for (const record of filteredRecords) {
      annualPreview += calculateEffectiveAnnualScore(record);

      for (const quarter of record.quarters) {
        if (quarter.source === 'okr') {
          continue;
        }

        editableQuarterCount += 1;
        if (quarter.manualScore !== null) {
          supplementedQuarterCount += 1;
        }
      }
    }

    return {
      employeeCount: filteredRecords.length,
      editableQuarterCount,
      supplementedQuarterCount,
      annualPreview: Number(annualPreview.toFixed(1))
    };
  }, [filteredRecords]);

  const summaryItems = useMemo(
    () => [
      {
        key: 'employeeCount',
        label: TEXT.employeeCount,
        value: String(summary.employeeCount)
      },
      {
        key: 'editableQuarterCount',
        label: TEXT.editableQuarterCount,
        value: String(summary.editableQuarterCount)
      },
      {
        key: 'supplementedQuarterCount',
        label: TEXT.supplementedQuarterCount,
        value: String(summary.supplementedQuarterCount)
      },
      {
        key: 'annualPreview',
        label: TEXT.annualPreview,
        value: formatScore(summary.annualPreview)
      }
    ],
    [summary]
  );

  const columns = useMemo<ColumnsType<EditableHistoricalPerformanceRecord>>(
    () => [
      {
        title: TEXT.employee,
        key: 'employee',
        width: 180,
        fixed: 'left',
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{record.employeeName}</Typography.Text>
            <Typography.Text type="secondary">{record.employeeNo ?? '-'}</Typography.Text>
          </Space>
        )
      },
      {
        title: TEXT.position,
        dataIndex: 'positionName',
        key: 'positionName',
        width: 180,
        render: (value: string | null) => value || '-'
      },
      {
        title: TEXT.org,
        key: 'org',
        width: 180,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Typography.Text>{record.sectionName ?? TEXT.noSection}</Typography.Text>
            <Typography.Text type="secondary">{record.reviewGroupName ?? TEXT.noGroup}</Typography.Text>
          </Space>
        )
      },
      createQuarterColumn(1, handleQuarterScoreChange),
      createQuarterColumn(2, handleQuarterScoreChange),
      createQuarterColumn(3, handleQuarterScoreChange),
      createQuarterColumn(4, handleQuarterScoreChange),
      {
        title: TEXT.annualPreview,
        key: 'annualScore',
        width: 120,
        align: 'right',
        render: (_, record) => (
          <Typography.Text strong>{formatScore(calculateEffectiveAnnualScore(record))}</Typography.Text>
        )
      }
    ],
    []
  );

  if (historicalQuery.isLoading) {
    return (
      <Card className="admin-page" variant="borderless">
        {TEXT.loading}
      </Card>
    );
  }

  if (historicalQuery.isError) {
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
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {TEXT.description}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {TEXT.tip}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            loading={exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {TEXT.exportExcel}
          </Button>
          <Button
            icon={<UploadOutlined />}
            loading={importMutation.isPending}
            onClick={() => importInputRef.current?.click()}
          >
            {TEXT.importExcel}
          </Button>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={TEXT.searchPlaceholder}
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPagination((current) => ({
                ...current,
                current: 1
              }));
            }}
            style={{ width: 320 }}
          />
          <YearPickerPopover
            year={year}
            yearOptions={yearOptions}
            onChange={(nextYear) => {
              setYear(nextYear);
              setIsDirty(false);
              setKeyword('');
              setPagination((current) => ({
                ...current,
                current: 1
              }));
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => historicalQuery.refetch()}>
            {TEXT.reload}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            disabled={!isDirty}
            onClick={() =>
              historicalQuery.data &&
              saveMutation.mutate({
                year,
                records: draftRecords
              })
            }
          >
            {TEXT.save}
          </Button>
        </Space>
      </div>

      <Alert type="info" showIcon message={TEXT.tip} />

      <div className="historical-performance-summary">
        {summaryItems.map((item) => (
          <div key={item.key} className="historical-performance-summary__item">
            <Typography.Text className="historical-performance-summary__label">{item.label}</Typography.Text>
            <Typography.Text className="historical-performance-summary__value">{item.value}</Typography.Text>
          </div>
        ))}
      </div>

      <Card className="admin-page" variant="borderless">
        <Table
          rowKey="employeeId"
          size="middle"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (page, pageSize) => {
              setPagination({
                current: page,
                pageSize
              });
            }
          }}
          scroll={{ x: 1320 }}
          columns={columns}
          dataSource={filteredRecords}
        />
      </Card>

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            importMutation.mutate(file);
          }
          event.currentTarget.value = '';
        }}
      />
    </Space>
  );

  function handleQuarterScoreChange(employeeId: string, quarter: 1 | 2 | 3 | 4, score: number | null) {
    setDraftRecords((current) =>
      current.map((record) => {
        if (record.employeeId !== employeeId) {
          return record;
        }

        return {
          ...record,
          quarters: record.quarters.map((item) =>
            item.quarter === quarter
              ? {
                  ...item,
                  manualScore: score === null ? null : Number(score.toFixed(1)),
                  effectiveScore: item.source === 'okr' ? item.effectiveScore : Number((score ?? 0).toFixed(1)),
                  source: item.source === 'okr' ? 'okr' : score === null ? 'none' : 'manual'
                }
              : item
          )
        };
      })
    );
    setIsDirty(true);
  }
}

function createQuarterColumn(
  quarter: 1 | 2 | 3 | 4,
  onScoreChange: (employeeId: string, quarter: 1 | 2 | 3 | 4, score: number | null) => void
): ColumnsType<EditableHistoricalPerformanceRecord>[number] {
  return {
    title: `Q${quarter}`,
    key: `quarter-${quarter}`,
    width: 180,
    render: (_, record) => {
      const quarterRecord = record.quarters.find((item) => item.quarter === quarter);
      if (!quarterRecord) {
        return '-';
      }

      if (quarterRecord.source === 'okr') {
        return (
          <Space direction="vertical" size={4}>
            <Tag color="blue">{TEXT.systemPriority}</Tag>
            <Typography.Text strong>{`${TEXT.systemScore} ${formatScore(quarterRecord.systemScore)}`}</Typography.Text>
            {quarterRecord.manualScore !== null ? (
              <Typography.Text type="secondary">{`${TEXT.manualScore} ${formatScore(quarterRecord.manualScore)}`}</Typography.Text>
            ) : null}
          </Space>
        );
      }

      return (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <InputNumber
            min={0}
            max={100}
            step={0.1}
            style={{ width: '100%' }}
            value={quarterRecord.manualScore}
            placeholder={TEXT.manualScore}
            onChange={(value) => onScoreChange(record.employeeId, quarter, typeof value === 'number' ? value : null)}
          />
          <Typography.Text type="secondary">
            {quarterRecord.manualScore === null
              ? TEXT.notSupplemented
              : `${TEXT.manualScore} ${formatScore(quarterRecord.manualScore)}`}
          </Typography.Text>
        </Space>
      );
    }
  };
}

function calculateEffectiveAnnualScore(record: EditableHistoricalPerformanceRecord) {
  return Number(
    record.quarters
      .reduce((sum, item) => {
        if (item.source === 'okr') {
          return sum + (item.systemScore ?? 0);
        }

        return sum + (item.manualScore ?? 0);
      }, 0)
      .toFixed(1)
  );
}

function cloneHistoricalPerformanceRecords(records: AdminHistoricalPerformanceEmployeeRecord[]) {
  return records.map((record) => ({
    ...record,
    quarters: record.quarters.map((quarter) => ({ ...quarter }))
  }));
}

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return '-';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
