export type ZoneId =
  | "theater"
  | "basement"
  | "electrical"
  | "mannequin"
  | "orchestra"
  | "costume"
  | "archive"
  | "wasteland"
  | "desert"
  | "roof"
  | "outdoors"
  | "rooms"
  | "alleys"
  | "secret_makeup"
  | "secret_storage"
  | "secret_director"
  | "secret_mirror";

export type RoomKind =
  | "foyer"
  | "hall"
  | "corridor"
  | "dressing"
  | "stage"
  | "storage"
  | "basement"
  | "archive"
  | "electric"
  | "park"
  | "light"
  | "dark"
  | "desert"
  | "waste"
  | "roof"
  | "secret";

export interface ZoneDef {
  id: ZoneId;
  title: string;
  rooms: string[];
  kind: RoomKind;
  palette: {
    floor: string;
    wall: string;
    trim: string;
    carpet: string;
  };
}

export const THEATER_ROOMS = [
  "Вход",
  "Фойе",
  "Гардероб",
  "Коридор",
  "Гримёрка",
  "Сцена",
  "За сценой",
  "Кладовая",
  "Коридор",
  "Балкон",
  "Зрительный зал",
  "Подсобка",
  "Лестница",
  "Подвал",
  "Архив",
  "Электрощитовая",
  "Тоннель",
  "Старые декорации",
  "Репетиционная",
  "Гримёрка №2",
  "Малый зал",
  "Кулисы",
  "Главный зал",
  "Выходной коридор",
  "Техническая",
  "Длинный коридор",
  "Зал ожидания",
  "Кабинет режиссёра",
  "Склад костюмов",
  "Верхний ярус",
  "Узкий проход",
  "Чёрная комната",
  "Зеркальный зал",
  "Пустая сцена",
  "Запасной выход",
  "Коридор к люку",
  "Подсобка №2",
  "Старая лестница",
  "Предпарковая",
  "Люк наружу",
  "Потерянный ярус",
  "Зал без названия",
  "Коридор, которого не было",
  "Гримёрка призраков",
  "Склад забытых ролей",
  "Чёрный проход",
  "Зал аплодисментов",
  "Комната суфлёра",
  "Последняя кулиса",
  "Светящаяся дверь",
];

