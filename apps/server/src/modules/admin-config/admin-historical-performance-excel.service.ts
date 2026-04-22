import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { AuthUser } from '../../shared/types/auth-user';
import { AdminConfigService } from './admin-config.service';

const SHEETS = {
  guide: '说明',
  records: '历史绩效补录'
} as const;

@Injectable()
export class AdminHistoricalPerformanceExcelService {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  async exportWorkbook(year: number): Promise<Buffer> {
    const payload = await this.adminConfigService.getHistoricalPerformance(year);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OKR Route C';
    workbook.created = new Date();

    this.addGuideSheet(workbook, year);
    this.addRecordsSheet(workbook, payload);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  async importWorkbook(buffer: Buffer, year: number, actor: AuthUser) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const current = await this.adminConfigService.getHistoricalPerformance(year);
    const rows = this.readRows(workbook.getWorksheet(SHEETS.records));
    if (!rows.length) {
      throw new DomainValidationError('excel file contains no historical performance rows');
    }

    const recordsByEmployeeId = new Map(current.records.map((record) => [record.employeeId, record]));
    const recordsByEmployeeNo = new Map(
      current.records
        .filter((record): record is typeof record & { employeeNo: string } => Boolean(record.employeeNo))
        .map((record) => [record.employeeNo, record])
    );

    const items = rows.flatMap((row, index) => {
      const employeeId = this.readString(row, 1);
      const employeeNo = this.readString(row, 2);
      const employeeName = this.readString(row, 3);
      const matched =
        (employeeId ? recordsByEmployeeId.get(employeeId) : undefined) ??
        (employeeNo ? recordsByEmployeeNo.get(employeeNo) : undefined);

      if (!matched) {
        throw new DomainValidationError(
          `historical performance row ${index + 4} does not match any active employee: ${employeeName || employeeNo || employeeId}`
        );
      }

      return ([
        [1, 8],
        [2, 11],
        [3, 14],
        [4, 17]
      ] as const).map(([quarter, columnIndex]) => ({
        userId: matched.employeeId,
        quarter,
        score: this.readOptionalScore(row, columnIndex, `Q${quarter}补录得分`, index + 4)
      }));
    });

    return this.adminConfigService.saveHistoricalPerformance(year, items, actor);
  }

  private addGuideSheet(workbook: ExcelJS.Workbook, year: number) {
    const sheet = workbook.addWorksheet(SHEETS.guide);
    sheet.columns = [
      { header: '模块', key: 'module', width: 20 },
      { header: '说明', key: 'description', width: 100 }
    ];

    sheet.addRows([
      ['导入范围', `当前文件对应 ${year} 年历史绩效补录，只影响年度评分排名，不会生成 OKR。`],
      ['可编辑列', '只允许修改 Q1/Q2/Q3/Q4 的“补录得分”列。'],
      ['填写规则', '补录得分支持 0-100，保留 1 位小数；留空表示清空该季度补录分。'],
      ['优先级', '如果某季度已经存在系统内 OKR 得分，年度排名仍优先使用系统得分。'],
      ['匹配方式', '导入时优先按隐藏的员工ID匹配，找不到时再按工号匹配。请不要删除或打乱表头结构。']
    ]);
  }

