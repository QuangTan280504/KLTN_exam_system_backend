import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import { QuestionType, CognitiveLevel, MCQData, GroupData, ShortAnswerData } from "../interfaces/question-data.interface";

export interface ParsedMCQQuestion {
    content: string;
    cognitiveLevel: CognitiveLevel;
    data: MCQData;
    images?: string[];
}

export interface ParsedGroupQuestion {
    content: string;
    cognitiveLevel: CognitiveLevel;
    data: GroupData;
    images?: string[];
}

export interface ParsedShortAnswerQuestion {
    content: string;
    cognitiveLevel: CognitiveLevel;
    data: ShortAnswerData;
    images?: string[];
}

export interface ParsedExcelData {
    mcqQuestions: ParsedMCQQuestion[];
    groupQuestions: ParsedGroupQuestion[];
    shortAnswerQuestions: ParsedShortAnswerQuestion[];
}

@Injectable()
export class ExcelImportService {
    async parseExcelFile(buffer: Buffer): Promise<ParsedExcelData> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);

        const mcqSheet = workbook.getWorksheet("MCQ");
        const groupSheet = workbook.getWorksheet("Group");
        const saSheet = workbook.getWorksheet("SHORT_ANSWER");

        return {
            mcqQuestions: mcqSheet ? this.parseMCQSheet(mcqSheet) : [],
            groupQuestions: groupSheet ? this.parseGroupSheet(groupSheet) : [],
            shortAnswerQuestions: saSheet ? this.parseShortAnswerSheet(saSheet) : [],
        };
    }

    private parseMCQSheet(sheet: ExcelJS.Worksheet): ParsedMCQQuestion[] {
        const questions: ParsedMCQQuestion[] = [];

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const content = this.getCellValue(row, 1);
            const level = parseInt(this.getCellValue(row, 2) || "1");
            const optionA = this.getCellValue(row, 3);
            const optionB = this.getCellValue(row, 4);
            const optionC = this.getCellValue(row, 5);
            const optionD = this.getCellValue(row, 6);
            const correctAnswer = this.getCellValue(row, 7).toUpperCase();
            const imagesRaw = this.getCellValue(row, 8);

            // Validation
            if (!content || !optionA || !optionB || !optionC || !optionD) {
                console.warn(`Row ${rowNumber}: Missing required fields, skipping`);
                return;
            }

            if (!["A", "B", "C", "D"].includes(correctAnswer)) {
                console.warn(`Row ${rowNumber}: Invalid correct answer '${correctAnswer}', skipping`);
                return;
            }

            // Create option objects with UUIDs
            const optionIds = {
                A: uuidv4(),
                B: uuidv4(),
                C: uuidv4(),
                D: uuidv4(),
            };

            const options = [
                { id: optionIds["A"], text: optionA, label: "A" },
                { id: optionIds["B"], text: optionB, label: "B" },
                { id: optionIds["C"], text: optionC, label: "C" },
                { id: optionIds["D"], text: optionD, label: "D" },
            ];

            questions.push({
                content,
                cognitiveLevel: [1, 2, 3].includes(level) ? level : 1,
                data: {
                    options,
                    correct_option_id: optionIds[correctAnswer],
                },
                images: this.parseImageList(imagesRaw),
            });
        });

        return questions;
    }

    private parseGroupSheet(sheet: ExcelJS.Worksheet): ParsedGroupQuestion[] {
        const questions: ParsedGroupQuestion[] = [];

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const content = this.getCellValue(row, 1); // Column A: Câu dẫn
            const level = parseInt(this.getCellValue(row, 2) || "2"); // Column B: Mức độ

            const subA = this.getCellValue(row, 3); // Column C: Ý a
            const correctA = this.getCellValue(row, 4).toUpperCase(); // Column D: Đ/S a
            const subB = this.getCellValue(row, 5); // Column E: Ý b
            const correctB = this.getCellValue(row, 6).toUpperCase(); // Column F: Đ/S b
            const subC = this.getCellValue(row, 7); // Column G: Ý c
            const correctC = this.getCellValue(row, 8).toUpperCase(); // Column H: Đ/S c
            const subD = this.getCellValue(row, 9); // Column I: Ý d
            const correctD = this.getCellValue(row, 10).toUpperCase(); // Column J: Đ/S d
            const imagesRaw = this.getCellValue(row, 11); // Column K: Hình ảnh

            // Validation
            if (!content || !subA || !subB || !subC || !subD) {
                console.warn(`Row ${rowNumber}: Missing required fields, skipping`);
                return;
            }

            const sub_questions = [
                {
                    id: uuidv4(),
                    text: subA,
                    label: "a",
                    is_correct: ["Đ", "D"].includes(correctA),
                },
                {
                    id: uuidv4(),
                    text: subB,
                    label: "b",
                    is_correct: ["Đ", "D"].includes(correctB),
                },
                {
                    id: uuidv4(),
                    text: subC,
                    label: "c",
                    is_correct: ["Đ", "D"].includes(correctC),
                },
                {
                    id: uuidv4(),
                    text: subD,
                    label: "d",
                    is_correct: ["Đ", "D"].includes(correctD),
                },
            ];

            questions.push({
                content,
                cognitiveLevel: [1, 2, 3].includes(level) ? level : 2,
                data: { sub_questions },
                images: this.parseImageList(imagesRaw),
            });
        });

        return questions;
    }

    private getCellValue(row: ExcelJS.Row, columnNumber: number): string {
        const cell = row.getCell(columnNumber);
        return cell.value?.toString().trim() || "";
    }

    private parseImageList(value: string): string[] {
        if (!value) return [];
        return value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    private parseShortAnswerSheet(sheet: ExcelJS.Worksheet): ParsedShortAnswerQuestion[] {
        const questions: ParsedShortAnswerQuestion[] = [];

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 2) return; // Skip header + note row

            const content = this.getCellValue(row, 1);
            const level = parseInt(this.getCellValue(row, 2) || "1");
            const sampleAnswer = this.getCellValue(row, 3);
            const imagesRaw = this.getCellValue(row, 4);

            if (!content) {
                console.warn(`SHORT_ANSWER Row ${rowNumber}: Missing content, skipping`);
                return;
            }

            questions.push({
                content,
                cognitiveLevel: [1, 2, 3].includes(level) ? level : 1,
                data: {
                    sample_answer: sampleAnswer || undefined,
                } as ShortAnswerData,
                images: this.parseImageList(imagesRaw),
            });
        });

        return questions;
    }
}
