import { CheckOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { PeriodOption, QuarterValue } from '../../shared/ui/toolbar-options';

const QUARTER_META: Record<number, { shortLabel: string; title: string }> = {
  1: { shortLabel: '1', title: '一季度' },
  2: { shortLabel: '2', title: '二季度' },
  3: { shortLabel: '3', title: '三季度' },
  4: { shortLabel: '4', title: '四季度' }
};

const TEXT = {
  title: '选择时间',
  description: '点选季度后立即切换当前查看范围。',
  yearPanelTitle: '年度',
  quarterPanelTitle: '季度',
  selected: '已选'
} as const;

export function EmployeePeriodPickerDialog({
  year,
  quarter,
  yearOptions,
  quarterOptions,
  onSelect
}: {
  year: number;
  quarter: QuarterValue;
  yearOptions: PeriodOption[];
  quarterOptions: PeriodOption[];
  onSelect: (year: number, quarter: QuarterValue) => void;
}) {
  const [draftYear, setDraftYear] = useState(year);

  useEffect(() => {
    setDraftYear(year);
  }, [year]);

  const selectedQuarterTitle = useMemo(
    () => QUARTER_META[quarter]?.title ?? `${quarter}季度`,
    [quarter]
  );

  return (
    <div className="employee-period-panel">
      <div className="employee-period-panel__header">
        <div>
          <Typography.Text className="employee-period-panel__title">{TEXT.title}</Typography.Text>
          <Typography.Paragraph className="employee-period-panel__description">
            {TEXT.description}
          </Typography.Paragraph>
        </div>
        <div className="employee-period-panel__summary">
          <Typography.Text className="employee-period-panel__summary-label">{TEXT.selected}</Typography.Text>
          <Typography.Text className="employee-period-panel__summary-value">
            {draftYear}年{selectedQuarterTitle}
          </Typography.Text>
        </div>
      </div>

      <div className="employee-period-panel__body">
        <aside className="employee-period-panel__years">
          <Typography.Text className="employee-period-panel__section-title">{TEXT.yearPanelTitle}</Typography.Text>
          <div className="employee-period-panel__year-list">
            {yearOptions.map((option) => {
              const active = option.value === draftYear;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'employee-period-panel__year-item',
                    active ? 'employee-period-panel__year-item--active' : ''
                  ].join(' ')}
                  aria-label={`${option.value}年`}
                  onClick={() => setDraftYear(option.value)}
                >
                  <span>{option.value}年</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="employee-period-panel__quarters">
          <Typography.Text className="employee-period-panel__section-title">{TEXT.quarterPanelTitle}</Typography.Text>
          <div className="employee-period-panel__quarter-grid">
            {quarterOptions.map((option) => {
              const meta = QUARTER_META[option.value];
              const active = draftYear === year && option.value === quarter;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'employee-period-panel__quarter-card',
                    active ? 'employee-period-panel__quarter-card--active' : ''
                  ].join(' ')}
                  aria-label={`${draftYear}年${meta?.title ?? option.label}`}
                  onClick={() => onSelect(draftYear, option.value as QuarterValue)}
                >
                  <div className="employee-period-panel__quarter-badge">
                    {active ? <CheckOutlined /> : meta?.shortLabel ?? option.value}
                  </div>
                  <div className="employee-period-panel__quarter-text">
                    <Typography.Text className="employee-period-panel__quarter-title">
                      {meta?.title ?? option.label}
                    </Typography.Text>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
