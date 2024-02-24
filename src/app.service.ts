import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import {
  FiltersType,
  OtherData,
  TTimetableResponse,
  TimeTableType,
  TimeTableWeekType,
} from './types/timetable';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as pdf from 'pdf-creator-node';
import { Response } from 'express';
import * as dayjs from 'dayjs';

const colors = [
  { backgroundColor: '#ffd1dc', borderColor: '#d6a1ac' },
  { backgroundColor: '#aedff7', borderColor: '#7caecc' },
  { backgroundColor: '#dfffc5', borderColor: '#b3cc97' },
  { backgroundColor: '#d9cdee', borderColor: '#b0a2c4' },
  { backgroundColor: '#ffe4c4', borderColor: '#d4b89c' },
  { backgroundColor: '#b2f2d0', borderColor: '#8ed5a8' },
  { backgroundColor: '#ffa6a1', borderColor: '#d6827f' },
  { backgroundColor: '#aec6ff', borderColor: '#8094d6' },
  { backgroundColor: '#fffcb5', borderColor: '#d9d489' },
  { backgroundColor: '#ffdee9', borderColor: '#d6b3c5' },
  { backgroundColor: '#ffb3e6', borderColor: '#d691c0' },
  { backgroundColor: '#85e085', borderColor: '#5cad5c' },
  { backgroundColor: '#cda0e5', borderColor: '#a476c1' },
  { backgroundColor: '#99e6ff', borderColor: '#66c2d6' },
  { backgroundColor: '#c2c2f0', borderColor: '#9494c8' },
  { backgroundColor: '#ffb366', borderColor: '#d6954d' },
  { backgroundColor: '#ff6666', borderColor: '#d64040' },
  { backgroundColor: '#c2f0c2', borderColor: '#94c894' },
  { backgroundColor: '#ffdb4d', borderColor: '#d6b238' },
  { backgroundColor: '#6666ff', borderColor: '#4040d6' },
];

const classesColors = {};
let colorIndex = 0;

const timetableApiUrl =
  'https://planurz2.grzegorzbabiarz.com/api/zapytania/planzajec/';

