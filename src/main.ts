// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get config service
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription('Plans, Members, Trainers, etc.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // ✅ Add global API prefix
  app.setGlobalPrefix('api');

  // Port from .env or default
  const port = configService.get<number>('PORT') ?? 3000;

  // Listen on all interfaces (important for EC2 + Nginx)
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application running on http://localhost:${port}`);
  console.log(`📘 Swagger UI: http://localhost:${port}/docs`);
  console.log(`🌐 API Base URL: http://<your-ec2-ip>/api`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start app:', err);
  process.exit(1);
});
