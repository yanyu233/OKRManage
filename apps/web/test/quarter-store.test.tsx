import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSharedQuarterSelection, useSharedQuarterPeriod } from '../src/shared/store/quarter-store';

describe('shared quarter store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T09:00:00'));
    resetSharedQuarterSelection(new Date('2026-04-14T09:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to the previous quarter during the opening month', () => {
    render(<QuarterProbe label="A" />);

    expect(screen.getByText('A:2026-Q1')).toBeInTheDocument();
  });

  it('shares a manual quarter selection across page mounts in the same session', () => {
    const firstRender = render(<QuarterProbe label="A" />);

    fireEvent.click(screen.getByRole('button', { name: 'switch-quarter' }));
    expect(screen.getByText('A:2026-Q3')).toBeInTheDocument();

    firstRender.unmount();
    render(<QuarterProbe label="B" />);

    expect(screen.getByText('B:2026-Q3')).toBeInTheDocument();
  });
});

function QuarterProbe({ label }: { label: string }) {
  const { year, quarter, setPeriod } = useSharedQuarterPeriod({
    startYear: 2026,
    futureRange: 8
  });

  return (
    <div>
      <span>{`${label}:${year}-Q${quarter}`}</span>
      <button type="button" onClick={() => setPeriod(2026, 3)} aria-label="switch-quarter">
        switch
      </button>
    </div>
  );
}
