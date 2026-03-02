import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import { Question } from '../../question/entities/question.entity';
import { QuestionType, CognitiveLevel, MCQData, GroupData } from '../../question/interfaces/question-data.interface';

@Injectable()
export class QuestionImportService {
    constructor(
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
    ) { }

    async importFromExcel(poolId: string, buffer: Buffer): Promise<{ success: number, failed: number, errors: string[] }> {
        const workbook = new ExcelJS.Workbook();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await workbook.xlsx.load(buffer as any);

        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // --- Process Sheet 1: MCQ ---
        const mcqSheet = workbook.getWorksheet('MCQ') || workbook.worksheets[0]; // Fallback to first sheet if named one not found, but be careful
        if (mcqSheet) {
            console.log(`Processing MCQ sheet: ${mcqSheet.name}`);
            const results = await this.processMcqSheet(poolId, mcqSheet);
            successCount += results.success;
            failedCount += results.failed;
            errors.push(...results.errors);
        }

        // --- Process Sheet 2: Group ---
        const groupSheet = workbook.getWorksheet('Group');
        if (groupSheet) {
            console.log(`Processing Group sheet: ${groupSheet.name}`);
            const results = await this.processGroupSheet(poolId, groupSheet);
            successCount += results.success;
            failedCount += results.failed;
            errors.push(...results.errors);
        } else if (workbook.worksheets.length > 1 && !mcqSheet) {
            // If first sheet was not MCQ but we have multiple sheets, maybe check logic
        }

        return { success: successCount, failed: failedCount, errors };
    }

    private async processMcqSheet(poolId: string, sheet: ExcelJS.Worksheet): Promise<{ success: number, failed: number, errors: string[] }> {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];
        const questionsToSave: Question[] = [];

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            try {
                const getCell = (idx: number) => {
                    const cell = row.getCell(idx);
                    return cell.value ? cell.value.toString().trim() : '';
                };

                const content = getCell(1);
                const levelRaw = getCell(2);
                const ansA = getCell(3);
                const ansB = getCell(4);
                const ansC = getCell(5);
                const ansD = getCell(6);
                const correctChar = getCell(7).toUpperCase();

                if (!content || !ansA || !ansB || !ansC || !ansD || !correctChar) {
                    // Empty row or missing required fields
                    return;
                }

                // Map Level
                let level = CognitiveLevel.BIET;
                if (levelRaw === '2') level = CognitiveLevel.HIEU;
                if (levelRaw === '3') level = CognitiveLevel.VAN_DUNG;

                // Generate Options
                const optAId = uuidv4();
                const optBId = uuidv4();
                const optCId = uuidv4();
                const optDId = uuidv4();

                const options = [
                    { id: optAId, text: ansA, label: 'A' },
                    { id: optBId, text: ansB, label: 'B' },
                    { id: optCId, text: ansC, label: 'C' },
                    { id: optDId, text: ansD, label: 'D' },
                ];

                let correctId = '';
                if (correctChar === 'A') correctId = optAId;
                else if (correctChar === 'B') correctId = optBId;
                else if (correctChar === 'C') correctId = optCId;
                else if (correctChar === 'D') correctId = optDId;
                else throw new Error(`Invalid correct answer char: ${correctChar}`);

                const question = this.questionRepository.create({
                    poolId,
                    content,
                    questionType: QuestionType.MCQ,
                    cognitiveLevel: level,
                    data: {
                        options,
                        correct_option_id: correctId
                    } as MCQData
                });

                questionsToSave.push(question);
                success++;
            } catch (error) {
                failed++;
                errors.push(`MCQ Row ${rowNumber}: ${error.message}`);
            }
        });

        if (questionsToSave.length > 0) {
            await this.questionRepository.save(questionsToSave);
        }

        return { success, failed, errors };
    }

    private async processGroupSheet(poolId: string, sheet: ExcelJS.Worksheet): Promise<{ success: number, failed: number, errors: string[] }> {
        let success = 0;
        let failed = 0;
        const errors: string[] = [];
        const questionsToSave: Question[] = [];

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            try {
                const getCell = (idx: number) => {
                    const cell = row.getCell(idx);
                    return cell.value ? cell.value.toString().trim() : '';
                };

                const content = getCell(1);
                const levelRaw = getCell(2);

                // Check required fields
                if (!content) return;

                // Map Level
                let level = CognitiveLevel.BIET;
                if (levelRaw === '2') level = CognitiveLevel.HIEU;
                if (levelRaw === '3') level = CognitiveLevel.VAN_DUNG;

                const subQuestions = [];
                // 4 sub questions: Columns C&D, E&F, G&H, I&J
                const pairs = [
                    { textIdx: 3, correctIdx: 4, label: 'a' },
                    { textIdx: 5, correctIdx: 6, label: 'b' },
                    { textIdx: 7, correctIdx: 8, label: 'c' },
                    { textIdx: 9, correctIdx: 10, label: 'd' },
                ];

                for (const pair of pairs) {
                    const text = getCell(pair.textIdx);
                    const correctRaw = getCell(pair.correctIdx).toLowerCase();

                    if (!text) throw new Error(`Missing sub-question text ${pair.label}`);

                    let isCorrect = false;
                    if (correctRaw === 'đ' || correctRaw === 'd' || correctRaw === 'true' || correctRaw === 't') {
                        isCorrect = true;
                    } else if (correctRaw === 's' || correctRaw === 'false' || correctRaw === 'f') {
                        isCorrect = false;
                    } else {
                        // Default to False if invalid, or throw error? 
                        // Let's be lenient but log warning? No, strict is better for exams.
                        // Assuming S if not explicitly Đ is risky.
                        if (correctRaw !== '') throw new Error(`Invalid T/F value for ${pair.label}: ${correctRaw}`);
                    }

                    subQuestions.push({
                        id: uuidv4(),
                        text,
                        label: pair.label,
                        is_correct: isCorrect
                    });
                }

                const question = this.questionRepository.create({
                    poolId,
                    content,
                    questionType: QuestionType.GROUP,
                    cognitiveLevel: level,
                    data: {
                        sub_questions: subQuestions
                    } as GroupData
                });

                questionsToSave.push(question);
                success++;
            } catch (error) {
                failed++;
                errors.push(`Group Row ${rowNumber}: ${error.message}`);
            }
        });

        if (questionsToSave.length > 0) {
            await this.questionRepository.save(questionsToSave);
        }

        return { success, failed, errors };
    }
}
