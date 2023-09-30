export type TimeTableDayType = {
  start: string;
  end: string;
  subject: string;
  teacher: string;
  room: string;
  group: string;
  groupType: string;
  groupNumber: string;
  type: string;
};

export type TimeTableWeekType = {
  Poniedziałek: TimeTableDayType[];
  Wtorek: TimeTableDayType[];
  Środa: TimeTableDayType[];
  Czwartek: TimeTableDayType[];
  Piątek: TimeTableDayType[];
};

export type TimeTableType = {
  weekA: TimeTableWeekType;
  weekB: TimeTableWeekType;
};

export type FiltersType = {
  filters: {
    exerciseGroup?: number;
    workshopGroup?: number;
  }
}