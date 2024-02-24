import {
  Controller,
  Get,
  Query,
  Render,
  Res,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FiltersType, TimeTableType } from './types/timetable';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getTimeTable(
    @Query('filters') filters: string,
  ): Promise<TimeTableType & FiltersType> {
    return this.appService.getTimeTable({
      filters,
    });
  }

  @Get('/pdf')
  generatePdf(
    @Query('filters') filters: string,
    @Res() res: Response,
  ) {
    return this.appService.generatePdf(res, {
      filters
    });
  }
}
