// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // ← Import the class
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Correct: Use the class, not a string
  const configService = app.get(ConfigService);

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription('Plans, Members, Trainers, etc.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Port from .env or default
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port, '0.0.0.0');
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Failed to start app:', err);
  process.exit(1);
});
