import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { parse } from 'node-html-parser';
import * as crawler from 'crawler-request';
import {
  FiltersType,
  OtherData,
  TTimetableResponse,
  TimeTableDayType,
  TimeTableType,
  TimeTableWeekType,
} from './types/timetable';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as pdf from 'pdf-creator-node';
import { Response } from 'express';
import { AxiosResponse } from 'axios';
import * as dayjs from 'dayjs';
import { group } from 'console';

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

const timetableUrl =
  'https://www.ur.edu.pl/pl/kolegia/kolegium-nauk-spolecznych/student/kierunki-studiow-programy-rozklady-sylabusy/pedagogika/rozklady-zajec';

const timetableApiUrl =
  'https://planurz2.grzegorzbabiarz.com/api/zapytania/planzajec/';

function getSubstringBetween(string, string1, string2) {
  return string
    .slice(string.indexOf(string1) + string1.length, string.indexOf(string2))
    .trim();
}

const getSubstringFrom = (string, string1) => {
  return string
    .slice(string.indexOf(string1) + string1.length, string.length)
    .trim();
};

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
    formatted:
      diff >= 0 ? formatDifference(diff) : `-${formatDifference(diff)}`,
    minutes: diff,
  };
}

const findRowsAndGetValues = (
  text,
  { exerciseGroup, workshopGroup, skipOrlof },
): TimeTableDayType => {
  const trimedText = text.trim().replaceAll(/\n/g, '');
  const regex =
    /(\d{1,2}:\d{1,2})(\d{1,2}:\d{1,2})((?:(?!ul\.)[\p{L} -\.])+)((?:ul\. ?[\p{L} -\.]+ ?)?\d+)([\p{L} \.]+ ([\p{L}]+\. )(\d|OA(?: Orlof)?))(ćw\.|war\.|lektorat|wykład)/gmu;
  let matches;
  const results = [];
  const hourRange = {
    start: null,
    end: null,
  };

  while ((matches = regex.exec(trimedText)) !== null) {
    if (
      (skipOrlof === 'true' && matches[7] === 'OA Orlof') ||
      ((exerciseGroup || workshopGroup) &&
        !(
          (matches[6] === 'ćw. ' &&
            Number(matches[7]) === Number(exerciseGroup)) ||
          (matches[6] === 'war. ' &&
            Number(matches[7]) === Number(workshopGroup)) ||
          !['ćw. ', 'war. '].includes(matches[6])
        ))
    )
      continue;

    const boundaryIndex = matches[3].lastIndexOf(
      matches[3].match(/[a-z][A-Z]/g)?.pop() || '',
    );
    const location = matches[4].startsWith('ul.')
      ? matches[4].split(/(ul\.[\p{L} -\.]+)/u).join(' ')
      : matches[4];
    const subject =
      boundaryIndex !== -1 ? matches[3].slice(boundaryIndex + 1) : matches[3];
    let color = {};

    if (subject.replace(/[ ]/, '') in classesColors) {
      color = classesColors[subject.replace(/[ ]/, '')];
    } else {
      color = colors[colorIndex];
      classesColors[subject.replace(/[ ]/, '')] = color;
      colorIndex++;
    }

    if (
      !hourRange.start ||
      timeDifference(hourRange.start, matches[1]).minutes < 0
    ) {
      hourRange.start = matches[1];
    }
    if (
      !hourRange.end ||
      timeDifference(hourRange.end, matches[1]).minutes > 0
    ) {
      hourRange.end = matches[2];
    }

    const breakBefore =
      results.length > 0 && (workshopGroup || workshopGroup)
        ? timeDifference(results[results.length - 1].end, matches[1])
        : { formatted: '', minutes: 0 };
    if (breakBefore.minutes < 0) {
      breakBefore.formatted = '';
      breakBefore.minutes = 0;
    }

    results.push({
      start: matches[1],
      end: matches[2],
      subject,
      teacher:
        boundaryIndex !== -1
          ? matches[3].slice(0, boundaryIndex + 1)
          : matches[3],
      room: location,
      group: matches[5],
      groupType: ['ćw. ', 'war. '].includes(matches[6]) ? matches[6] : '',
      groupNumber: matches[7],
      type: matches[8],
      color,
      breakBefore,
    });
  }
  return {
    hours: {
      start: hourRange.start,
      end: hourRange.end,
    },
    classes: results,
  };
};

