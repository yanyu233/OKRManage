import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeTemplateImportDialog } from '../src/modules/employee/EmployeeTemplateImportDialog';

describe('EmployeeTemplateImportDialog', () => {
  it('renders available templates and marks imported entries', () => {
    render(
      <EmployeeTemplateImportDialog
        open
        loading={false}
        confirmLoading={false}
        departmentName="\u5e73\u53f0\u4ea7\u54c1\u79d1"
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
            keyResults: []
          }
        ]}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: '\u5bfc\u5165\u6a21\u677f\u76ee\u6807' })).toBeTruthy();
    expect(screen.getByText('\u5df2\u5bfc\u5165')).toBeTruthy();
    expect(screen.getByText('\u5e73\u53f0\u79d1\u65b0\u5458\u5de5\u6a21\u677f')).toBeTruthy();
  });
});
