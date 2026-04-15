import '@testing-library/jest-dom/vitest';
import { App as AntApp } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YearPickerPopover, YearQuarterPickerPopover } from '../src/shared/ui/PeriodPickerPopover';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

describe('PeriodPickerPopover', () => {
  it('switches year and quarter immediately after a quarter click', () => {
    const onChange = vi.fn();

    render(
      <AntApp>
        <YearQuarterPickerPopover
          year={2026}
          quarter={2}
          yearOptions={[
            { value: 2026, label: '2026年' },
            { value: 2027, label: '2027年' }
          ]}
          quarterOptions={[
            { value: 1, label: '一季度' },
            { value: 2, label: '二季度' },
            { value: 3, label: '三季度' },
            { value: 4, label: '四季度' }
          ]}
          onChange={onChange}
        />
      </AntApp>
    );

    fireEvent.click(screen.getByRole('button', { name: '2026年二季度' }));
    fireEvent.click(screen.getByRole('button', { name: '2027年' }));
    fireEvent.click(screen.getByRole('button', { name: '2027年一季度' }));

    expect(onChange).toHaveBeenCalledWith(2027, 1);
    expect(screen.queryByText('选择时间')).not.toBeInTheDocument();
  });

  it('switches year immediately after a year click', () => {
    const onChange = vi.fn();

    render(
      <AntApp>
        <YearPickerPopover
          year={2026}
          yearOptions={[
            { value: 2026, label: '2026年' },
            { value: 2027, label: '2027年' }
          ]}
          onChange={onChange}
        />
      </AntApp>
    );

    fireEvent.click(screen.getByRole('button', { name: '2026年' }));
    fireEvent.click(screen.getAllByRole('button', { name: '2027年' })[0]);

    expect(onChange).toHaveBeenCalledWith(2027);
    expect(screen.queryByText('选择年度')).not.toBeInTheDocument();
  });
});
