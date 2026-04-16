import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';
import type {
  LeaderAnnualPublicNoticeRecord,
  LeaderPublicNoticeEntryRecord,
  LeaderQuarterlyPublicNoticeRecord
} from '../../infrastructure/repositories/leader/leader.repository';

const COLUMN_WIDTHS = [5, 10, 10, 16, 18, 11, 22, 8] as const;
const NOTICE_HEADERS = ['序号', '姓名', '工号', '科室', '岗位', '组别', '部门内绩效考核等级', '备注'] as const;

@Injectable()
export class LeaderPublicNoticeDocxService {
  async buildQuarterlyNotice(record: LeaderQuarterlyPublicNoticeRecord): Promise<{ fileName: string; buffer: Buffer }> {
    const title = `${record.departmentName ?? ''}一般员工${record.year}年${toQuarterTitle(record.quarter)}绩效考评结果表`.trim();
    return {
      fileName: `${title || `${record.year}年季度绩效考评结果表`}.docx`,
      buffer: await this.buildDocument(title, record.entries)
    };
  }

  async buildAnnualNotice(record: LeaderAnnualPublicNoticeRecord): Promise<{ fileName: string; buffer: Buffer }> {
    const title = `${record.departmentName ?? ''}一般员工${record.year}年年度绩效考评结果表`.trim();
    return {
      fileName: `${title || `${record.year}年年度绩效考评结果表`}.docx`,
      buffer: await this.buildDocument(title, record.entries)
    };
  }

  private async buildDocument(title: string, entries: LeaderPublicNoticeEntryRecord[]) {
    const document = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: '宋体',
              size: 22
            }
          }
        }
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720
              },
              size: {
                orientation: PageOrientation.PORTRAIT
              }
            }
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 240
              },
              children: [
                new TextRun({
                  text: title || '绩效考评结果表',
                  bold: true,
                  size: 36,
                  font: '宋体'
                })
              ]
            }),
            this.buildTable(entries)
          ]
        }
      ]
    });

    return Packer.toBuffer(document);
  }

  private buildTable(entries: LeaderPublicNoticeEntryRecord[]) {
    const rows = [
      new TableRow({
        tableHeader: true,
        children: NOTICE_HEADERS.map((header, index) => this.buildCell(header, COLUMN_WIDTHS[index], true))
      }),
      ...entries.map((entry, index) =>
        new TableRow({
          children: [
            this.buildCell(String(index + 1), COLUMN_WIDTHS[0]),
            this.buildCell(entry.employeeName, COLUMN_WIDTHS[1]),
            this.buildCell(entry.employeeNo ?? '', COLUMN_WIDTHS[2]),
            this.buildCell(entry.sectionName ?? '', COLUMN_WIDTHS[3]),
            this.buildCell(entry.positionName ?? '', COLUMN_WIDTHS[4]),
            this.buildCell(entry.reviewGroupName ?? '', COLUMN_WIDTHS[5]),
            this.buildCell(entry.resultLabel, COLUMN_WIDTHS[6]),
            this.buildCell('', COLUMN_WIDTHS[7])
          ]
        })
      )
    ];

    return new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      layout: TableLayoutType.FIXED,
      rows
    });
  }

  private buildCell(text: string, width: number, isHeader = false) {
    return new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      width: {
        size: width,
        type: WidthType.PERCENTAGE
      },
      margins: {
        top: 80,
        bottom: 80,
        left: 80,
        right: 80
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '000000' }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: isHeader,
              font: '宋体',
              size: isHeader ? 24 : 22
            })
          ]
        })
      ]
    });
  }
}

function toQuarterTitle(quarter: number) {
  switch (quarter) {
    case 1:
      return '一季度';
    case 2:
      return '二季度';
    case 3:
      return '三季度';
    case 4:
      return '四季度';
    default:
      return `${quarter}季度`;
  }
}
