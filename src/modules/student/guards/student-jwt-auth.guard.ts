/**
 * Guard bảo vệ route dành cho Học sinh
 * Sử dụng strategy 'student-jwt' riêng
 */
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class StudentJwtAuthGuard extends AuthGuard("student-jwt") {}
