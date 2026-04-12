import { App as AntApp } from 'antd';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeCreateGoalDialog, SUBJECTIVE_CONFIRM_TEXT } from '../src/modules/employee/EmployeeCreateGoalDialog';

describe('EmployeeCreateGoalDialog', () => {
  it('defaults new key results to objective and confirms before switching to subjective', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <AntApp>
        <EmployeeCreateGoalDialog open onCancel={vi.fn()} onConfirm={vi.fn()} confirmLoading={false} />
      </AntApp>
    );

    expect(await screen.findAllByText('客观评分项')).toHaveLength(1);

    fireEvent.click(await screen.findByText('主观评分项'));

    expect(confirmSpy).toHaveBeenCalledWith(SUBJECTIVE_CONFIRM_TEXT);
    expect(screen.getAllByText('客观评分项')).toHaveLength(1);
  });
});
