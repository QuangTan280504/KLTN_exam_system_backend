/**
 * Service tạo file Excel mẫu (template) động bằng ExcelJS.
 * Dùng chung cho mọi module: Question, Student, Class, Lecturer…
 */
import { Injectable } from "@nestjs/common";

/** Định nghĩa một cột trong sheet */
export interface ColumnDefinition {
    header: string; // Tên cột hiển thị ở hàng 1
    key: string; // Key dùng cho sampleRows
    width?: number; // Độ rộng cột (default 20)
    required?: boolean; // Nếu true → thêm (*) vào header
    note?: string; // Ghi chú hiện ở hàng 2 (dòng hướng dẫn)
}

/** Định nghĩa data validation (dropdown) cho 1 cột */
export interface ValidationDefinition {
    type: "list";
    allowBlank?: boolean;
    formulae: string[]; // Danh sách giá trị cho dropdown
    showErrorMessage?: boolean;
    errorTitle?: string;
    error?: string;
}

/** Định nghĩa 1 sheet trong workbook */
export interface SheetDefinition {
    name: string; // Tên sheet
    columns: ColumnDefinition[];
    sampleRows?: Record<string, any>[]; // Dữ liệu mẫu
    validations?: Record<string, ValidationDefinition>; // key = columnKey
}

@Injectable()
export class TemplateGeneratorService {
    /**
     * Tạo workbook Excel từ mảng SheetDefinition.
     * Trả về Buffer để controller gửi về client.
     */
    async generate(sheets: SheetDefinition[]): Promise<Buffer> {
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "ExamSystem";
        workbook.created = new Date();

        for (const sheetDef of sheets) {
            const ws = workbook.addWorksheet(sheetDef.name);

            /* ── Row 1: Headers ───────────────────────────── */
            const headerValues = sheetDef.columns.map((c) => (c.required ? `${c.header} (*)` : c.header));
            const headerRow = ws.addRow(headerValues);
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF2563EB" }, // blue-600
                };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                cell.border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                };
            });

            /* ── Row 2: Notes / hướng dẫn ─────────────────── */
            const noteValues = sheetDef.columns.map((c) => c.note || "");
            const noteRow = ws.addRow(noteValues);
            noteRow.eachCell((cell) => {
                cell.font = { italic: true, color: { argb: "FF6B7280" }, size: 10 };
                cell.alignment = { vertical: "middle" };
            });

            /* ── Column widths ────────────────────────────── */
            sheetDef.columns.forEach((c, idx) => {
                ws.getColumn(idx + 1).width = c.width || 20;
            });

            /* ── Sample rows ──────────────────────────────── */
            if (sheetDef.sampleRows) {
                for (const sr of sheetDef.sampleRows) {
                    const values = sheetDef.columns.map((c) => sr[c.key] ?? "");
                    const row = ws.addRow(values);
                    row.eachCell((cell) => {
                        cell.font = { color: { argb: "FF9CA3AF" } }; // gray-400
                    });
                }
            }

            /* ── Data Validations ─────────────────────────── */
            if (sheetDef.validations) {
                for (const [columnKey, v] of Object.entries(sheetDef.validations)) {
                    const colIdx = sheetDef.columns.findIndex((c) => c.key === columnKey);
                    if (colIdx === -1) continue;
                    const colLetter = this.colLetter(colIdx + 1);
                    // Áp dụng validation từ dòng 3 đến 1000
                    for (let r = 3; r <= 1000; r++) {
                        ws.getCell(`${colLetter}${r}`).dataValidation = {
                            type: v.type,
                            allowBlank: v.allowBlank ?? true,
                            formulae: v.formulae,
                            showErrorMessage: v.showErrorMessage ?? true,
                            errorTitle: v.errorTitle || "Giá trị không hợp lệ",
                            error: v.error || `Vui lòng chọn: ${v.formulae.join(", ")}`,
                        };
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /** Convert column index (1-based) to letter */
    private colLetter(col: number): string {
        let s = "";
        while (col > 0) {
            col--;
            s = String.fromCharCode(65 + (col % 26)) + s;
            col = Math.floor(col / 26);
        }
        return s;
    }
}
