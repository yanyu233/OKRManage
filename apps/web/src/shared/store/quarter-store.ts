import { useMemo } from 'react';
import { create } from 'zustand';
import {
  buildQuarterOptions,
  buildQuarterPickerYearOptions,
  getBusinessDefaultQuarterPeriod,
  getCurrentQuarterPeriod,
  type PeriodOption,
  type QuarterPeriod,
  type QuarterValue
} from '../ui/toolbar-options';

export type SharedQuarterSource = 'default' | 'manual';

export type SharedQuarterSelection = QuarterPeriod & {
  source: SharedQuarterSource;
};

type SharedQuarterStore = {
  selection: SharedQuarterSelection;
  setManualSelection: (year: number, quarter: QuarterValue) => void;
  resetSelection: (date?: Date) => void;
};

function createDefaultSelection(date = new Date()): SharedQuarterSelection {
  return {
    ...getBusinessDefaultQuarterPeriod(date),
    source: 'default'
  };
}

export const useSharedQuarterStore = create<SharedQuarterStore>((set) => ({
  selection: createDefaultSelection(),
  setManualSelection: (year, quarter) =>
    set({
      selection: {
        year,
        quarter,
        source: 'manual'
      }
    }),
  resetSelection: (date = new Date()) =>
    set({
      selection: createDefaultSelection(date)
    })
}));

export function resetSharedQuarterSelection(date = new Date()) {
  useSharedQuarterStore.getState().resetSelection(date);
}

export function useSharedQuarterPeriod(options: {
  startYear: number;
  futureRange: number;
}): {
  year: number;
  quarter: QuarterValue;
  source: SharedQuarterSource;
  yearOptions: PeriodOption[];
  quarterOptions: PeriodOption[];
  setPeriod: (year: number, quarter: QuarterValue) => void;
} {
  const selection = useSharedQuarterStore((state) => state.selection);
  const setManualSelection = useSharedQuarterStore((state) => state.setManualSelection);
  const naturalCurrentPeriod = useMemo(() => getCurrentQuarterPeriod(), []);

  const yearOptions = useMemo(
    () =>
      buildQuarterPickerYearOptions(
        Math.max(options.startYear, naturalCurrentPeriod.year),
        options.futureRange,
        selection.year
      ),
    [naturalCurrentPeriod.year, options.futureRange, options.startYear, selection.year]
  );

  const quarterOptions = useMemo(() => buildQuarterOptions(), []);

  return {
    year: selection.year,
    quarter: selection.quarter,
    source: selection.source,
    yearOptions,
    quarterOptions,
    setPeriod: setManualSelection
  };
}
