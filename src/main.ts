import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Serve uploaded files as static assets
    app.useStaticAssets(join(__dirname, '..', 'uploads'), {
        prefix: '/uploads/',
    });

    // Enable validation globally
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Enable CORS
    app.enableCors();

    // Swagger Configuration
    const config = new DocumentBuilder()
        .setTitle('Exam System API')
        .setDescription('API documentation for the Exam Management System')
        .setVersion('1.0')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT token',
            },
            'access-token',
        )
        .addTag('auth', 'Authentication endpoints')
        .addTag('subjects', 'Subject management endpoints')
        .addTag('question-pools', 'Question pool management endpoints')
        .addTag('questions', 'Question CRUD endpoints')
        .addTag('exam-matrices', 'Exam matrix configuration endpoints')
        .addTag('exam-sessions', 'Exam session management endpoints')
        .addTag('student-exams', 'Student exam endpoints (login, submit)')
        .addTag('reports', 'Report export endpoints')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
    console.log(`Swagger API Documentation: http://localhost:${port}/api`);
}
bootstrap();
