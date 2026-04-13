import { describe, expect, it } from 'vitest';
import { resolveAdminExcelFilename } from '../src/modules/admin/admin-excel';

describe('admin excel helpers', () => {
  it('falls back to default filename when header is missing', () => {
    expect(resolveAdminExcelFilename(undefined)).toBe('系统配置.xlsx');
  });

  it('extracts utf8 filename from content-disposition', () => {
    expect(resolveAdminExcelFilename("attachment; filename*=UTF-8''%E7%B3%BB%E7%BB%9F%E9%85%8D%E7%BD%AE.xlsx")).toBe(
      '系统配置.xlsx'
    );
  });
});