export const ZONES: Record<ZoneId, ZoneDef> = {
  theater: {
    id: "theater",
    title: "Театр «Этерния»",
    rooms: THEATER_ROOMS,
    kind: "foyer",
    palette: { floor: "#241810", wall: "#3a2818", trim: "#5a4028", carpet: "#4a1818" },
  },
  basement: {
    id: "basement",
    title: "Подвал",
    rooms: [
      "Спуск",
      "Трубы",
      "Сырой зал",
      "Котельная",
      "Затопленный коридор",
      "Камера хранения",
      "Потолочный грот",
      "Тупик смотрителя",
    ],
    kind: "basement",
    palette: { floor: "#1a1610", wall: "#2a2418", trim: "#3a3020", carpet: "#1c1810" },
  },
  electrical: {
    id: "electrical",
    title: "Электрощитовая",
    rooms: [
      "Щитовая",
      "Кабель-канал",
      "Искрящий зал",
      "Рубильники",
      "Трансформаторная",
      "Дверь в переулки",
    ],
    kind: "electric",
    palette: { floor: "#161410", wall: "#241c14", trim: "#4a3a18", carpet: "#1a1810" },
  },
  mannequin: {
    id: "mannequin",
    title: "Зал манекенов",
    rooms: [
      "Преддверие кукол",
      "Ряд лиц",
      "Зал неподвижных",
      "Гардероб манекенов",
      "Поворот голов",
      "Тишина",
      "Последняя витрина",
    ],
    kind: "dressing",
    palette: { floor: "#221810", wall: "#3a2a1c", trim: "#6a5030", carpet: "#3a2018" },
  },
  orchestra: {
    id: "orchestra",
    title: "Оркестровая яма",
    rooms: ["Спуск к яме", "Пюпитры", "Литавры", "Тёмная яма", "Нечто снизу"],
    kind: "hall",
    palette: { floor: "#1a100c", wall: "#2a1810", trim: "#4a3020", carpet: "#2a1010" },
  },
  costume: {
    id: "costume",
    title: "Костюмерная Вечности",
    rooms: [
      "Вешалки",
      "Атлас и пыль",
      "Маски",
      "Королевский костюм",
      "Детские роли",
      "Плащи",
      "Швейный стол",
      "Зеркала примерок",
      "Вечный манекен",
    ],
    kind: "dressing",
    palette: { floor: "#261810", wall: "#3a2418", trim: "#7a5030", carpet: "#4a2018" },
  },
  archive: {
    id: "archive",
    title: "Архив шёпотов",
    rooms: [
      "Каталог",
      "Полки афиш",
      "Зал рецензий",
      "Голоса в картотеке",
      "Запрещённый ящик",
      "Читальный шёпот",
    ],
    kind: "archive",
    palette: { floor: "#20180e", wall: "#322414", trim: "#5a4020", carpet: "#2a1c10" },
  },
  wasteland: {
    id: "wasteland",
    title: "Ночная пустошь",
    rooms: [
      "Край поля",
      "Сухие стебли",
      "Одинокий фонарь",
      "Каменный круг",
      "Чёрная борозда",
      "Сгоревший сарай",
      "Туманная лощина",
      "Вороний столб",
      "Безымянная тропа",
      "Дверь в траве",
    ],
    kind: "waste",
    palette: { floor: "#14120c", wall: "#1c1a12", trim: "#3a3420", carpet: "#18160e" },
  },
  desert: {
    id: "desert",
    title: "Нереальная пустыня",
    rooms: [
      "Песок в фойе",
      "Дюны кресел",
      "Мираж кулис",
      "Костяной оркестр",
      "Сухой фонтан",
      "Оазис афиш",
      "Двойное солнце",
      "Дверь из миража",
    ],
    kind: "desert",
    palette: { floor: "#3a2a14", wall: "#4a3418", trim: "#8a6a30", carpet: "#5a4018" },
  },
  roof: {
    id: "roof",
    title: "Крыша под дождём",
    rooms: ["Выход на кровлю", "Водостоки", "Флюгер", "Чердак дождя"],
    kind: "roof",
    palette: { floor: "#1a1c20", wall: "#242830", trim: "#4a5060", carpet: "#1c2028" },
  },
  outdoors: {
    id: "outdoors",
    title: "Парк Outdoors",
    rooms: [
      "Люк в парк",
      "Заросшая аллея",
      "Разбитый фонтан",
      "Будка кассира",
      "Детская карусель",
      "Оранжерея",
      "Железный мост",
      "Живая изгородь",
      "Беседка",
      "Пруд без дна",
      "Статуя зрителя",
      "Тёмная роща",
      "Последняя аллея",
      "Ворота полиции",
    ],
    kind: "park",
    palette: { floor: "#1a2214", wall: "#24301c", trim: "#3a4a28", carpet: "#1c2818" },
  },
  rooms: {
    id: "rooms",
    title: "Светлые комнаты",
    rooms: ["Белый коридор", "Тихая гостиная", "Окно наружу", "Чайный стол", "Выход в день"],
    kind: "light",
    palette: { floor: "#d8d0c0", wall: "#ece6d8", trim: "#c0b090", carpet: "#e8e0d0" },
  },
  alleys: {
    id: "alleys",
    title: "The Dark Alleys",
    rooms: [
      "Чёрный переулок",
      "Подвал генератора",
      "Кабельный тупик",
      "Склад батарей",
      "Руль света",
    ],
    kind: "dark",
    palette: { floor: "#0a0806", wall: "#120e0a", trim: "#2a2010", carpet: "#080604" },
  },
  secret_makeup: {
    id: "secret_makeup",
    title: "Тайная гримёрка",
    rooms: ["Грязная секретная"],
    kind: "secret",
    palette: { floor: "#1a1208", wall: "#2a1c10", trim: "#4a3018", carpet: "#241808" },
  },
  secret_storage: {
    id: "secret_storage",
    title: "Скрытый склад",
    rooms: ["Скрытый склад"],
    kind: "secret",
    palette: { floor: "#18140c", wall: "#282018", trim: "#4a3820", carpet: "#20180c" },
  },
  secret_director: {
    id: "secret_director",
    title: "Кабинет режиссёра",
    rooms: ["Секрет режиссёра"],
    kind: "secret",
    palette: { floor: "#1c120c", wall: "#2c1a10", trim: "#6a4020", carpet: "#3a1810" },
  },
  secret_mirror: {
    id: "secret_mirror",
    title: "Зеркальная ловушка",
    rooms: ["Ложный выход"],
    kind: "secret",
    palette: { floor: "#181820", wall: "#242430", trim: "#5a5a70", carpet: "#1c1c28" },
  },
};

