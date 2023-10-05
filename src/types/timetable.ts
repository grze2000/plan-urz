export type ClassesType = {
  start: string;
  end: string;
  subject: string;
  teacher: string;
  room: string;
  group: string;
  groupType: string;
  groupNumber: string;
  type: string;
  color: {
    background: string;
    border: string;
  }
};

export type TimeTableDayType = {
  hours: string;
  classes: ClassesType[];
};

export type TimeTableWeekType = {
  Poniedziałek: TimeTableDayType;
  Wtorek: TimeTableDayType;
  Środa: TimeTableDayType;
  Czwartek: TimeTableDayType;
  Piątek: TimeTableDayType;
};

export type TimeTableType = {
  weekA: TimeTableWeekType;
  weekB: TimeTableWeekType;
};

export type FiltersType = {
  filters: {
    exerciseGroup?: number;
    workshopGroup?: number;
  };
};

export type OtherData = {
  exerciseGroups: Array<{
    active: boolean;
  }>;
  workshopGroups: Array<{
    active: boolean;
  }>;
}