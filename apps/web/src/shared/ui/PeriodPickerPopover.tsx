import { CalendarOutlined, CheckOutlined } from '@ant-design/icons';
import { Button, Popover, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { formatQuarterLabel } from '../i18n/labels';
import type { PeriodOption, QuarterValue } from './toolbar-options';
import './period-picker.css';

const QUARTER_META: Record<number, { shortLabel: string; title: string }> = {
  1: { shortLabel: '1', title: '一季度' },
  2: { shortLabel: '2', title: '二季度' },
  3: { shortLabel: '3', title: '三季度' },
  4: { shortLabel: '4', title: '四季度' }
};

const TEXT = {
  periodTitle: '选择时间',
  periodDescription: '点选季度后立即切换当前查看范围。',
  yearTitle: '选择年度',
  yearDescription: '点选年份后立即切换当前查看范围。',
  yearSectionTitle: '年度',
  quarterSectionTitle: '季度',
  selected: '已选'
} as const;

export function YearQuarterPickerPopover({
  year,
  quarter,
  yearOptions,
  quarterOptions,
  onChange
}: {
  year: number;
  quarter: QuarterValue;
  yearOptions: PeriodOption[];
  quarterOptions: PeriodOption[];
  onChange: (year: number, quarter: QuarterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(year);

  useEffect(() => {
    setDraftYear(year);
  }, [year]);

  const selectedQuarterTitle = useMemo(
    () => QUARTER_META[quarter]?.title ?? `${quarter}季度`,
    [quarter]
  );

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      destroyOnHidden
      overlayClassName="period-picker-popover"
      onOpenChange={setOpen}
      content={
        <div className="period-picker-panel">
          <div className="period-picker-panel__header">
            <div>
              <Typography.Text className="period-picker-panel__title">{TEXT.periodTitle}</Typography.Text>
              <Typography.Paragraph className="period-picker-panel__description">
                {TEXT.periodDescription}
              </Typography.Paragraph>
            </div>
            <div className="period-picker-panel__summary">
              <Typography.Text className="period-picker-panel__summary-label">{TEXT.selected}</Typography.Text>
              <Typography.Text className="period-picker-panel__summary-value">
                {draftYear}年{selectedQuarterTitle}
              </Typography.Text>
            </div>
          </div>

          <div className="period-picker-panel__body">
            <aside className="period-picker-panel__years">
              <Typography.Text className="period-picker-panel__section-title">{TEXT.yearSectionTitle}</Typography.Text>
              <div className="period-picker-panel__year-list">
                {yearOptions.map((option) => {
                  const active = option.value === draftYear;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        'period-picker-panel__year-item',
                        active ? 'period-picker-panel__year-item--active' : ''
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

            <section className="period-picker-panel__quarters">
              <Typography.Text className="period-picker-panel__section-title">{TEXT.quarterSectionTitle}</Typography.Text>
              <div className="period-picker-panel__quarter-grid">
                {quarterOptions.map((option) => {
                  const meta = QUARTER_META[option.value];
                  const active = draftYear === year && option.value === quarter;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={[
                        'period-picker-panel__quarter-card',
                        active ? 'period-picker-panel__quarter-card--active' : ''
                      ].join(' ')}
                      aria-label={`${draftYear}年${meta?.title ?? option.label}`}
                      onClick={() => {
                        onChange(draftYear, option.value as QuarterValue);
                        setOpen(false);
                      }}
                    >
                      <div className="period-picker-panel__quarter-badge">
                        {active ? <CheckOutlined /> : meta?.shortLabel ?? option.value}
                      </div>
                      <div className="period-picker-panel__quarter-text">
                        <Typography.Text className="period-picker-panel__quarter-title">
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
      }
    >
      <Button aria-label={formatQuarterLabel(year, quarter)} icon={<CalendarOutlined />} className="period-picker-trigger">
        {formatQuarterLabel(year, quarter)}
      </Button>
    </Popover>
  );
}

export function YearPickerPopover({
  year,
  yearOptions,
  onChange
}: {
  year: number;
  yearOptions: PeriodOption[];
  onChange: (year: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      destroyOnHidden
      overlayClassName="period-picker-popover"
      onOpenChange={setOpen}
      content={
        <div className="period-picker-panel period-picker-panel--year-only">
          <div className="period-picker-panel__header">
            <div>
              <Typography.Text className="period-picker-panel__title">{TEXT.yearTitle}</Typography.Text>
              <Typography.Paragraph className="period-picker-panel__description">
                {TEXT.yearDescription}
              </Typography.Paragraph>
            </div>
            <div className="period-picker-panel__summary">
              <Typography.Text className="period-picker-panel__summary-label">{TEXT.selected}</Typography.Text>
              <Typography.Text className="period-picker-panel__summary-value">{year}年</Typography.Text>
            </div>
          </div>

          <section className="period-picker-panel__years period-picker-panel__years--standalone">
            <Typography.Text className="period-picker-panel__section-title">{TEXT.yearSectionTitle}</Typography.Text>
            <div className="period-picker-panel__year-list">
              {yearOptions.map((option) => {
                const active = option.value === year;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={[
                      'period-picker-panel__year-item',
                      active ? 'period-picker-panel__year-item--active' : ''
                    ].join(' ')}
                    aria-label={`${option.value}年`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span>{option.value}年</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      }
    >
      <Button aria-label={`${year}年`} icon={<CalendarOutlined />} className="period-picker-trigger">
        {year}年
      </Button>
    </Popover>
  );
}
