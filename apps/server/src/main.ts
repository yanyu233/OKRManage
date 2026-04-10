import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RuntimeConfigService } from './modules/config/runtime-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const runtimeConfig = app.get(RuntimeConfigService);
  app.enableCors({
    origin: runtimeConfig.frontendOrigins,
    credentials: true
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(runtimeConfig.port);
}

void bootstrap();
