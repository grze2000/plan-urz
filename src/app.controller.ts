import {
  Controller,
  Get,
  Query,
  Render,
  Res,
  StreamableFile,
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
    @Query('exerciseGroup') exerciseGroup: number,
    @Query('workshopGroup') workshopGroup: number,
    @Query('skipOrlof') skipOrlof: boolean,
  ): Promise<TimeTableType & FiltersType> {
    return this.appService.getTimeTable({
      exerciseGroup,
      workshopGroup,
      skipOrlof,
    });
  }

  @Get('/pdf')
  generatePdf(
    @Query('exerciseGroup') exerciseGroup: number,
    @Query('workshopGroup') workshopGroup: number,
    @Query('skipOrlof') skipOrlof: boolean,
    @Res() res: Response,
  ) {
    return this.appService.generatePdf(res, {
      exerciseGroup,
      workshopGroup,
      skipOrlof,
    });
  }
}
