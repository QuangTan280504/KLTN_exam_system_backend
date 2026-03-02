import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException, UseGuards, Res, StreamableFile, Header } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { diskStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { QuestionService } from "./question.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { QuestionType, CognitiveLevel } from "./interfaces/question-data.interface";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TemplateGeneratorService } from "../../shared/services/template-generator.service";

@ApiTags("questions")
@ApiBearerAuth("access-token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "LECTURER", "HEAD_OF_DEPARTMENT")
@Controller("questions")
export class QuestionController {
    constructor(
        private readonly questionService: QuestionService,
        private readonly templateService: TemplateGeneratorService,
    ) {}

    @Get("import-template")
    async downloadTemplate(@Res() res: Response) {
        const buffer = await this.templateService.generate([
            {
                name: "MCQ",
                columns: [
                    { header: "Nội dung câu hỏi", key: "content", width: 40, required: true },
                    { header: "Mức độ", key: "level", width: 12, required: true, note: "1=Biết, 2=Hiểu, 3=Vận dụng" },
                    { header: "Đáp án A", key: "optA", width: 25, required: true },
                    { header: "Đáp án B", key: "optB", width: 25, required: true },
                    { header: "Đáp án C", key: "optC", width: 25, required: true },
                    { header: "Đáp án D", key: "optD", width: 25, required: true },
                    { header: "Đáp án đúng", key: "correct", width: 14, required: true, note: "A, B, C hoặc D" },
                    { header: "Hình ảnh", key: "images", width: 40, note: "URL ảnh, cách nhau dấu phẩy (tùy chọn)" },
                ],
                sampleRows: [
                    { content: "Thủ đô của Việt Nam là gì?", level: 1, optA: "Hà Nội", optB: "TP. Hồ Chí Minh", optC: "Đà Nẵng", optD: "Huế", correct: "A", images: "/uploads/questions/hinh1.png" },
                    { content: "2 + 2 = ?", level: 1, optA: "3", optB: "4", optC: "5", optD: "6", correct: "B", images: "" },
                ],
                validations: {
                    level: { type: "list", allowBlank: false, formulae: ['"1,2,3"'], showErrorMessage: true, errorTitle: "Giá trị không hợp lệ", error: "Chọn 1, 2 hoặc 3" },
                    correct: { type: "list", allowBlank: false, formulae: ['"A,B,C,D"'], showErrorMessage: true, errorTitle: "Giá trị không hợp lệ", error: "Chọn A, B, C hoặc D" },
                },
            },
            {
                name: "Group",
                columns: [
                    { header: "Câu dẫn", key: "content", width: 40, required: true },
                    { header: "Mức độ", key: "level", width: 12, required: true, note: "1=Biết, 2=Hiểu, 3=Vận dụng" },
                    { header: "Ý a", key: "subA", width: 30, required: true },
                    { header: "Đ/S ý a", key: "correctA", width: 10, required: true, note: "Đ hoặc S" },
                    { header: "Ý b", key: "subB", width: 30, required: true },
                    { header: "Đ/S ý b", key: "correctB", width: 10, required: true, note: "Đ hoặc S" },
                    { header: "Ý c", key: "subC", width: 30, required: true },
                    { header: "Đ/S ý c", key: "correctC", width: 10, required: true, note: "Đ hoặc S" },
                    { header: "Ý d", key: "subD", width: 30, required: true },
                    { header: "Đ/S ý d", key: "correctD", width: 10, required: true, note: "Đ hoặc S" },
                    { header: "Hình ảnh", key: "images", width: 40, note: "URL ảnh, cách nhau dấu phẩy (tùy chọn)" },
                ],
                sampleRows: [{ content: "Cho các phát biểu sau về tập hợp:", level: 2, subA: "Tập rỗng là tập con của mọi tập", correctA: "Đ", subB: "Mọi tập hợp đều là tập con của chính nó", correctB: "Đ", subC: "Tập rỗng không phải tập hợp", correctC: "S", subD: "Hai tập bằng nhau khi có cùng phần tử", correctD: "Đ", images: "" }],
                validations: {
                    level: { type: "list", allowBlank: false, formulae: ['"1,2,3"'] },
                    correctA: { type: "list", allowBlank: false, formulae: ['"Đ,S"'] },
                    correctB: { type: "list", allowBlank: false, formulae: ['"Đ,S"'] },
                    correctC: { type: "list", allowBlank: false, formulae: ['"Đ,S"'] },
                    correctD: { type: "list", allowBlank: false, formulae: ['"Đ,S"'] },
                },
            },
            {
                name: "SHORT_ANSWER",
                columns: [
                    { header: "Nội dung câu hỏi", key: "content", width: 50, required: true },
                    { header: "Mức độ", key: "level", width: 12, required: true, note: "1=Biết, 2=Hiểu, 3=Vận dụng" },
                    { header: "Đáp án mẫu", key: "sampleAnswer", width: 50, note: "GV tham khảo khi chấm (tùy chọn)" },
                    { header: "Hình ảnh", key: "images", width: 40, note: "URL ảnh, cách nhau dấu phẩy (tùy chọn)" },
                ],
                sampleRows: [
                    { content: "Trình bày khái niệm hàm số liên tục tại một điểm.", level: 2, sampleAnswer: "Hàm số f(x) liên tục tại x0 nếu lim f(x) khi x→x0 = f(x0)", images: "/uploads/questions/hinh_minh_hoa.png" },
                    { content: "Nêu định lý Pytago.", level: 1, sampleAnswer: "Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.", images: "" },
                ],
                validations: {
                    level: { type: "list", allowBlank: false, formulae: ['"1,2,3"'] },
                },
            },
        ]);

        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="mau_import_cau_hoi.xlsx"',
        });
        res.send(buffer);
    }

    @Post("upload-image")
    @UseInterceptors(
        FilesInterceptor("images", 5, {
            storage: diskStorage({
                destination: "./uploads/questions",
                filename: (req, file, cb) => {
                    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
                    cb(null, uniqueName);
                },
            }),
            fileFilter: (req, file, cb) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
                    return cb(new BadRequestException("Chỉ chấp nhận file ảnh (jpg, png, gif, webp)"), false);
                }
                cb(null, true);
            },
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB
            },
        }),
    )
    uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException("Không có file nào được upload");
        }

        const urls = files.map((file) => `/uploads/questions/${file.filename}`);
        return { urls };
    }

    @Post()
    create(@Body() createQuestionDto: CreateQuestionDto) {
        return this.questionService.create(createQuestionDto);
    }

    @Post("import")
    @UseInterceptors(FileInterceptor("file"))
    async importFromExcel(@UploadedFile() file: Express.Multer.File, @Query("poolId") poolId: string) {
        if (!file) {
            throw new BadRequestException("No file uploaded");
        }

        if (!poolId) {
            throw new BadRequestException("poolId is required");
        }

        return await this.questionService.importFromExcel(poolId, file);
    }

    @Get()
    findAll(@Query("poolId") poolId: string, @Query("questionType") questionType?: QuestionType, @Query("cognitiveLevel") cognitiveLevel?: string, @Query("page") page?: string, @Query("limit") limit?: string) {
        if (!poolId) {
            throw new BadRequestException("poolId is required");
        }

        const level = cognitiveLevel ? parseInt(cognitiveLevel) : undefined;
        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 10;

        return this.questionService.findByPool(poolId, questionType, level as CognitiveLevel, pageNum, limitNum);
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.questionService.findOne(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() updateQuestionDto: UpdateQuestionDto) {
        return this.questionService.update(id, updateQuestionDto);
    }

    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param("id") id: string) {
        return this.questionService.remove(id);
    }
}