  private addRecordsSheet(
    workbook: ExcelJS.Workbook,
    payload: Awaited<ReturnType<AdminConfigService['getHistoricalPerformance']>>
  ) {
    const sheet = workbook.addWorksheet(SHEETS.records);
    const note =
      `当前为 ${payload.year} 年历史绩效补录表。只修改“补录得分”列；系统得分列仅用于参考，年度总分按“系统优先、无系统时取补录”计算。`;
    const headers = [
      '员工ID',
      '工号',
      '姓名',
      '科室',
      '小组',
      '岗位',
      'Q1系统得分',
      'Q1补录得分',
      'Q1实际计入',
      'Q2系统得分',
      'Q2补录得分',
      'Q2实际计入',
      'Q3系统得分',
      'Q3补录得分',
      'Q3实际计入',
      'Q4系统得分',
      'Q4补录得分',
      'Q4实际计入',
      '年度总分'
    ];
    const hints = [
      '隐藏列',
      '建议保留',
      '只读',
      '只读',
      '只读',
      '只读',
      '只读',
      '可编辑',
      '只读',
      '只读',
      '可编辑',
      '只读',
      '只读',
      '可编辑',
      '只读',
      '只读',
      '可编辑',
      '只读',
      '只读'
    ];

    const noteRow = sheet.addRow([note]);
    sheet.mergeCells(1, 1, 1, headers.length);
    noteRow.height = 28;
    noteRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAF3FF' }
    };
    noteRow.getCell(1).font = {
      bold: true,
      color: { argb: 'FF1F4E79' }
    };

    const hintRow = sheet.addRow(hints);
    hintRow.eachCell((cell, colNumber) => {
      const editable = [8, 11, 14, 17].includes(colNumber);
      cell.font = {
        size: 11,
        color: { argb: editable ? 'FF1D4ED8' : 'FF6B7280' },
        bold: editable
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: editable ? 'FFE8F1FF' : 'FFF8FAFC' }
      };
    });

    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };

    for (const record of payload.records) {
      const quarterMap = new Map(record.quarters.map((quarter) => [quarter.quarter, quarter]));
      sheet.addRow([
        record.employeeId,
        record.employeeNo ?? '',
        record.employeeName,
        record.sectionName ?? '',
        record.reviewGroupName ?? '',
        record.positionName ?? '',
        toExcelScore(quarterMap.get(1)?.systemScore ?? null),
        toExcelScore(quarterMap.get(1)?.manualScore ?? null),
        toExcelScore(quarterMap.get(1)?.effectiveScore ?? null),
        toExcelScore(quarterMap.get(2)?.systemScore ?? null),
        toExcelScore(quarterMap.get(2)?.manualScore ?? null),
        toExcelScore(quarterMap.get(2)?.effectiveScore ?? null),
        toExcelScore(quarterMap.get(3)?.systemScore ?? null),
        toExcelScore(quarterMap.get(3)?.manualScore ?? null),
        toExcelScore(quarterMap.get(3)?.effectiveScore ?? null),
        toExcelScore(quarterMap.get(4)?.systemScore ?? null),
        toExcelScore(quarterMap.get(4)?.manualScore ?? null),
        toExcelScore(quarterMap.get(4)?.effectiveScore ?? null),
        toExcelScore(record.annualScore)
      ]);
    }

    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    sheet.getColumn(1).hidden = true;
    const widths = [12, 12, 12, 16, 14, 18, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
  }

  private readRows(sheet: ExcelJS.Worksheet | undefined) {
    if (!sheet || sheet.rowCount < 4) {
      return [] as ExcelJS.Row[];
    }

    return (
      sheet.getRows(4, sheet.rowCount - 3)?.filter((row) => {
        return [2, 3, 8, 11, 14, 17].some((index) => this.readString(row, index) !== '');
      }) ?? []
    );
  }

  private readString(row: ExcelJS.Row, index: number) {
    const raw = row.getCell(index).value;
    if (raw == null) {
      return '';
    }

    if (typeof raw === 'object') {
      if ('text' in raw && typeof raw.text === 'string') {
        return raw.text.trim();
      }

      if ('result' in raw && raw.result != null) {
        return String(raw.result).trim();
      }
    }

    return String(raw).trim();
  }

  private readOptionalScore(row: ExcelJS.Row, index: number, label: string, displayRowNumber: number) {
    const raw = this.readString(row, index);
    if (!raw) {
      return null;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      throw new DomainValidationError(`${label}格式不正确，第 ${displayRowNumber} 行`);
    }

    return Number(numeric.toFixed(1));
  }
}

function toExcelScore(value: number | null) {
  return value === null ? '' : value;
}
