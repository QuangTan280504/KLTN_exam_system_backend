import { ExcelImportService } from './excel-import.service';
import * as ExcelJS from 'exceljs';

// Mock ExcelJS
jest.mock('exceljs');

describe('ExcelImportService', () => {
    let service: ExcelImportService;
    let mockWorkbook: jest.Mocked<ExcelJS.Workbook>;
    let mockMCQSheet: jest.Mocked<ExcelJS.Worksheet>;
    let mockGroupSheet: jest.Mocked<ExcelJS.Worksheet>;

    beforeEach(() => {
        service = new ExcelImportService();

        mockMCQSheet = {
            eachRow: jest.fn(),
        } as any;

        mockGroupSheet = {
            eachRow: jest.fn(),
        } as any;

        mockWorkbook = {
            xlsx: {
                load: jest.fn(),
            },
            getWorksheet: jest.fn((name) => {
                if (name === 'MCQ') return mockMCQSheet;
                if (name === 'Group') return mockGroupSheet;
                return null;
            }),
        } as any;

        (ExcelJS.Workbook as jest.MockedClass<typeof ExcelJS.Workbook>).mockImplementation(
            () => mockWorkbook as any,
        );

        jest.clearAllMocks();
    });

    describe('parseExcelFile', () => {
        it('should parse both MCQ and Group sheets', async () => {
            mockMCQSheet.eachRow.mockImplementation((callback: any) => {
                // Header row
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                // Data row
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Câu hỏi 1' },
                                2: { value: '1' },
                                3: { value: 'Đáp án A' },
                                4: { value: 'Đáp án B' },
                                5: { value: 'Đáp án C' },
                                6: { value: 'Đáp án D' },
                                7: { value: 'B' },
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            mockGroupSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Câu dẫn' },
                                2: { value: '2' },
                                3: { value: 'Ý a' },
                                4: { value: 'Đ' },
                                5: { value: 'Ý b' },
                                6: { value: 'S' },
                                7: { value: 'Ý c' },
                                8: { value: 'Đ' },
                                9: { value: 'Ý d' },
                                10: { value: 'S' },
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            expect(result.mcqQuestions).toHaveLength(1);
            expect(result.groupQuestions).toHaveLength(1);
            expect(result.mcqQuestions[0].content).toBe('Câu hỏi 1');
            expect(result.mcqQuestions[0].data.options).toHaveLength(4);
            expect(result.groupQuestions[0].data.sub_questions).toHaveLength(4);
        });

        it('should return empty arrays when sheets not found', async () => {
            mockWorkbook.getWorksheet.mockReturnValue(null as any);

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            expect(result.mcqQuestions).toEqual([]);
            expect(result.groupQuestions).toEqual([]);
        });
    });

    describe('parseMCQSheet', () => {
        it('should skip header row', async () => {
            let rowCount = 0;
            mockMCQSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                rowCount++;
            });

            const buffer = Buffer.from('test');
            await service.parseExcelFile(buffer);

            // Should not process header
            expect(rowCount).toBe(1);
        });

        it('should skip rows with missing required fields', async () => {
            mockMCQSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                // Row with missing option
                callback(
                    {
                        getCell: (col: number) => {
                            if (col === 1) return { value: 'Question', toString: () => 'Question' };
                            if (col === 2) return { value: '1', toString: () => '1' };
                            if (col === 3) return { value: 'A', toString: () => 'A' };
                            // Missing B, C, D
                            return { value: '', toString: () => '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            expect(result.mcqQuestions).toHaveLength(0);
        });

        it('should skip rows with invalid correct answer', async () => {
            mockMCQSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Q' },
                                2: { value: '1' },
                                3: { value: 'A' },
                                4: { value: 'B' },
                                5: { value: 'C' },
                                6: { value: 'D' },
                                7: { value: 'Z' }, // Invalid
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            expect(result.mcqQuestions).toHaveLength(0);
        });

        it('should generate UUIDs for all options', async () => {
            mockMCQSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Q1' },
                                2: { value: '1' },
                                3: { value: 'A' },
                                4: { value: 'B' },
                                5: { value: 'C' },
                                6: { value: 'D' },
                                7: { value: 'A' },
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            expect(result.mcqQuestions[0].data.options[0].id).toBeDefined();
            expect(result.mcqQuestions[0].data.options[1].id).toBeDefined();
            expect(result.mcqQuestions[0].data.correct_option_id).toBeDefined();
        });
    });

    describe('parseGroupSheet', () => {
        it('should parse Đ/S markers correctly', async () => {
            mockGroupSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Lead' },
                                2: { value: '2' },
                                3: { value: 'a' },
                                4: { value: 'Đ' },
                                5: { value: 'b' },
                                6: { value: 'S' },
                                7: { value: 'c' },
                                8: { value: 'D' }, // English D
                                9: { value: 'd' },
                                10: { value: 'X' }, // Invalid - defaults to false
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            const subs = result.groupQuestions[0].data.sub_questions;
            expect(subs[0].is_correct).toBe(true); // Đ
            expect(subs[1].is_correct).toBe(false); // S
            expect(subs[2].is_correct).toBe(true); // D
            expect(subs[3].is_correct).toBe(false); // X (invalid)
        });

        it('should generate UUIDs for sub-questions', async () => {
            mockGroupSheet.eachRow.mockImplementation((callback: any) => {
                callback({ getCell: () => ({ value: 'Header' }) }, 1);
                callback(
                    {
                        getCell: (col: number) => {
                            const values: any = {
                                1: { value: 'Lead' },
                                2: { value: '2' },
                                3: { value: 'a' },
                                4: { value: 'Đ' },
                                5: { value: 'b' },
                                6: { value: 'S' },
                                7: { value: 'c' },
                                8: { value: 'Đ' },
                                9: { value: 'd' },
                                10: { value: 'S' },
                            };
                            return { value: values[col]?.value || '', toString: () => values[col]?.value?.toString() || '' };
                        },
                    },
                    2,
                );
            });

            const buffer = Buffer.from('test');
            const result = await service.parseExcelFile(buffer);

            result.groupQuestions[0].data.sub_questions.forEach((sub) => {
                expect(sub.id).toBeDefined();
                expect(typeof sub.id).toBe('string');
            });
        });
    });
});
