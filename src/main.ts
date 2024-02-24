import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import * as weekday from 'dayjs/plugin/weekday'
import * as dayjs from 'dayjs';

dayjs.extend(weekday)

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  console.log('Listening on port', process.env.PORT || 3000);
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