const getWeekDays = (text, filters): TimeTableWeekType => {
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
  for (const dayIndex in weekdays) {
    const day = weekdays[dayIndex];
    if (parseInt(dayIndex) === 0) {
      weekSchedule[day] = findRowsAndGetValues(
        getSubstringBetween(text, 'Uwagi', weekdays[weekdays.indexOf(day) + 1]),
        filters,
      );
    } else if (parseInt(dayIndex) === weekdays.length - 1) {
      weekSchedule[day] = findRowsAndGetValues(
        getSubstringFrom(text, day),
        filters,
      );
    } else {
      weekSchedule[day] = findRowsAndGetValues(
        getSubstringBetween(text, day, weekdays[weekdays.indexOf(day) + 1]),
        filters,
      );
    }
  }
  return weekSchedule;
};

const weekdays = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

function parseSchedule(text, filters): TimeTableType {
  const timetable: TimeTableType = {
    weekA: getWeekDays(
      getSubstringBetween(text, 'Tydzień A', 'Tydzień B'),
      filters,
    ),
    weekB: getWeekDays(getSubstringFrom(text, 'Tydzień B'), filters),
  };
  // console.log(timetable.weekA.Poniedziałek.classes);
  return timetable;
}

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
      !filters.split(',').includes(lesson.spec.toLowerCase().replace(/\s/g, ''))
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
      breakBefore: { formatted: '', minutes: 0 },
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
    exerciseGroup: number;
    workshopGroup: number;
    skipOrlof: boolean;
    filters: string;
  }): Promise<TimeTableType & FiltersType & OtherData> {
    const data = await this.httpService.axiosRef.get(timetableUrl);
    const root = parse(data.data);
    const pdfLink = root.querySelector('.ce_text > p:nth-child(2) a');
    if (!pdfLink) {
      throw new Error('No pdf url found');
    }
    const timetableUrlObject = new URL(timetableUrl);
    const fulllPdfUrl = `${timetableUrlObject.protocol}//${
      timetableUrlObject.hostname
    }/${pdfLink.getAttribute('href')}`;

    const response = await crawler(fulllPdfUrl);
    const results = parseSchedule(response.text, allFilters) as TimeTableType;

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
      ...results,
      filters: allFilters,
      exerciseGroups: Array.from({ length: 4 }, (_, i) => ({
        active: i + 1 === Number(allFilters.exerciseGroup),
        number: i + 1,
      })),
      workshopGroups: Array.from({ length: 8 }, (_, i) => ({
        active: i + 1 === Number(allFilters.workshopGroup),
        number: i + 1,
      })),
      weekA,
      weekB,
      groups: Array.from(new Set([...groupsA, ...groupsB])).map((group) => ({
        name: group,
        active: allFilters.filters.split(',').includes(group.toLowerCase().replace(/\s/g, '')),
      })),
    };
  }

  async generatePdf(
    res: Response,
    filters: {
      exerciseGroup: number;
      workshopGroup: number;
      skipOrlof: boolean;
    },
  ) {
    const data = await this.httpService.axiosRef.get(timetableUrl);
    const root = parse(data.data);
    const pdfLink = root.querySelector('.ce_text > p:nth-child(2) a');
    if (!pdfLink) {
      throw new Error('No pdf url found');
    }
    const timetableUrlObject = new URL(timetableUrl);
    const fulllPdfUrl = `${timetableUrlObject.protocol}//${
      timetableUrlObject.hostname
    }/${pdfLink.getAttribute('href')}`;

    const response = await crawler(fulllPdfUrl);
    const pdfData = parseSchedule(response.text, filters) as TimeTableType;

    const html = readFileSync(
      join(__dirname, '..', 'views', 'pdf.hbs'),
      'utf8',
    );
    const pdfBuffer = await pdf.create(
      {
        html: html,
        data: pdfData,
        type: 'buffer',
      },
      options,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=timetable.pdf');
    return res.end(pdfBuffer);
  }
}