function timeDifference(time1, time2) {
  function convertToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  const minutes1 = convertToMinutes(time1);
  const minutes2 = convertToMinutes(time2);
  const diff = minutes2 - minutes1;

  function formatDifference(minutesDiff) {
    const absDiff = Math.abs(minutesDiff);
    const h = Math.floor(absDiff / 60);
    const m = absDiff % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}min`;
  }

  return {
    formatted: diff >= 0 ? formatDifference(diff) : '',
    minutes: diff >= 0 ? diff : 0,
  };
}

const weekdays = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

const getLessonColor = (subject: string) => {
  if (subject.replace(/[ ]/, '') in classesColors) {
    return classesColors[subject.replace(/[ ]/, '')];
  }
  const color = colors[colorIndex % colors.length];
  classesColors[subject.replace(/[ ]/, '')] = color;
  colorIndex++;
  return color;
};

const options = {
  format: 'Legal',
  orientation: 'landscape',
  width: '14in',
  height: '8.5in',
  border: '5mm',
  childProcessOptions: {
    env: {
      OPENSSL_CONF: '/dev/null',
    },
  },
};

const getWeeekSchedule = (
  week: TTimetableResponse,
  filters: string,
): [TimeTableWeekType, string[]] => {
  const weekSchedule: TimeTableWeekType = {
    Poniedziałek: {
      hours: {
        start: '',
        end: '',
      },
      classes: [],
    },
    Wtorek: {
      hours: {
        start: '',
        end: '',
      },
      classes: [],
    },
    Środa: {
      hours: {
        start: '',
        end: '',
      },
      classes: [],
    },
    Czwartek: {
      hours: {
        start: '',
        end: '',
      },
      classes: [],
    },
    Piątek: {
      hours: {
        start: '',
        end: '',
      },
      classes: [],
    },
  };

  const groups = new Set<string>();
  for (const lesson of week) {
    groups.add(lesson.spec);
    if (
      filters &&
      !filters
        ?.split(',')
        .includes(lesson.spec.toLowerCase().replace(/\s/g, ''))
    ) {
      continue;
    }
    const day = weekSchedule[weekdays[dayjs(lesson.pz_data_od).weekday() - 1]];
    const classesStart = `${lesson.godz}:${lesson.min}`;
    const classesEnd = dayjs()
      .hour(Number(lesson.godz))
      .minute(Number(lesson.min))
      .add(Number(lesson.licznik_g) * 45, 'm')
      .format('HH:mm');
    const previousClass = day.classes[day.classes.length - 1];
    const breakBeforeMinutes = previousClass
      ? timeDifference(previousClass.end, classesStart)
      : { formatted: '', minutes: 0 };
    day.classes.push({
      start: classesStart,
      end: classesEnd,
      subject: lesson.p_nazwa,
      teacher: `${lesson.tytul_naukowy_nazwa} ${lesson.imie} ${lesson.nazwisko}`,
      room: lesson.bs_nazwa,
      group: lesson.spec,
      groupType: '-',
      groupNumber: '-',
      type: lesson.fz_nazwa,
      color: getLessonColor(lesson.p_nazwa),
      breakBefore: breakBeforeMinutes,
    });

    if (
      !day.hours.start ||
      timeDifference(day.hours.start, classesStart).minutes < 0
    ) {
      day.hours.start = classesStart;
    }
    if (
      !day.hours.end ||
      timeDifference(day.hours.end, classesStart).minutes > 0
    ) {
      day.hours.end = classesEnd;
    }
  }
  return [weekSchedule, Array.from(groups)];
};

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  async getTimeTable(allFilters: {
    filters: string;
  }): Promise<TimeTableType & FiltersType & OtherData> {
    const timetableWeekA =
      await this.httpService.axiosRef.post<TTimetableResponse>(
        timetableApiUrl,
        {
          zakres_s: 1,
          kierunek: '1',
          id: '1630',
        },
      );
    const timetableWeekB =
      await this.httpService.axiosRef.post<TTimetableResponse>(
        timetableApiUrl,
        {
          zakres_s: 2,
          kierunek: '1',
          id: '1630',
        },
      );

    const [weekA, groupsA] = getWeeekSchedule(
      timetableWeekA.data,
      allFilters.filters,
    );
    const [weekB, groupsB] = getWeeekSchedule(
      timetableWeekB.data,
      allFilters.filters,
    );

    return {
      filters: allFilters,
      weekA,
      weekB,
      groups: Array.from(new Set([...groupsA, ...groupsB])).map((group) => ({
        name: group,
        active: allFilters.filters
          ?.split(',')
          .includes(group.toLowerCase().replace(/\s/g, '')),
      })),
    };
  }

  async generatePdf(
    res: Response,
    allFilters: {
      filters: string;
    },
  ) {
    const timetableWeekA =
      await this.httpService.axiosRef.post<TTimetableResponse>(
        timetableApiUrl,
        {
          zakres_s: 1,
          kierunek: '1',
          id: '1630',
        },
      );
    const timetableWeekB =
      await this.httpService.axiosRef.post<TTimetableResponse>(
        timetableApiUrl,
        {
          zakres_s: 2,
          kierunek: '1',
          id: '1630',
        },
      );

    const [weekA, groupsA] = getWeeekSchedule(
      timetableWeekA.data,
      allFilters.filters,
    );
    const [weekB, groupsB] = getWeeekSchedule(
      timetableWeekB.data,
      allFilters.filters,
    );

    const html = readFileSync(
      join(__dirname, '..', 'views', 'pdf.hbs'),
      'utf8',
    );
    const pdfBuffer = await pdf.create(
      {
        html: html,
        data: {
          filters: allFilters,
          weekA,
          weekB,
          groups: Array.from(new Set([...groupsA, ...groupsB])).map(
            (group) => ({
              name: group,
              active: allFilters.filters
                ?.split(',')
                .includes(group.toLowerCase().replace(/\s/g, '')),
            }),
          ),
        },
        type: 'buffer',
      },
      options,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=timetable.pdf');
    return res.end(pdfBuffer);
  }
}