export interface NoteDef {
  id: string;
  zone: ZoneId;
  room: number;
  title: string;
  text: string;
}

export const NOTES: NoteDef[] = [
  {
    id: "n1",
    zone: "theater",
    room: 1,
    title: "Дневник актёра",
    text: "Свет погас на третьем акте. Мы слышали шаги за кулисами. Режиссёр сказал не выходить из роли. Мы до сих пор не вышли.",
  },
  {
    id: "n2",
    zone: "theater",
    room: 4,
    title: "Записка гримёра",
    text: "За зеркалом есть ход. Люк внизу заперт. Ищи лом в подсобке. Если услышишь своё имя — не оборачивайся.",
  },
  {
    id: "n3",
    zone: "theater",
    room: 7,
    title: "Обрывок афиши",
    text: "«Последний зритель». Премьера отменена. Зрители не ушли. Театр продолжает играть без нас — и с нами.",
  },
  {
    id: "n4",
    zone: "theater",
    room: 11,
    title: "Инструкция смотрителя",
    text: "Лом лежит в подсобке. Им открывают люк у сороковой двери. Без лома парк не пустит. Не оставляй инструмент на сцене.",
  },
  {
    id: "n5",
    zone: "theater",
    room: 13,
    title: "Запись смотрителя",
    text: "В подвале слышен шёпот. Батареи садятся быстрее. Нечто ползает по трубам. Не стой долго под люком в потолке.",
  },
  {
    id: "n6",
    zone: "theater",
    room: 17,
    title: "Предупреждение",
    text: "Картонные декорации ожили. Если начнут расползаться — беги к двери. Не трогай красную краску: это не краска.",
  },
  {
    id: "n7",
    zone: "theater",
    room: 21,
    title: "Записка режиссёра",
    text: "Сорок дверей. Одна ведёт наружу. Остальные — внутрь. Если пропустишь люк, театр допишет тебе ещё десять комнат.",
  },
  {
    id: "n8",
    zone: "theater",
    room: 24,
    title: "Лист суфлёра",
    text: "Когда лампы мигают — прячься. Бладза не видит закрытых. Не стой в проходе. Не дыши, пока она не пролетит.",
  },
  {
    id: "n9",
    zone: "theater",
    room: 27,
    title: "Черновик",
    text: "Хэрш поднимается около тридцатой. Чёрная жижа с глазами. Беги вперёд. Люстры падают. Не смотри вниз.",
  },
  {
    id: "n10",
    zone: "theater",
    room: 32,
    title: "Осколок зеркала",
    text: "В зеркальном зале не доверяй отражению двери. Настоящая справа, если считать от сердца. Ложная заберёт тебя в петлю.",
  },
  {
    id: "n11",
    zone: "theater",
    room: 38,
    title: "Билет в парк",
    text: "Люк наружу. Нужен лом. Дальше — парк, который театр когда-то построил для антракта. Теперь там летает Xillie. Прячься в будках.",
  },
  {
    id: "n12",
    zone: "basement",
    room: 2,
    title: "Влажный лист",
    text: "Оно на потолке. Смотри вверх, когда капает. Если тень от трубы шевелится без ветра — не проходи под ней.",
  },
  {
    id: "n13",
    zone: "electrical",
    room: 4,
    title: "Схема щита",
    text: "Переулки за последней дверью щитовой. Пятнадцать энерготехнологических батарей. Генератор вернёт театру часть света.",
  },
  {
    id: "n14",
    zone: "archive",
    room: 3,
    title: "Рецензия",
    text: "Спектакль смотрит обратно. Голоса в архиве комментируют каждый шаг. Не отвечай им. Они записывают тебя в состав.",
  },
  {
    id: "n15",
    zone: "outdoors",
    room: 3,
    title: "Объявление парка",
    text: "Xillie патрулирует аллеи. Сигнал — прячься в будку или шкаф. Касание — конец. Ворота в конце парка ведут к людям.",
  },
  {
    id: "n16",
    zone: "costume",
    room: 4,
    title: "Ярлык",
    text: "Костюмы сами надеваются. Если ткань липнет к плечам — сорви её. Вечность любит актёров в своих платьях.",
  },
  {
    id: "n17",
    zone: "rooms",
    room: 0,
    title: "Белая записка",
    text: "Здесь безопасно. Театр не достаёт сюда. Пять комнат света. Ты выбрал не парк — и всё же выход есть.",
  },
];

