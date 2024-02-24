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
  breakBefore: {
    formatted: string
    minutes: number
  }
};

export type TimeTableDayType = {
  hours: {
    start: string;
    end: string;
  };
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
    filters: string
  };
};

export type OtherData = {
  groups: {
    name: string;
    active: boolean;
  }[]
}

export type TLesson = {
  id_g: string
  godz: string
  min: string
  pz_data_od: string
  licznik_g: string
  tytul_naukowy_nazwa: string
  imie: string
  nazwisko: string
  p_nazwa: string
  spec: string
  bs_nazwa: string
  fz_nazwa: string
  u_nazwa: string
}

export type TTimetableResponse = TLesson[]
