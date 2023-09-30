import { Controller, Get, Query, Render } from '@nestjs/common';
import { AppService } from './app.service';
import { TimeTableType } from './types/timetable';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getTimeTable(
    @Query('exerciseGroup') exerciseGroup: number,
    @Query('workshopGroup') workshopGroup: number,
  ): Promise<TimeTableType> {
    return this.appService.getTimeTable(exerciseGroup, workshopGroup);
  }
}
