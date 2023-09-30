import { HttpService } from '@nestjs/axios';
import { Injectable, StreamableFile } from '@nestjs/common';
import { parse } from 'node-html-parser';
import * as crawler from 'crawler-request';
import { FiltersType, TimeTableDayType, TimeTableType } from './types/timetable';
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';
import * as pdf from 'pdf-creator-node';
import { Response } from 'express';

const timetableUrl =
  'https://www.ur.edu.pl/pl/kolegia/kolegium-nauk-spolecznych/student/kierunki-studiow-programy-rozklady-sylabusy/pedagogika/rozklady-zajec';

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

const findRowsAndGetValues = (text) => {
  const trimedText = text.trim().replaceAll(/\n/g, '');
  const regex =
    /(\d{1,2}:\d{1,2})(\d{1,2}:\d{1,2})((?:(?!ul\.)[\p{L} -\.])+)((?:ul\. ?[\p{L} -\.]+ ?)?\d+)([\p{L} \.]+ ([\p{L}]+\. )(\d|OA(?: Orlof)?))(ćw\.|war\.|lektorat|wykład)/gmu;
  let matches;
  const results = [];

  while ((matches = regex.exec(trimedText)) !== null) {
    const boundaryIndex = matches[3].lastIndexOf(
      matches[3].match(/[a-z][A-Z]/g)?.pop() || '',
    );
    const location = matches[4].startsWith('ul.')
      ? matches[4].split(/(ul\.[\p{L} -\.]+)/u).join(' ')
      : matches[4];

    results.push({
      start: matches[1],
      end: matches[2],
      subject:
        boundaryIndex !== -1 ? matches[3].slice(boundaryIndex + 1) : matches[3],
      teacher:
        boundaryIndex !== -1
          ? matches[3].slice(0, boundaryIndex + 1)
          : matches[3],
      room: location,
      group: matches[5],
      groupType: ['ćw. ', 'war. '].includes(matches[6]) ? matches[6] : '',
      groupNumber: matches[7],
      type: matches[8],
    });
  }
  return results;
};

const getWeekDays = (text) => {
  const weekSchedule = {};
  for (const dayIndex in weekdays) {
    const day = weekdays[dayIndex];
    if (parseInt(dayIndex) === 0) {
      weekSchedule[day] = findRowsAndGetValues(
        getSubstringBetween(text, 'Uwagi', weekdays[weekdays.indexOf(day) + 1]),
      );
    } else if (parseInt(dayIndex) === weekdays.length - 1) {
      weekSchedule[day] = findRowsAndGetValues(getSubstringFrom(text, day));
    } else {
      weekSchedule[day] = findRowsAndGetValues(
        getSubstringBetween(text, day, weekdays[weekdays.indexOf(day) + 1]),
      );
    }
  }
  return weekSchedule;
};

const weekdays = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

function parseSchedule(text) {
  const timetable = {
    weekA: getWeekDays(getSubstringBetween(text, 'Tydzień A', 'Tydzień B')),
    weekB: getWeekDays(getSubstringFrom(text, 'Tydzień B')),
  };
  // console.log(timetable.weekA);
  return timetable;
}

function filterClassesByGroup(
  timeTable: TimeTableType,
  exerciseGroup: number,
  workshopGroup: number,
): TimeTableType {
  const filterDay = (day: TimeTableDayType[]): TimeTableDayType[] => {
    return day.filter(
      (item) =>
        (!exerciseGroup && !workshopGroup) ||
        (item.groupType === 'ćw. ' &&
          Number(item.groupNumber) === Number(exerciseGroup)) ||
        (item.groupType === 'war. ' &&
          Number(item.groupNumber) === Number(workshopGroup)) ||
        !['ćw. ', 'war. '].includes(item.groupType),
    );
  };

  const filteredTimeTable: TimeTableType = {
    weekA: {
      Poniedziałek: filterDay(timeTable.weekA.Poniedziałek),
      Wtorek: filterDay(timeTable.weekA.Wtorek),
      Środa: filterDay(timeTable.weekA.Środa),
      Czwartek: filterDay(timeTable.weekA.Czwartek),
      Piątek: filterDay(timeTable.weekA.Piątek),
    },
    weekB: {
      Poniedziałek: filterDay(timeTable.weekB.Poniedziałek),
      Wtorek: filterDay(timeTable.weekB.Wtorek),
      Środa: filterDay(timeTable.weekB.Środa),
      Czwartek: filterDay(timeTable.weekB.Czwartek),
      Piątek: filterDay(timeTable.weekB.Piątek),
    },
  };

  return filteredTimeTable;
}

const options = {
  format: 'Legal',
  orientation: 'landscape',
  border: '10mm',
};

@Injectable()
export class AppService {
  constructor(private readonly httpService: HttpService) {}

  async getTimeTable(
    exerciseGroup: number,
    workshopGroup: number,
  ): Promise<TimeTableType & FiltersType> {
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
    const results = parseSchedule(response.text) as TimeTableType;

    return {...filterClassesByGroup(results, exerciseGroup, workshopGroup), filters: {exerciseGroup, workshopGroup}};
  }

  async generatePdf(
    res: Response,
    exerciseGroup: number,
    workshopGroup: number,
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
    const results = parseSchedule(response.text) as TimeTableType;

    const pdfData = filterClassesByGroup(results, exerciseGroup, workshopGroup);
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