export const WHISPERS = [
  "Он идёт дальше.",
  "Он боится темноты.",
  "Он читает нас.",
  "Не тот вход.",
  "Свет выдаёт его.",
  "Прячется, как статист.",
  "Лом уже чей-то.",
  "Дверь считает шаги.",
  "Новый актёр.",
  "Не аплодируй.",
];

export const ACHIEVEMENTS: { id: string; title: string; hint: string }[] = [
  { id: "first_door", title: "Антракт отменён", hint: "Пройти первую дверь" },
  { id: "crowbar", title: "Инструмент смотрителя", hint: "Найти лом" },
  { id: "bloodza", title: "Пропустила", hint: "Пережить Бладзу" },
  { id: "hersh", title: "Не смотри вниз", hint: "Пережить Хэрша" },
  { id: "secret_makeup", title: "Грязный ход", hint: "Тайная гримёрка" },
  { id: "secret_storage", title: "Схрон", hint: "Скрытый склад" },
  { id: "secret_director", title: "Черновик мира", hint: "Секрет режиссёра" },
  { id: "secret_mirror", title: "Не то отражение", hint: "Зеркальная ловушка" },
  { id: "basement", title: "Сырость", hint: "Пройти подвал" },
  { id: "outdoors", title: "К людям", hint: "Концовка парка" },
  { id: "rooms", title: "Светлая комната", hint: "Пять светлых комнат" },
  { id: "alleys", title: "Генератор", hint: "Запустить генератор" },
  { id: "notes", title: "Суфлёр", hint: "Собрать все записки" },
];

export function zoneRoomCount(zone: ZoneId): number {
  return ZONES[zone].rooms.length;
}

export function roomName(zone: ZoneId, index: number): string {
  return ZONES[zone].rooms[index] ?? "Безымянная";
}

export function kindForTheater(index: number): RoomKind {
  const n = THEATER_ROOMS[index] ?? "";
  if (/зал|сцен|зрител|балкон|кулис/i.test(n)) return "hall";
  if (/грим|костюм|гардероб/i.test(n)) return "dressing";
  if (/коридор|тоннел|лестниц|проход|выход/i.test(n)) return "corridor";
  if (/подсоб|кладов|склад|технич/i.test(n)) return "storage";
  if (/подвал/i.test(n)) return "basement";
  if (/архив|кабинет/i.test(n)) return "archive";
  if (/электро/i.test(n)) return "electric";
  if (/фойе|вход|ожидан/i.test(n)) return "foyer";
  return "foyer";
}
