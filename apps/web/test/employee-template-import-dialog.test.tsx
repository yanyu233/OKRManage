import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeTemplateImportDialog } from '../src/modules/employee/EmployeeTemplateImportDialog';

describe('EmployeeTemplateImportDialog', () => {
  it('renders key result preview content and marks imported entries', () => {
    render(
      <EmployeeTemplateImportDialog
        open
        loading={false}
        confirmLoading={false}
        departmentName="\u5e73\u53f0\u4ea7\u54c1\u79d1"
        allocatedPoints={20}
        maxQuarterPoints={100}
        templates={[
          {
            id: 'tpl-1',
            departmentId: 'dept-1',
            departmentName: '\u5de5\u4e1a\u4e92\u8054\u7f51\u4e2d\u5fc3',
            name: '\u5e73\u53f0\u79d1\u65b0\u5458\u5de5\u6a21\u677f',
            description: '\u901a\u7528\u6a21\u677f',
            isActive: true,
            totalPoints: 50,
            keyResultCount: 2,
            alreadyImported: true,
            keyResults: [
              {
                id: 'kr-1',
                code: 'KR1',
                name: 'Complete rollout',
                description: 'Finalize online release and verification.',
                points: 25,
                scoreType: 'objective'
              }
            ]
          }
        ]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: '\u5bfc\u5165\u6a21\u677f\u76ee\u6807' })).toBeTruthy();
    expect(screen.getByText('\u5df2\u5bfc\u5165')).toBeTruthy();
    expect(screen.getByText('\u5e73\u53f0\u79d1\u65b0\u5458\u5de5\u6a21\u677f')).toBeTruthy();
    expect(screen.getByText('KR1 Complete rollout')).toBeTruthy();
    expect(screen.getByText('Finalize online release and verification.')).toBeTruthy();
  });

  it('disables import confirmation when selected template would push quarter points over 100', () => {
    render(
      <EmployeeTemplateImportDialog
        open
        loading={false}
        confirmLoading={false}
        departmentName="AI"
        allocatedPoints={80}
        maxQuarterPoints={100}
        templates={[
          {
            id: 'tpl-1',
            departmentId: 'dept-1',
            departmentName: 'AI',
            name: 'Template A',
            description: 'Template description',
            isActive: true,
            totalPoints: 30,
            keyResultCount: 1,
            alreadyImported: false,
            keyResults: [
              {
                id: 'kr-1',
                code: 'KR1',
                name: 'Finish work',
                description: null,
                points: 30,
                scoreType: 'objective'
              }
            ]
          }
        ]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByText('\u5f53\u524d\u5b63\u5ea6\u6240\u6709\u76ee\u6807\u7684\u5173\u952e\u7ed3\u679c\u5206\u503c\u5408\u8ba1\u4e0d\u80fd\u8d85\u8fc7 100 \u5206\u3002')).toBeTruthy();
    expect(screen.getByRole('button', { name: '\u5bfc\u5165\u9009\u4e2d\u6a21\u677f' })).toBeDisabled();
  });
});
