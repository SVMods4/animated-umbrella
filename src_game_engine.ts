import {
  ACHIEVEMENTS,
  NOTES,
  WHISPERS,
  ZONES,
  kindForTheater,
  roomName,
  zoneRoomCount,
  type RoomKind,
  type ZoneId,
} from "./data";
import {
  resumeIfNeeded,
  setVolume,
  sfxBloodza,
  sfxClick,
  sfxDeath,
  sfxDoor,
  sfxFootstep,
  sfxHide,
  sfxHurt,
  sfxPickup,
  sfxWarn,
  sfxWin,
  sfxXillie,
  startAmbient,
  stopAmbient,
  unlockAudio,
} from "./audio";
import { ui, type Screen, type WinKind } from "./store";

const SAVE_KEY = "theater_shadows_v3";
const SETTINGS_KEY = "ts_settings_v3";
const META_KEY = "ts_meta_v3";
const SAVE_VERSION = 3;

type EntityType =
  | "chaser"
  | "photophobe"
  | "hider"
  | "roomguard"
  | "rare"
  | "cardboard"
  | "mannequin"
  | "crawler"
  | "costume"
  | "bloodza"
  | "xillie"
  | "orchestra"
  | "spark";

interface Prop {
  type: "chair" | "cabinet" | "crate" | "table" | "mirror" | "booth" | "tree" | "pipe" | "bench" | "poster" | "lamppost";
  x: number;
  y: number;
  r: number;
  hideable: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  s: number;
}

interface Entity {
  type: EntityType;
  x: number;
  y: number;
  r: number;
  alive: boolean;
  timer: number;
  state: string;
  speed: number;
  alpha: number;
  warn: boolean;
  tx: number;
  ty: number;
  attached?: boolean;
}

interface Room {
  zone: ZoneId;
  index: number;
  name: string;
  kind: RoomKind;
  w: number;
  h: number;
  exitX: number;
  exitY: number;
  enterX: number;
  enterY: number;
  locked: boolean;
  props: Prop[];
  floorPattern: number;
  special: string | null;
  pal: { floor: string; wall: string; trim: string; carpet: string };
  keyX?: number;
  keyY?: number;
  crowbarX?: number;
  crowbarY?: number;
  batteryX?: number;
  batteryY?: number;
  hatchX?: number;
  hatchY?: number;
  portal?: { zone: ZoneId; x: number; y: number; label: string };
  extraDoor?: { x: number; y: number; label: string; fake?: boolean };
  notes: { x: number; y: number; id: string; title: string; text: string; taken: boolean }[];
  tech: { x: number; y: number; taken: boolean }[];
  generator?: { x: number; y: number };
  lampX: number;
  lampY: number;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseSpeed: number;
  health: number;
  battery: number;
  flashlight: boolean;
  angle: number;
  invuln: number;
  hiding: boolean;
  crouch: boolean;
  walkFrame: number;
  walkTimer: number;
  moving: boolean;
  costumeSlow: number;
}

interface SaveBlob {
  version: number;
  seed: number;
  zone: ZoneId;
  room: number;
  health: number;
  battery: number;
  keys: number;
  hasKey: boolean;
  hasCrowbar: boolean;
  notesFound: string[];
  secretsFound: string[];
  techBatteries: number;
  generatorOn: boolean;
  crowbarTaken: boolean;
  returnTo: { zone: ZoneId; room: number } | null;
}

interface MetaBlob {
  version: number;
  achievements: string[];
}

interface SettingsBlob {
  brightness: number;
  sens: number;
  difficulty: number;
  volume: number;
}

const Settings: SettingsBlob = { brightness: 1.15, sens: 1, difficulty: 1, volume: 0.7 };

const input = { mx: 0, my: 0, joy: false };
const held = new Set<string>();
let forcedKeys: string[] | null = null;

const G = {
  screen: "title" as Screen,
  seed: 1,
  zone: "theater" as ZoneId,
  room: 0,
  returnTo: null as { zone: ZoneId; room: number } | null,
  player: null as Player | null,
  entities: [] as Entity[],
  roomData: null as Room | null,
  fog: [] as { x: number; y: number; r: number; a: number; vx: number; vy: number }[],
  particles: [] as Particle[],
  time: 0,
  messageTimer: 0,
  shake: 0,
  warning: 0,
  keys: 0,
  hasKey: false,
  hasCrowbar: false,
  notesFound: [] as string[],
  secretsFound: [] as string[],
  techBatteries: 0,
  generatorOn: false,
  crowbarTaken: false,
  meatFlood: 0,
  meatActive: false,
  bloodza: "idle" as "idle" | "warn" | "rush" | "done",
  bloodzaT: 0,
  bloodzaX: 0,
  lampFlicker: 1,
  hershX: -120,
  chandeliers: [] as { x: number; y: number; vy: number; alive: boolean }[],
  xillie: "idle" as "idle" | "warn" | "rush" | "done",
  xillieT: 0,
  xillieX: 0,
  xillieY: 0,
  winKind: null as WinKind,
  creditsY: 0,
  rumble: 0,
  whisperT: 0,
};

let meta: MetaBlob = { version: 1, achievements: [] };
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let W = 800;
let H = 600;
let raf = 0;
let last = 0;
let running = false;
let stepAcc = 0;
const STEP = 1 / 60;
let footCd = 0;
let backdropRoom: Room | null = null;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rand(rng: () => number, a: number, b: number) {
  return a + rng() * (b - a);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<SettingsBlob>;
    if (s.brightness) Settings.brightness = +s.brightness;
    if (s.sens) Settings.sens = +s.sens;
    if (s.difficulty) Settings.difficulty = +s.difficulty;
    if (s.volume != null) Settings.volume = +s.volume;
  } catch {
    /* ignore */
  }
  setVolume(Settings.volume);
  ui.set({ ...Settings });
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(Settings));
  } catch {
    /* ignore */
  }
}

function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || "null") as MetaBlob | null;
    if (m?.achievements) meta = { version: 1, achievements: m.achievements };
  } catch {
    meta = { version: 1, achievements: [] };
  }
  ui.set({ achievements: meta.achievements });
}

function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function achieve(id: string) {
  if (meta.achievements.includes(id)) return;
  meta.achievements.push(id);
  saveMeta();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  showMsg(a ? `Достижение: ${a.title}` : "Достижение");
  ui.set({ achievements: meta.achievements.slice() });
}

function saveGame() {
  if (!G.player) return;
  const blob: SaveBlob = {
    version: SAVE_VERSION,
    seed: G.seed,
    zone: G.zone,
    room: G.room,
    health: G.player.health,
    battery: G.player.battery,
    keys: G.keys,
    hasKey: G.hasKey,
    hasCrowbar: G.hasCrowbar,
    notesFound: G.notesFound,
    secretsFound: G.secretsFound,
    techBatteries: G.techBatteries,
    generatorOn: G.generatorOn,
    crowbarTaken: G.crowbarTaken,
    returnTo: G.returnTo,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    localStorage.setItem(SAVE_KEY + "_bak", JSON.stringify(blob));
  } catch {
    /* ignore */
  }
  ui.set({ hasSave: true });
}

function loadSave(): SaveBlob | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as SaveBlob | null;
    if (!raw) return null;
    if (raw.version !== SAVE_VERSION) return raw;
    return raw;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY + "_bak") || "null");
    } catch {
      return null;
    }
  }
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY + "_bak");
  ui.set({ hasSave: false });
}

function showMsg(t: string) {
  G.messageTimer = 2.4;
  ui.set({ message: t });
}

function setScreen(s: Screen) {
  G.screen = s;
  ui.set({ screen: s });
}

function ambientFor(zone: ZoneId) {
  if (zone === "outdoors" || zone === "wasteland") startAmbient("park");
  else if (zone === "roof") startAmbient("roof");
  else if (zone === "rooms") startAmbient("light");
  else if (zone === "alleys") startAmbient("dark");
  else if (zone === "electrical") startAmbient("electric");
  else startAmbient("theater");
}

function makePlayer(x: number, y: number): Player {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    r: 13,
    baseSpeed: 175,
    health: 100,
    battery: 100,
    flashlight: false,
    angle: 0,
    invuln: 0,
    hiding: false,
    crouch: false,
    walkFrame: 0,
    walkTimer: 0,
    moving: false,
    costumeSlow: 0,
  };
}

function kindOf(zone: ZoneId, index: number): RoomKind {
  if (zone === "theater") return kindForTheater(index);
  return ZONES[zone].kind;
}

function generateRoom(zone: ZoneId, index: number): Room {
  const rng = mulberry(G.seed ^ (hashStr(zone) + index * 9973));
  const z = ZONES[zone];
  const kind = kindOf(zone, index);
  let w = 560 + Math.floor(rng() * 90);
  let h = 440 + Math.floor(rng() * 60);
  if (kind === "corridor") {
    w = 720 + Math.floor(rng() * 80);
    h = 360;
  }
  if (zone === "outdoors" || zone === "wasteland" || zone === "desert") {
    w = 780 + Math.floor(rng() * 80);
    h = 560 + Math.floor(rng() * 40);
  }
  if (zone === "secret_makeup" || zone === "secret_storage" || zone === "secret_director" || zone === "secret_mirror") {
    w = 400;
    h = 340;
  }
  const hersh = zone === "theater" && index === 29;
  if (hersh) {
    w = 1680;
    h = 420;
  }
  const pal = { ...z.palette };
  if (zone === "theater" && index >= 40) {
    pal.floor = "#1a1018";
    pal.wall = "#2a1824";
    pal.trim = "#5a3048";
    pal.carpet = "#3a1020";
  }
  const room: Room = {
    zone,
    index,
    name: roomName(zone, index),
    kind,
    w,
    h,
    exitX: w - 48,
    exitY: h / 2,
    enterX: 48,
    enterY: h / 2,
    locked: false,
    props: [],
    floorPattern: index % 4,
    special: null,
    pal,
    notes: [],
    tech: [],
    lampX: w / 2,
    lampY: 36,
  };
  if (hersh) room.special = "hersh";
  if (zone === "theater" && index === 17) room.special = "cardboard";
  if (zone === "theater" && index >= 24 && index <= 34 && index !== 29) room.special = "bloodza";
  if (zone === "outdoors" && [2, 5, 8, 11].includes(index)) room.special = "xillie";
  if (zone === "theater" && (index % 5 === 0 || index === 11 || index === 23 || index === 36) && index > 0 && !hersh) {
    room.locked = rng() < 0.8;
  }
  if (zone === "alleys") room.locked = false;

  const scatter = (n: number, type: Prop["type"], hideable: boolean, r: number) => {
    for (let i = 0; i < n; i++) {
      room.props.push({
        type,
        x: 80 + rng() * (w - 160),
        y: 70 + rng() * (h - 140),
        r,
        hideable,
      });
    }
  };

  if (kind === "hall" || kind === "stage") {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 6; col++)
        room.props.push({
          type: "chair",
          x: 100 + col * 70 + (row % 2) * 16,
          y: 80 + row * 54,
          r: 16,
          hideable: true,
        });
  } else if (kind === "dressing") {
    for (let i = 0; i < 4; i++) room.props.push({ type: "cabinet", x: 80 + i * 100, y: 72, r: 20, hideable: true });
    room.props.push({ type: "mirror", x: w - 70, y: 90, r: 18, hideable: false });
  } else if (kind === "storage" || kind === "basement" || kind === "archive" || kind === "secret") {
    scatter(5, "crate", true, 18);
    scatter(2, "cabinet", true, 20);
  } else if (kind === "park") {
    scatter(5, "tree", false, 22);
    scatter(3, "bench", false, 16);
    scatter(3, "booth", true, 22);
    scatter(2, "lamppost", false, 10);
  } else if (kind === "waste") {
    scatter(4, "tree", false, 20);
    scatter(2, "crate", true, 18);
    scatter(1, "booth", true, 22);
  } else if (kind === "desert") {
    scatter(3, "crate", true, 16);
    scatter(2, "bench", false, 16);
  } else if (kind === "roof") {
    scatter(3, "pipe", false, 14);
    scatter(2, "crate", true, 18);
  } else if (kind === "electric" || kind === "dark") {
    scatter(4, "crate", true, 18);
    scatter(2, "cabinet", true, 20);
  } else if (kind === "light") {
    scatter(2, "table", false, 18);
    scatter(2, "chair", true, 14);
  } else {
    scatter(3, "table", false, 20);
    scatter(2, "poster", false, 12);
    scatter(1, "cabinet", true, 20);
  }

  if (room.special === "bloodza" || room.special === "xillie") {
    const hides = room.props.filter((p) => p.hideable).length;
    if (hides < 2) {
      room.props.push({ type: "cabinet", x: w * 0.35, y: h * 0.3, r: 20, hideable: true });
      room.props.push({ type: "cabinet", x: w * 0.65, y: h * 0.7, r: 20, hideable: true });
    }
  }

  if (room.locked && rng() < 0.85) {
    room.keyX = 90 + rng() * (w - 180);
    room.keyY = 90 + rng() * (h - 180);
  }
  if ((zone === "theater" && (index === 11 || index === 24) && !G.crowbarTaken) || (zone === "theater" && index === 36 && !G.crowbarTaken)) {
    room.crowbarX = 100 + rng() * (w - 200);
    room.crowbarY = 100 + rng() * (h - 200);
  }
  if (rng() < 0.42 || zone === "alleys" || index === 13) {
    room.batteryX = 50 + rng() * (w - 100);
    room.batteryY = 50 + rng() * (h - 100);
  }
  if (zone === "theater" && index === 39) {
    room.hatchX = w / 2;
    room.hatchY = h - 70;
  }
  if (zone === "theater" && index === 4) {
    room.portal = { zone: "secret_makeup", x: w - 58, y: 78, label: "?" };
  }
  if (zone === "theater" && index === 7) {
    room.portal = { zone: "secret_storage", x: 70, y: h - 70, label: "склон" };
  }
  if (zone === "theater" && index === 27) {
    room.portal = { zone: "secret_director", x: w - 64, y: 80, label: "черновик" };
  }
  if (zone === "theater" && index === 32) {
    room.extraDoor = { x: w / 2, y: 48, label: "отражение", fake: true };
    room.portal = { zone: "secret_mirror", x: w / 2 + 80, y: 48, label: "стекло" };
  }
  if (zone === "theater" && index === 13) {
    room.portal = { zone: "basement", x: w / 2, y: h - 58, label: "в подвал" };
  }
  if (zone === "theater" && index === 15) {
    room.portal = { zone: "electrical", x: w - 70, y: h - 70, label: "щит" };
  }
  if (zone === "theater" && index === 10) {
    room.portal = { zone: "orchestra", x: w / 2, y: h - 54, label: "в яму" };
  }
  if (zone === "theater" && index === 14) {
    room.portal = { zone: "archive", x: 64, y: 70, label: "архив" };
  }
  if (zone === "theater" && index === 28) {
    room.portal = { zone: "mannequin", x: w - 70, y: 80, label: "манекены" };
    room.extraDoor = { x: 70, y: 80, label: "костюмы" };
  }
  if (zone === "theater" && index === 31) {
    room.portal = { zone: "wasteland", x: w / 2, y: 54, label: "пустошь" };
  }
  if (zone === "theater" && index === 33) {
    room.portal = { zone: "desert", x: w / 2, y: h - 58, label: "песок" };
  }
  if (zone === "theater" && index === 37) {
    room.portal = { zone: "roof", x: w / 2, y: 54, label: "крыша" };
  }
  if (zone === "electrical" && index === 5) {
    room.portal = { zone: "alleys", x: w - 60, y: h / 2, label: "переулки" };
  }
  if (zone === "mannequin" && index === 6) {
    room.extraDoor = { x: w / 2, y: 50, label: "вечность" };
  }
  if (zone === "secret_makeup") {
    room.hatchX = w / 2;
    room.hatchY = h - 64;
    room.locked = true;
  }
  if (zone === "alleys") {
    for (let i = 0; i < 3; i++) room.tech.push({ x: 70 + rng() * (w - 140), y: 70 + rng() * (h - 140), taken: false });
    if (index === 4) room.generator = { x: w / 2, y: h / 2 };
  }
  if (zone === "desert") {
    room.extraDoor = { x: w * 0.3, y: h * 0.35, label: "мираж", fake: true };
  }
  if (zone === "secret_mirror") {
    room.extraDoor = { x: w * 0.3, y: h / 2, label: "ложная", fake: true };
  }

  const note = NOTES.find((n) => n.zone === zone && n.room === index);
  if (note && !G.notesFound.includes(note.id)) {
    room.notes.push({
      x: 80 + rng() * (w - 160),
      y: 80 + rng() * (h - 160),
      id: note.id,
      title: note.title,
      text: note.text,
      taken: false,
    });
  }
  return room;
}

function spawnEntities(room: Room) {
  G.entities = [];
  G.meatFlood = 0;
  G.meatActive = false;
  G.bloodza = "idle";
  G.bloodzaT = 0;
  G.hershX = -140;
  G.chandeliers = [];
  G.xillie = "idle";
  G.xillieT = 0;
  const rng = mulberry(G.seed ^ (hashStr(room.zone) + room.index * 131 + 9));
  const idx = room.index;
  if (room.special === "cardboard") G.entities.push(ent("cardboard", room.w * 0.32, room.h * 0.4));
  if (room.special === "hersh") {
    showMsg("ХЭРШ поднимается! Беги вперёд, уворачивайся от люстр!");
    G.warning = 2.2;
  }
  if (room.special === "bloodza") {
    G.bloodzaT = 2.2 + rng() * 3.5;
  }
  if (room.special === "xillie") {
    G.xillieT = 2.4 + rng() * 2;
  }
  if (room.zone === "theater" && [5, 10, 19, 22].includes(idx)) {
    G.entities.push(ent("roomguard", room.exitX - 40, room.exitY));
  }
  if (room.zone === "theater" && idx > 1 && rng() < 0.48 && !room.special) {
    const t = pick(rng, ["chaser", "photophobe", "hider"] as const);
    G.entities.push(ent(t, 140 + rng() * (room.w - 280), 90 + rng() * (room.h - 180)));
  }
  if (room.zone === "theater" && idx > 6 && rng() < 0.12) {
    G.entities.push(ent("rare", room.w * 0.5, room.h * 0.45));
  }
  if (room.zone === "mannequin") {
    for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) {
      G.entities.push(ent("mannequin", 90 + rng() * (room.w - 180), 80 + rng() * (room.h - 160)));
    }
  }
  if (room.zone === "basement") {
    G.entities.push(ent("crawler", room.w * (0.3 + rng() * 0.4), 42));
    if (rng() < 0.5) G.entities.push(ent("chaser", room.w * 0.7, room.h * 0.6));
  }
  if (room.zone === "costume") {
    for (let i = 0; i < 3; i++) G.entities.push(ent("costume", 100 + rng() * (room.w - 200), 90 + rng() * (room.h - 180)));
  }
  if (room.zone === "orchestra") {
    G.entities.push(ent("orchestra", room.w / 2, room.h - 30));
  }
  if (room.zone === "electrical") {
    for (let i = 0; i < 3; i++) G.entities.push(ent("spark", 80 + rng() * (room.w - 160), 80 + rng() * (room.h - 160)));
  }
  if (room.zone === "archive" && rng() < 0.6) {
    G.entities.push(ent("hider", room.w * 0.6, room.h * 0.5));
  }
  if (room.zone === "wasteland" && rng() < 0.45) {
    G.entities.push(ent("chaser", room.w * 0.7, room.h * 0.3));
  }
  if (room.zone === "rooms") G.entities = [];
}

function ent(type: EntityType, x: number, y: number): Entity {
  return { type, x, y, r: 16, alive: true, timer: 0, state: "idle", speed: 70, alpha: 1, warn: false, tx: x, ty: y };
}

function takeDamage(p: Player, d: number) {
  if (p.invuln > 0 || p.hiding) return;
  p.health = Math.max(0, p.health - d * Settings.difficulty);
  p.invuln = 0.7;
  G.shake = 10;
  sfxHurt();
  if (p.health <= 0) die();
}

function die() {
  sfxDeath();
  setScreen("dead");
  stopAmbient();
  clearSave();
}

function win(kind: WinKind) {
  G.winKind = kind;
  sfxWin();
  stopAmbient();
  clearSave();
  if (kind === "outdoors") achieve("outdoors");
  if (kind === "rooms") achieve("rooms");
  if (kind === "alleys") achieve("alleys");
  const lines =
    kind === "outdoors"
      ? [
          "ТЕАТР ТЕНЕЙ",
          "",
          "Ты открыл люк ломом и прошёл парк.",
          "Xillie не достала тебя.",
          "За воротами были фонари. Настоящие.",
          "Ты дошёл до людей и рассказал про «Этернию».",
          "Сначала не поверили.",
          "Потом нашли здание.",
          "Дверей внутри было больше, чем снаружи.",
          "",
          "Театр отпустил тебя… пока.",
        ]
      : kind === "rooms"
        ? [
            "ТЕАТР ТЕНЕЙ",
            "",
            "Ты не пошёл в парк.",
            "Театр дописал десять лишних комнат",
            "и открыл светящуюся дверь.",
            "Пять комнат без тени.",
            "Тишина, в которой можно дышать.",
            "",
            "Ачивка: Светлая комната",
          ]
        : [
            "ТЕАТР ТЕНЕЙ",
            "",
            "Пятнадцать батарей. Генератор.",
            "Часть зала снова увидела свет.",
            "Сущности отступили в кулисы.",
            "Это не полный выход — но театр впервые",
            "сбился со спектакля.",
            "",
            "Ачивка: Генератор",
          ];
  ui.set({ winKind: kind, creditsLines: lines });
  setScreen("win");
}

function enterZone(zone: ZoneId, index: number, ret?: { zone: ZoneId; room: number }) {
  if (ret) G.returnTo = ret;
  G.zone = zone;
  G.room = index;
  enterRoom(false);
}

function enterRoom(keepPlayerStats: boolean) {
  const prevH = G.player?.health ?? 100;
  const prevB = G.player?.battery ?? 100;
  G.roomData = generateRoom(G.zone, G.room);
  const room = G.roomData;
  G.player = makePlayer(room.enterX + 28, room.enterY);
  if (keepPlayerStats && G.player) {
    G.player.health = prevH;
    G.player.battery = prevB;
  }
  spawnEntities(room);
  G.fog = [];
  for (let i = 0; i < (room.kind === "light" ? 8 : 38); i++) {
    G.fog.push({
      x: Math.random() * room.w,
      y: Math.random() * room.h,
      r: 22 + Math.random() * 48,
      a: 0.018 + Math.random() * 0.03,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 10,
    });
  }
  G.particles = [];
  G.player.costumeSlow = 0;
  showMsg(room.name);
  ambientFor(G.zone);
  saveGame();
  if (G.zone === "theater" && G.room === 1) achieve("first_door");
  syncObjective();
}

function nextRoom() {
  const z = G.zone;
  const max = zoneRoomCount(z);
  if (G.player) G.player.health = Math.min(100, G.player.health + 8);
  if (z !== "theater" && G.room + 1 >= max) {
    if (z === "outdoors") {
      win("outdoors");
      return;
    }
    if (z === "rooms") {
      win("rooms");
      return;
    }
    if (z === "alleys") {
      showMsg("Нужен генератор.");
      return;
    }
    if (z === "basement") achieve("basement");
    if (z.startsWith("secret_")) {
      if (z === "secret_makeup") achieve("secret_makeup");
      if (z === "secret_storage") achieve("secret_storage");
      if (z === "secret_director") achieve("secret_director");
      if (z === "secret_mirror") achieve("secret_mirror");
    }
    const ret = G.returnTo ?? { zone: "theater" as ZoneId, room: 0 };
    G.returnTo = null;
    G.zone = ret.zone;
    G.room = ret.room;
    enterRoom(true);
    showMsg("Ты вернулся.");
    return;
  }
  if (z === "theater" && G.room >= 49) {
    enterZone("rooms", 0, { zone: "theater", room: 49 });
    return;
  }
  G.room += 1;
  enterRoom(true);
  sfxDoor();
}

function syncObjective() {
  let o = "Пройди театр и найди выход";
  if (G.zone === "theater" && G.room < 11 && !G.hasCrowbar) o = "Найди лом в подсобке";
  else if (G.zone === "theater" && G.room >= 24 && G.room <= 34) o = "Лампы мигают — прячься";
  else if (G.zone === "theater" && G.room === 29) o = "Беги от Хэрша, не касайся жижи";
  else if (G.zone === "theater" && G.room >= 38) o = "Люк наружу (лом) или иди дальше";
  else if (G.zone === "outdoors") o = "Прячься от Xillie. Доберись до ворот";
  else if (G.zone === "alleys") o = `Батареи ${G.techBatteries}/15. Запусти генератор`;
  else if (G.zone === "rooms") o = "Пройди пять светлых комнат";
  else if (G.zone === "basement") o = "Не стой под потолком";
  else if (G.zone === "mannequin") o = "Смотри на манекены";
  ui.set({
    objective: o,
    roomLabel: roomHud(),
    zoneTitle: ZONES[G.zone].title,
    hasCrowbar: G.hasCrowbar,
    hasKey: G.hasKey,
    keys: G.keys,
    techBatteries: G.techBatteries,
    notesFound: G.notesFound.slice(),
  });
}

function roomHud() {
  const n = G.room + 1;
  const tot = G.zone === "theater" ? 40 : zoneRoomCount(G.zone);
  const extra = G.zone === "theater" && G.room >= 40 ? ` · лишние ${G.room - 39}` : "";
  return `${n} / ${tot}${extra}`;
}

function startGame(fromSave: boolean) {
  unlockAudio();
  resumeIfNeeded();
  const saved = fromSave ? loadSave() : null;
  G.seed = saved?.seed ?? (Date.now() ^ Math.floor(Math.random() * 1e9));
  G.zone = saved?.zone ?? "theater";
  G.room = saved?.room ?? 0;
  G.keys = saved?.keys ?? 0;
  G.hasKey = saved?.hasKey ?? false;
  G.hasCrowbar = saved?.hasCrowbar ?? false;
  G.notesFound = saved?.notesFound ?? [];
  G.secretsFound = saved?.secretsFound ?? [];
  G.techBatteries = saved?.techBatteries ?? 0;
  G.generatorOn = saved?.generatorOn ?? false;
  G.crowbarTaken = saved?.crowbarTaken ?? false;
  G.returnTo = saved?.returnTo ?? null;
  G.time = 0;
  G.shake = 0;
  G.winKind = null;
  enterRoom(false);
  if (saved && G.player) {
    G.player.health = saved.health;
    G.player.battery = saved.battery;
  }
  setScreen("play");
  sfxClick();
}

function toggleFlash() {
  if (G.screen !== "play" || !G.player) return;
  if (G.player.battery <= 0) {
    showMsg("Батарея села…");
    return;
  }
  G.player.flashlight = !G.player.flashlight;
  ui.set({ flashlight: G.player.flashlight });
  sfxClick();
}

function toggleCrouch() {
  if (G.screen !== "play" || !G.player || G.player.hiding) return;
  G.player.crouch = !G.player.crouch;
  ui.set({ crouch: G.player.crouch });
}

function near(ax: number, ay: number, bx: number, by: number, r: number) {
  return Math.hypot(ax - bx, ay - by) < r;
}

function interact() {
  if (G.screen !== "play" || !G.player || !G.roomData) return;
  const p = G.player;
  const room = G.roomData;

  if (p.costumeSlow > 0) {
    p.costumeSlow = 0;
    showMsg("Костюм сорван.");
    sfxHide();
    return;
  }

  if (near(p.x, p.y, room.exitX, room.exitY, 44)) {
    if (room.locked && !G.hasKey && !(room.zone.startsWith("secret_") && G.hasCrowbar && room.hatchX)) {
      showMsg(room.locked ? "Дверь заперта. Нужен ключ." : "Закрыто.");
      return;
    }
    if (room.zone === "theater" && room.index === 49) {
      enterZone("rooms", 0, { zone: "theater", room: 49 });
      showMsg("Светящаяся дверь…");
      return;
    }
    if (room.locked) {
      G.hasKey = false;
      showMsg("Открыто.");
    }
    nextRoom();
    return;
  }

  if (room.hatchX != null && room.hatchY != null && near(p.x, p.y, room.hatchX, room.hatchY, 40)) {
    if (room.zone === "theater" && room.index === 39) {
      if (!G.hasCrowbar) {
        showMsg("Люк заперт. Нужен лом.");
        return;
      }
      enterZone("outdoors", 0, { zone: "theater", room: 39 });
      showMsg("Люк открыт. Парк Outdoors.");
      return;
    }
    if (room.zone === "secret_makeup") {
      if (!G.hasCrowbar) {
        showMsg("Люк заперт. Нужен лом.");
        return;
      }
      G.hasKey = true;
      G.keys++;
      room.hatchX = undefined;
      showMsg("Люк открыт. Внутри ключ.");
      saveGame();
      return;
    }
  }

  if (room.portal && near(p.x, p.y, room.portal.x, room.portal.y, 36)) {
    const dest = room.portal.zone;
    enterZone(dest, 0, { zone: G.zone, room: G.room });
    if (dest.startsWith("secret_")) G.secretsFound.push(dest);
    showMsg(ZONES[dest].title);
    return;
  }

  if (room.extraDoor && near(p.x, p.y, room.extraDoor.x, room.extraDoor.y, 36)) {
    if (room.extraDoor.label === "костюмы") {
      enterZone("costume", 0, { zone: G.zone, room: G.room });
      return;
    }
    if (room.extraDoor.label === "вечность") {
      enterZone("costume", 0, { zone: G.zone, room: G.room });
      return;
    }
    if (room.extraDoor.fake) {
      p.x = room.enterX + 28;
      p.y = room.enterY;
      showMsg(room.zone === "desert" ? "Мираж. Ты никуда не ушёл." : "Ложная дверь. Петля.");
      G.shake = 8;
      return;
    }
  }

  if (room.keyX != null && room.keyY != null && near(p.x, p.y, room.keyX, room.keyY, 30)) {
    G.hasKey = true;
    G.keys++;
    room.keyX = undefined;
    showMsg("Найден ключ.");
    sfxPickup();
    saveGame();
    return;
  }
  if (room.crowbarX != null && room.crowbarY != null && near(p.x, p.y, room.crowbarX, room.crowbarY, 30)) {
    G.hasCrowbar = true;
    G.crowbarTaken = true;
    room.crowbarX = undefined;
    showMsg("Найден лом.");
    sfxPickup();
    achieve("crowbar");
    saveGame();
    return;
  }
  if (room.batteryX != null && room.batteryY != null && near(p.x, p.y, room.batteryX, room.batteryY, 28)) {
    p.battery = Math.min(100, p.battery + 48);
    room.batteryX = undefined;
    showMsg("Батарея заряжена.");
    sfxPickup();
    return;
  }
  for (const t of room.tech) {
    if (!t.taken && near(p.x, p.y, t.x, t.y, 28)) {
      t.taken = true;
      G.techBatteries++;
      showMsg(`Энергобатарея ${G.techBatteries}/15`);
      sfxPickup();
      saveGame();
      syncObjective();
      return;
    }
  }
  if (room.generator && near(p.x, p.y, room.generator.x, room.generator.y, 40)) {
    if (G.techBatteries < 15) {
      showMsg(`Нужно 15 батарей. Сейчас ${G.techBatteries}.`);
      return;
    }
    G.generatorOn = true;
    win("alleys");
    return;
  }
  for (const n of room.notes) {
    if (!n.taken && near(p.x, p.y, n.x, n.y, 30)) {
      n.taken = true;
      G.notesFound.push(n.id);
      ui.set({ noteTitle: n.title, noteText: n.text, notesFound: G.notesFound.slice() });
      setScreen("note");
      sfxPickup();
      if (G.notesFound.length >= NOTES.length) achieve("notes");
      saveGame();
      return;
    }
  }
  for (const prop of room.props) {
    if (prop.hideable && near(p.x, p.y, prop.x, prop.y, prop.r + 14)) {
      p.hiding = !p.hiding;
      showMsg(p.hiding ? "Ты спрятался." : "Ты вышел.");
      sfxHide();
      ui.set({ hiding: p.hiding });
      if (p.hiding) G.entities.forEach((e) => { if (e.type === "hider") e.timer = 0; });
      return;
    }
  }
}

function activeKeys(): Set<string> {
  if (forcedKeys) return new Set(forcedKeys);
  return held;
}

function pollMove() {
  // Joystick has priority while active
  if (input.joy) return;
  const k = activeKeys();
  let mx = 0;
  let my = 0;
  if (k.has("KeyW") || k.has("ArrowUp")) my -= 1;
  if (k.has("KeyS") || k.has("ArrowDown")) my += 1;
  if (k.has("KeyA") || k.has("ArrowLeft")) mx -= 1;
  if (k.has("KeyD") || k.has("ArrowRight")) mx += 1;
  if (mx || my) {
    const l = Math.hypot(mx, my) || 1;
    input.mx = mx / l;
    input.my = my / l;
  } else {
    input.mx = 0;
    input.my = 0;
  }
}

function updatePlayer(dt: number) {
  const p = G.player;
  const room = G.roomData;
  if (!p || !room) return;
  if (p.hiding) {
    p.vx = 0;
    p.vy = 0;
    p.moving = false;
    return;
  }
  if (p.invuln > 0) p.invuln -= dt;
  pollMove();

  let mx = input.mx;
  let my = input.my;
  // Soft deadzone — was 0.12, too high for some tablets/sticks
  const rawLen = Math.hypot(mx, my);
  if (rawLen < 0.05) {
    mx = 0;
    my = 0;
  }
  const len = Math.hypot(mx, my);
  p.moving = len > 0.001;

  let speed = (p.baseSpeed || 170) * (Settings.sens || 1);
  if (p.crouch) speed *= 0.55;
  if (p.costumeSlow > 0) speed *= 0.62;
  if (room.special === "hersh") speed *= 1.18;

  if (p.moving) {
    // Normalize only when needed
    const inv = 1 / len;
    mx *= inv;
    my *= inv;
    p.vx = mx * speed;
    p.vy = my * speed;
    p.angle = Math.atan2(my, mx);
    p.walkTimer += dt;
    if (p.walkTimer > (p.crouch ? 0.22 : 0.14)) {
      p.walkFrame = (p.walkFrame + 1) % 4;
      p.walkTimer = 0;
      footCd = 0;
      sfxFootstep(p.crouch);
    }
  } else {
    // Smooth stop (frame-rate independent)
    const damp = Math.exp(-12 * dt);
    p.vx *= damp;
    p.vy *= damp;
    if (Math.abs(p.vx) < 1) p.vx = 0;
    if (Math.abs(p.vy) < 1) p.vy = 0;
    p.walkFrame = 0;
  }

  if (room.kind === "roof") {
    p.vx += 28 * dt;
  }

  let nx = p.x + p.vx * dt;
  let ny = p.y + p.vy * dt;
  const pad = p.crouch ? 16 : 22;
  const minX = pad + p.r;
  const maxX = room.w - pad - p.r;
  const minY = pad + p.r;
  const maxY = room.h - pad - p.r;
  nx = clamp(nx, minX, maxX);
  ny = clamp(ny, minY, maxY);

  // Soft collision with solid props (don't trap the player)
  for (const prop of room.props) {
    if (prop.hideable) continue;
    const dx = nx - prop.x;
    const dy = ny - prop.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const min = p.r + prop.r * 0.65;
    if (d < min) {
      const push = (min - d) + 0.5;
      nx += (dx / d) * push;
      ny += (dy / d) * push;
    }
  }

  p.x = clamp(nx, minX, maxX);
  p.y = clamp(ny, minY, maxY);

  if (p.flashlight && p.battery > 0) {
    p.battery = Math.max(0, p.battery - 1.55 * dt * (G.zone === "alleys" ? 1.35 : 1));
    if (p.battery <= 0) p.flashlight = false;
  } else if (!p.flashlight && p.battery < 100) {
    p.battery = Math.min(100, p.battery + 0.7 * dt);
  }
}

function seek(e: Entity, p: Player, dt: number, spd: number) {
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  e.x += (dx / len) * spd * dt;
  e.y += (dy / len) * spd * dt;
}

function flee(e: Entity, p: Player, dt: number, spd: number) {
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  e.x += (dx / len) * spd * dt;
  e.y += (dy / len) * spd * dt;
}

function lookingAt(p: Player, e: Entity) {
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const ang = Math.atan2(dy, dx);
  let d = Math.abs(ang - p.angle);
  while (d > Math.PI) d = Math.abs(d - Math.PI * 2);
  return d < 0.7 && p.flashlight && p.battery > 5;
}

function updateEntities(dt: number) {
  const p = G.player;
  const room = G.roomData;
  if (!p || !room) return;
  const diff = Settings.difficulty;

  if (room.special === "bloodza") {
    if (G.bloodza === "idle") {
      G.bloodzaT -= dt;
      if (G.bloodzaT <= 0) {
        G.bloodza = "warn";
        G.bloodzaT = 1.85 / diff;
        showMsg("Лампы мигают. Прячься!");
        G.warning = 1.6;
        sfxWarn();
      }
    } else if (G.bloodza === "warn") {
      G.lampFlicker = 0.25 + Math.random() * 0.9;
      G.bloodzaT -= dt;
      if (G.bloodzaT <= 0) {
        G.bloodza = "rush";
        G.bloodzaX = -80;
        sfxBloodza();
        G.warning = 1.2;
      }
    } else if (G.bloodza === "rush") {
      G.bloodzaX += 920 * dt;
      G.lampFlicker = Math.random() * 0.4;
      const by = room.h / 2 + Math.sin(G.time * 8) * 18;
      if (!p.hiding && Math.hypot(p.x - G.bloodzaX, p.y - by) < 38) die();
      if (G.bloodzaX > room.w + 120) {
        G.bloodza = "done";
        G.lampFlicker = 1;
        showMsg("Она ушла…");
        achieve("bloodza");
      }
    }
  } else {
    G.lampFlicker = 0.92 + Math.sin(G.time * 1.3) * 0.08;
  }

  if (room.special === "hersh") {
    G.hershX += 92 * diff * dt;
    if (G.time % 1.15 < dt + 0.02) {
      G.chandeliers.push({ x: p.x + 80 + Math.random() * 220, y: -20, vy: 0, alive: true });
    }
    for (const c of G.chandeliers) {
      if (!c.alive) continue;
      c.vy += 520 * dt;
      c.y += c.vy * dt;
      if (!p.hiding && Math.hypot(p.x - c.x, p.y - c.y) < 26) takeDamage(p, 22);
      if (c.y > room.h + 40) c.alive = false;
    }
    if (p.x < G.hershX + 24) takeDamage(p, 28 * dt);
    if (p.x > room.exitX - 40 && Math.abs(p.y - room.exitY) < 50) {
      achieve("hersh");
    }
  }

  if (room.special === "xillie") {
    if (G.xillie === "idle") {
      G.xillieT -= dt;
      if (G.xillieT <= 0) {
        G.xillie = "warn";
        G.xillieT = 1.6;
        showMsg("Крик в небе! В будку!");
        sfxXillie();
        G.warning = 1.8;
      }
    } else if (G.xillie === "warn") {
      G.xillieT -= dt;
      if (G.xillieT <= 0) {
        G.xillie = "rush";
        G.xillieX = -100;
        G.xillieY = p.y;
      }
    } else if (G.xillie === "rush") {
      G.xillieX += 980 * dt;
      if (!p.hiding && Math.hypot(p.x - G.xillieX, p.y - G.xillieY) < 46) die();
      if (G.xillieX > room.w + 140) G.xillie = "done";
    }
  }

  if (room.zone === "archive") {
    G.whisperT -= dt;
    if (G.whisperT <= 0) {
      G.whisperT = 7 + Math.random() * 8;
      showMsg(WHISPERS[Math.floor(Math.random() * WHISPERS.length)]!);
    }
  }

  for (const e of G.entities) {
    if (!e.alive) continue;
    e.timer += dt;
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.type === "chaser") {
      if (!p.flashlight || p.battery < 10) {
        seek(e, p, dt, 95 * diff);
        if (dist < 26) takeDamage(p, 16);
      } else {
        flee(e, p, dt, 55);
      }
      if (dist < 170 && !e.warn) {
        e.warn = true;
        showMsg("Шаги в темноте…");
        G.warning = 1.4;
      }
    } else if (e.type === "photophobe") {
      if (p.flashlight && p.battery > 5) {
        seek(e, p, dt, 120 * diff);
        if (dist < 28) takeDamage(p, 18);
        if (dist < 150 && !e.warn) {
          e.warn = true;
          showMsg("Оно ненавидит свет! Выключи!");
        }
      } else {
        if (e.timer > 1.4) {
          e.tx = e.x + (Math.random() - 0.5) * 180;
          e.ty = e.y + (Math.random() - 0.5) * 180;
          e.timer = 0;
        }
        const dx = e.tx - e.x;
        const dy = e.ty - e.y;
        const l = Math.hypot(dx, dy) || 1;
        if (l > 8) {
          e.x += (dx / l) * 40 * dt;
          e.y += (dy / l) * 40 * dt;
        }
      }
    } else if (e.type === "roomguard") {
      if (dist < 36) takeDamage(p, 12);
      if (Math.abs(p.x - room.exitX) < 90 && Math.abs(p.y - room.exitY) < 90) seek(e, p, dt, 55);
    } else if (e.type === "hider") {
      if (e.state === "idle" && dist < 190) {
        e.state = "hunt";
        showMsg("Прячься! Оно идёт!");
        G.warning = 1.8;
      }
      if (e.state === "hunt") {
        seek(e, p, dt, 110 * diff);
        if (dist < 24 && !p.hiding) takeDamage(p, 20);
        if (p.hiding && e.timer > 2.2) {
          e.alive = false;
          showMsg("Оно ушло.");
        }
      }
    } else if (e.type === "rare") {
      e.alpha = 0.45 + Math.sin(G.time * 2) * 0.25;
      if (dist < 48 && e.state === "idle") {
        G.keys++;
        G.hasKey = true;
        showMsg("Сущность оставила ключ.");
        e.alive = false;
        sfxPickup();
      }
    } else if (e.type === "cardboard") {
      G.meatActive = true;
      G.meatFlood = Math.min(1, G.meatFlood + 0.07 * dt * diff);
      if (G.meatFlood > 0.12 && !e.warn) {
        e.warn = true;
        showMsg("ДЕКОРАЦИЯ ОЖИЛА! К ВЫХОДУ!");
        G.warning = 2;
      }
      const floodY = room.h - G.meatFlood * room.h * 0.85;
      if (p.y > floodY + 16) takeDamage(p, 22 * dt);
    } else if (e.type === "mannequin") {
      if (lookingAt(p, e)) {
        e.state = "still";
      } else {
        seek(e, p, dt, 48 * diff);
        if (dist < 24) takeDamage(p, 14);
      }
    } else if (e.type === "crawler") {
      e.x += Math.sin(G.time * 0.6 + e.timer) * 40 * dt;
      e.y = 36 + Math.sin(G.time * 2) * 6;
      if (Math.abs(p.x - e.x) < 28 && p.y < 120) e.timer += dt;
      else e.timer = Math.max(0, e.timer - dt);
      if (e.timer > 1.2) {
        e.y += 180 * dt;
        if (dist < 28) takeDamage(p, 18);
      }
    } else if (e.type === "costume") {
      if (dist < 42) {
        p.costumeSlow = 1;
        if (!e.warn) {
          e.warn = true;
          showMsg("Костюм липнет. Действие — сорвать.");
        }
      }
      e.x += Math.sin(G.time + e.y) * 10 * dt;
    } else if (e.type === "orchestra") {
      e.y = room.h - 20 - Math.min(room.h * 0.55, e.timer * 18);
      if (dist < 34) takeDamage(p, 16);
    } else if (e.type === "spark") {
      if (Math.random() < 0.04) {
        G.particles.push({
          x: e.x,
          y: e.y,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80,
          life: 0.35,
          max: 0.35,
          c: "#e8c060",
          s: 2,
        });
      }
      if (dist < 30 && Math.random() < 0.02) takeDamage(p, 8);
    }
  }
  G.entities = G.entities.filter((e) => e.alive);
}

function burst(x: number, y: number, c: string, n = 8) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      life: 0.4 + Math.random() * 0.3,
      max: 0.6,
      c,
      s: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(dt: number) {
  const room = G.roomData;
  if (room?.kind === "roof") {
    for (let i = 0; i < 6; i++) {
      G.particles.push({
        x: Math.random() * room.w,
        y: -10,
        vx: 80,
        vy: 220 + Math.random() * 80,
        life: 1.2,
        max: 1.2,
        c: "rgba(160,180,200,0.45)",
        s: 1.2,
      });
    }
  }
  for (const q of G.particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.life -= dt;
  }
  G.particles = G.particles.filter((q) => q.life > 0).slice(-220);
}

function resize() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawProp(prop: Prop, camX: number, camY: number) {
  const c = ctx!;
  const px = prop.x - camX;
  const py = prop.y - camY;
  if (prop.type === "chair") {
    c.fillStyle = "#3a2218";
    c.fillRect(px - 12, py - 5, 24, 14);
    c.fillStyle = "#4a2a20";
    c.fillRect(px - 10, py - 16, 20, 12);
    c.fillStyle = "#2a1510";
    c.fillRect(px - 12, py - 18, 3.5, 24);
    c.fillRect(px + 8.5, py - 18, 3.5, 24);
  } else if (prop.type === "cabinet") {
    c.fillStyle = "#2a1c12";
    c.fillRect(px - 14, py - 22, 28, 44);
    c.strokeStyle = "#4a3020";
    c.lineWidth = 1.5;
    c.strokeRect(px - 14, py - 22, 28, 44);
    c.beginPath();
    c.moveTo(px, py - 22);
    c.lineTo(px, py + 22);
    c.stroke();
    c.fillStyle = "#c0a050";
    c.beginPath();
    c.arc(px - 4, py, 1.8, 0, Math.PI * 2);
    c.arc(px + 4, py, 1.8, 0, Math.PI * 2);
    c.fill();
  } else if (prop.type === "crate") {
    c.fillStyle = "#3a2a18";
    c.fillRect(px - 14, py - 12, 28, 24);
    c.strokeStyle = "#5a4028";
    c.strokeRect(px - 14, py - 12, 28, 24);
  } else if (prop.type === "table") {
    c.fillStyle = "#2a1c10";
    c.fillRect(px - 22, py - 7, 44, 14);
    c.fillStyle = "#1a1008";
    c.fillRect(px - 18, py + 5, 4, 10);
    c.fillRect(px + 14, py + 5, 4, 10);
  } else if (prop.type === "mirror") {
    c.fillStyle = "#1a1520";
    c.fillRect(px - 12, py - 18, 24, 36);
    c.fillStyle = "rgba(100,130,150,0.28)";
    c.fillRect(px - 9, py - 15, 18, 30);
    c.strokeStyle = "#6a5a40";
    c.lineWidth = 2;
    c.strokeRect(px - 12, py - 18, 24, 36);
  } else if (prop.type === "booth") {
    c.fillStyle = "#2a2214";
    c.fillRect(px - 18, py - 20, 36, 40);
    c.fillStyle = "#1a140c";
    c.fillRect(px - 10, py - 8, 20, 22);
    c.fillStyle = "#6a4a28";
    c.fillRect(px - 20, py - 24, 40, 6);
  } else if (prop.type === "tree") {
    c.fillStyle = "#1a140c";
    c.fillRect(px - 4, py, 8, 16);
    c.fillStyle = "#243018";
    c.beginPath();
    c.arc(px, py - 8, 16, 0, Math.PI * 2);
    c.fill();
  } else if (prop.type === "pipe") {
    c.strokeStyle = "#4a4030";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(px - 20, py);
    c.lineTo(px + 20, py);
    c.stroke();
  } else if (prop.type === "bench") {
    c.fillStyle = "#3a2a18";
    c.fillRect(px - 22, py - 4, 44, 8);
    c.fillRect(px - 20, py + 4, 4, 10);
    c.fillRect(px + 16, py + 4, 4, 10);
  } else if (prop.type === "poster") {
    c.fillStyle = "#5a3020";
    c.fillRect(px - 10, py - 14, 20, 28);
    c.fillStyle = "#c0a060";
    c.fillRect(px - 7, py - 10, 14, 8);
  } else if (prop.type === "lamppost") {
    c.fillStyle = "#2a2418";
    c.fillRect(px - 2, py - 28, 4, 36);
    c.fillStyle = "#d8c070";
    c.beginPath();
    c.arc(px, py - 30, 5, 0, Math.PI * 2);
    c.fill();
  }
}

function drawEntity(e: Entity, camX: number, camY: number) {
  const c = ctx!;
  const px = e.x - camX;
  const py = e.y - camY;
  c.save();
  c.globalAlpha = e.alpha;
  if (e.type === "chaser") {
    c.fillStyle = "#1a0508";
    c.beginPath();
    c.moveTo(px, py - 20);
    c.quadraticCurveTo(px - 18, py - 4, px - 12, py + 14);
    c.quadraticCurveTo(px, py + 8, px + 12, py + 14);
    c.quadraticCurveTo(px + 18, py - 4, px, py - 20);
    c.fill();
    c.fillStyle = "#c01818";
    c.beginPath();
    c.arc(px - 4, py - 7, 2.8, 0, Math.PI * 2);
    c.arc(px + 4, py - 7, 2.8, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "photophobe") {
    c.fillStyle = "#d0c8b0";
    c.beginPath();
    c.ellipse(px, py, 12, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#0a0505";
    c.beginPath();
    c.ellipse(px - 3, py - 14, 2.2, 3.2, 0, 0, Math.PI * 2);
    c.ellipse(px + 3, py - 14, 2.2, 3.2, 0, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "roomguard") {
    c.fillStyle = "#221018";
    c.fillRect(px - 7, py - 26, 14, 38);
    c.beginPath();
    c.arc(px, py - 28, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#700018";
    c.beginPath();
    c.arc(px - 3, py - 30, 1.8, 0, Math.PI * 2);
    c.arc(px + 3, py - 30, 1.8, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "hider") {
    c.fillStyle = "#1a1008";
    c.beginPath();
    c.ellipse(px, py + 3, 16, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#800010";
    c.beginPath();
    c.arc(px - 3, py - 1, 2.2, 0, Math.PI * 2);
    c.arc(px + 3, py - 1, 2.2, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "rare") {
    const g = c.createRadialGradient(px, py, 0, px, py, 28);
    g.addColorStop(0, "rgba(180,200,255,0.35)");
    g.addColorStop(1, "rgba(100,120,200,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(200,220,255,0.7)";
    c.beginPath();
    c.arc(px, py - 3, 9, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "cardboard") {
    c.fillStyle = "#5a4030";
    c.fillRect(px - 30, py - 40, 60, 80);
    c.fillStyle = "#8a6040";
    c.fillRect(px - 22, py - 30, 44, 20);
    c.fillStyle = "#c02020";
    c.font = "10px DoorsCyr";
    c.textAlign = "center";
    c.fillText("ДЕКОРАЦИЯ", px, py + 5);
  } else if (e.type === "mannequin") {
    c.fillStyle = "#c8b090";
    c.fillRect(px - 7, py - 10, 14, 28);
    c.beginPath();
    c.arc(px, py - 16, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2a1810";
    c.fillRect(px - 8, py - 22, 16, 4);
    c.fillStyle = e.state === "still" ? "#203040" : "#801010";
    c.beginPath();
    c.arc(px - 3, py - 16, 1.6, 0, Math.PI * 2);
    c.arc(px + 3, py - 16, 1.6, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "crawler") {
    c.fillStyle = "#1a0c08";
    c.beginPath();
    c.ellipse(px, py, 22, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#a01010";
    c.beginPath();
    c.arc(px - 6, py, 2, 0, Math.PI * 2);
    c.arc(px + 6, py, 2, 0, Math.PI * 2);
    c.fill();
  } else if (e.type === "costume") {
    c.fillStyle = "#6a2030";
    c.beginPath();
    c.moveTo(px, py - 18);
    c.quadraticCurveTo(px - 16, py + 6, px - 10, py + 20);
    c.lineTo(px + 10, py + 20);
    c.quadraticCurveTo(px + 16, py + 6, px, py - 18);
    c.fill();
  } else if (e.type === "orchestra") {
    c.fillStyle = "#12080c";
    c.beginPath();
    c.ellipse(px, py, 40, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c01818";
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + G.time;
      c.beginPath();
      c.arc(px + Math.cos(a) * 16, py + Math.sin(a) * 6, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  } else if (e.type === "spark") {
    c.fillStyle = "#e8c040";
    c.globalAlpha = 0.35 + Math.random() * 0.5;
    c.beginPath();
    c.arc(px, py, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawPlayer(p: Player, camX: number, camY: number) {
  const c = ctx!;
  const px = p.x - camX;
  const py = p.y - camY;
  const sy = p.crouch ? 0.7 : 1;
  const flash = p.invuln > 0 && Math.floor(G.time * 12) % 2 === 0;
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(px, py + 11 * sy, 13, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.translate(px, py);
  if (p.angle > Math.PI / 2 || p.angle < -Math.PI / 2) c.scale(-1, 1);
  const leg = p.moving ? Math.sin(p.walkFrame * 1.57) * (p.crouch ? 4 : 7) : 0;
  c.strokeStyle = flash ? "#c06060" : "#2a1a10";
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-3, 2);
  c.lineTo(-3 - leg * 0.3, 12 * sy);
  c.stroke();
  c.beginPath();
  c.moveTo(3, 2);
  c.lineTo(3 + leg * 0.3, 12 * sy);
  c.stroke();
  c.fillStyle = flash ? "#d06050" : "#3a2818";
  c.beginPath();
  c.ellipse(0, p.crouch ? -2 : -4, 10, 12 * sy, 0, 0, Math.PI * 2);
  c.fill();
  const arm = p.moving ? Math.sin(p.walkFrame * 1.57 + Math.PI) * 5 : 0;
  c.strokeStyle = flash ? "#e08070" : "#c8a070";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-8, -6);
  c.lineTo(-11 - arm * 0.2, 2);
  c.stroke();
  c.beginPath();
  c.moveTo(8, -6);
  c.lineTo(11 + arm * 0.2, 2);
  c.stroke();
  c.fillStyle = flash ? "#ffb0a0" : "#e8c8a8";
  c.beginPath();
  c.arc(0, p.crouch ? -12 : -15, 7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = flash ? "#4a2020" : "#1a1008";
  c.beginPath();
  c.arc(0, p.crouch ? -14 : -17, 7.5, Math.PI, 0);
  c.fill();
  c.fillStyle = "#1a0805";
  c.beginPath();
  c.arc(-2.5, p.crouch ? -13 : -16, 1.4, 0, Math.PI * 2);
  c.arc(2.5, p.crouch ? -13 : -16, 1.4, 0, Math.PI * 2);
  c.fill();
  if (p.flashlight && p.battery > 0) {
    c.fillStyle = "#c0a040";
    c.fillRect(9, -2, 5, 9);
    c.fillStyle = "#fff8c0";
    c.beginPath();
    c.arc(11.5, -3, 2.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawRoom(camX: number, camY: number) {
  const c = ctx!;
  const room = G.roomData!;
  const pal = room.pal;
  c.fillStyle = pal.floor;
  c.fillRect(-camX, -camY, room.w, room.h);
  const tile = 36;
  for (let y = 0; y < room.h; y += tile) {
    for (let x = 0; x < room.w; x += tile) {
      const odd = ((x / tile) | 0) + ((y / tile) | 0) + room.floorPattern;
      c.fillStyle = odd % 2 === 0 ? pal.carpet : pal.floor;
      c.globalAlpha = room.kind === "light" ? 0.55 : 0.35;
      c.fillRect(x - camX, y - camY, tile, tile);
    }
  }
  c.globalAlpha = 1;
  if (room.kind === "hall") {
    c.strokeStyle = "rgba(90,40,40,0.18)";
    c.lineWidth = 2;
    for (let x = 40; x < room.w; x += 48) {
      c.beginPath();
      c.moveTo(x - camX, 40 - camY);
      c.lineTo(x - camX, room.h - 40 - camY);
      c.stroke();
    }
  }

  if (G.meatActive && G.meatFlood > 0) {
    const fy = room.h - G.meatFlood * room.h * 0.85;
    const grad = c.createLinearGradient(0, fy - camY, 0, room.h - camY);
    grad.addColorStop(0, "rgba(80,10,10,0.7)");
    grad.addColorStop(1, "rgba(40,5,5,0.95)");
    c.fillStyle = grad;
    c.fillRect(-camX, fy - camY, room.w, room.h - fy + 10);
  }
  if (room.special === "hersh") {
    c.fillStyle = "#0a0408";
    c.fillRect(-camX, -camY, Math.max(0, G.hershX) + 20, room.h);
    c.fillStyle = "#200810";
    for (let i = 0; i < 8; i++) {
      const yy = ((i * 70 + G.time * 40) % room.h);
      c.beginPath();
      c.arc(G.hershX - 10 - camX, yy - camY, 7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#c01818";
      c.beginPath();
      c.arc(G.hershX - 10 - camX, yy - camY, 2.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#200810";
    }
    for (const ch of G.chandeliers) {
      if (!ch.alive) continue;
      c.strokeStyle = "#6a5a40";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ch.x - camX, -camY);
      c.lineTo(ch.x - camX, ch.y - camY);
      c.stroke();
      c.fillStyle = "#8a7040";
      c.beginPath();
      c.moveTo(ch.x - camX, ch.y - 8 - camY);
      c.lineTo(ch.x - 16 - camX, ch.y + 10 - camY);
      c.lineTo(ch.x + 16 - camX, ch.y + 10 - camY);
      c.closePath();
      c.fill();
    }
  }

  c.fillStyle = pal.wall;
  c.fillRect(-camX, -camY, room.w, 18);
  c.fillRect(-camX, room.h - 18 - camY, room.w, 18);
  c.fillRect(-camX, -camY, 18, room.h);
  c.fillRect(room.w - 18 - camX, -camY, 18, room.h);
  c.strokeStyle = pal.trim;
  c.lineWidth = 3;
  c.strokeRect(18 - camX, 18 - camY, room.w - 36, room.h - 36);
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.lineWidth = 1;
  for (let x = 28; x < room.w - 28; x += 52) {
    c.beginPath();
    c.moveTo(x - camX, 18 - camY);
    c.lineTo(x - camX, 18 + 22 - camY);
    c.stroke();
  }

  const lampA = G.lampFlicker;
  const lg = c.createRadialGradient(room.lampX - camX, room.lampY + 20 - camY, 4, room.lampX - camX, room.lampY + 20 - camY, 90);
  lg.addColorStop(0, `rgba(255,210,140,${0.22 * lampA})`);
  lg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = lg;
  c.beginPath();
  c.arc(room.lampX - camX, room.lampY + 20 - camY, 90, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = `rgba(220,180,90,${0.55 * lampA})`;
  c.beginPath();
  c.ellipse(room.lampX - camX, room.lampY - camY, 10, 6, 0, 0, Math.PI * 2);
  c.fill();

  const open = !room.locked || G.hasKey;
  c.fillStyle = open ? "#2a1c10" : "#1a0c08";
  c.fillRect(room.exitX - 6 - camX, room.exitY - 36 - camY, 20, 72);
  c.strokeStyle = room.zone === "rooms" || (room.zone === "theater" && room.index === 49) ? "#e8d090" : pal.trim;
  c.lineWidth = 2.5;
  c.strokeRect(room.exitX - 8 - camX, room.exitY - 38 - camY, 24, 76);
  if (room.locked && !open) {
    c.fillStyle = "#801018";
    c.fillRect(room.exitX - 1 - camX, room.exitY - 6 - camY, 8, 10);
  }
  c.fillStyle = pal.trim;
  c.font = "11px DoorsCyr";
  c.textAlign = "center";
  c.fillText(String(room.index + 1), room.w / 2 - camX, 34 - camY);

  if (room.hatchX != null && room.hatchY != null) {
    c.fillStyle = "#1a1008";
    c.fillRect(room.hatchX - 22 - camX, room.hatchY - 10 - camY, 44, 20);
    c.strokeStyle = "#5a3a20";
    c.strokeRect(room.hatchX - 22 - camX, room.hatchY - 10 - camY, 44, 20);
    c.fillStyle = "#a08040";
    c.fillText("ЛЮК", room.hatchX - camX, room.hatchY + 4 - camY);
  }
  if (room.portal) {
    c.fillStyle = "rgba(60,40,20,0.75)";
    c.fillRect(room.portal.x - 16 - camX, room.portal.y - 18 - camY, 32, 36);
    c.fillStyle = "#c4a574";
    c.font = "10px DoorsCyr";
    c.fillText(room.portal.label, room.portal.x - camX, room.portal.y + 4 - camY);
  }
  if (room.extraDoor) {
    c.fillStyle = room.extraDoor.fake ? "#2a2030" : "#2a1c10";
    c.fillRect(room.extraDoor.x - 10 - camX, room.extraDoor.y - 20 - camY, 20, 40);
    c.fillStyle = "#a09070";
    c.font = "9px DoorsCyr";
    c.fillText(room.extraDoor.label, room.extraDoor.x - camX, room.extraDoor.y + 28 - camY);
  }

  for (const prop of room.props) drawProp(prop, camX, camY);

  if (room.keyX != null && room.keyY != null) {
    const kx = room.keyX - camX;
    const ky = room.keyY - camY;
    c.fillStyle = "#d0b040";
    c.beginPath();
    c.arc(kx, ky, 5.5, 0, Math.PI * 2);
    c.fill();
    c.fillRect(kx + 3, ky - 1.5, 9, 3);
  }
  if (room.crowbarX != null && room.crowbarY != null) {
    c.strokeStyle = "#6a6a70";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(room.crowbarX - 10 - camX, room.crowbarY + 8 - camY);
    c.lineTo(room.crowbarX + 10 - camX, room.crowbarY - 8 - camY);
    c.stroke();
  }
  if (room.batteryX != null && room.batteryY != null) {
    c.fillStyle = "#4a6a18";
    c.fillRect(room.batteryX - 5 - camX, room.batteryY - 7 - camY, 10, 14);
    c.fillStyle = "#8aba30";
    c.fillRect(room.batteryX - 3.5 - camX, room.batteryY - 4 - camY, 7, 4);
  }
  for (const n of room.notes) {
    if (n.taken) continue;
    c.fillStyle = "#d8c090";
    c.fillRect(n.x - 7 - camX, n.y - 9 - camY, 14, 18);
    c.strokeStyle = "#8a7040";
    c.strokeRect(n.x - 7 - camX, n.y - 9 - camY, 14, 18);
  }
  for (const t of room.tech) {
    if (t.taken) continue;
    c.fillStyle = "#3a6a8a";
    c.fillRect(t.x - 6 - camX, t.y - 8 - camY, 12, 16);
    c.fillStyle = "#80d0ff";
    c.fillRect(t.x - 3 - camX, t.y - 5 - camY, 6, 4);
  }
  if (room.generator) {
    c.fillStyle = "#2a2a20";
    c.fillRect(room.generator.x - 22 - camX, room.generator.y - 16 - camY, 44, 32);
    c.fillStyle = "#6a8a30";
    c.fillRect(room.generator.x - 10 - camX, room.generator.y - 6 - camY, 20, 12);
    c.fillStyle = "#c4a574";
    c.font = "10px DoorsCyr";
    c.fillText("ГЕНЕРАТОР", room.generator.x - camX, room.generator.y + 28 - camY);
  }
}

function drawLighting(camX: number, camY: number) {
  const c = ctx!;
  const p = G.player;
  if (!p || !G.roomData) return;
  const br = Settings.brightness;
  const light = G.roomData.kind === "light" || (G.generatorOn && G.zone === "theater");
  if (light) {
    c.fillStyle = `rgba(255,244,220,${0.08 * br})`;
    c.fillRect(0, 0, W, H);
    return;
  }
  const cover = G.roomData.kind === "dark" || G.zone === "alleys" ? 0.7 : 0.4;
  c.fillStyle = `rgba(8,4,3,${cover / br})`;
  c.fillRect(0, 0, W, H);
  const lightR = (p.flashlight && p.battery > 0 ? 176 + Math.sin(G.time * 3) * 6 : 92) * Math.min(1.25, br);
  const grd = c.createRadialGradient(p.x - camX, p.y - camY, 0, p.x - camX, p.y - camY, lightR);
  if (p.flashlight && p.battery > 0) {
    const fl = 0.94 + Math.sin(G.time * 9) * 0.03;
    grd.addColorStop(0, `rgba(255,230,180,${0.4 * fl})`);
    grd.addColorStop(0.35, `rgba(220,180,120,${0.2 * fl})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    grd.addColorStop(0, `rgba(200,160,100,${0.14 * br})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
  }
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = grd;
  c.beginPath();
  c.arc(p.x - camX, p.y - camY, lightR, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = "source-over";
}

function drawFog(camX: number, camY: number, dt: number) {
  const c = ctx!;
  const room = G.roomData;
  if (!room || room.kind === "light") return;
  for (const f of G.fog) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < -40) f.x = room.w + 40;
    if (f.x > room.w + 40) f.x = -40;
    if (f.y < -40) f.y = room.h + 40;
    if (f.y > room.h + 40) f.y = -40;
    c.fillStyle = `rgba(50,35,28,${f.a})`;
    c.beginPath();
    c.arc(f.x - camX, f.y - camY, f.r, 0, Math.PI * 2);
    c.fill();
  }
}

function camera(): { camX: number; camY: number } {
  const room = G.roomData!;
  const p = G.player!;
  let camX = p.x - W / 2;
  let camY = p.y - H / 2;
  camX = clamp(camX, 0, Math.max(0, room.w - W));
  camY = clamp(camY, 0, Math.max(0, room.h - H));
  if (room.w < W) camX = (room.w - W) / 2;
  if (room.h < H) camY = (room.h - H) / 2;
  if (G.shake > 0) {
    camX += (Math.random() - 0.5) * G.shake;
    camY += (Math.random() - 0.5) * G.shake;
  }
  return { camX, camY };
}

function drawWorld(dt: number) {
  const c = ctx!;
  if (!G.roomData) return;
  const { camX, camY } = G.player ? camera() : { camX: (G.roomData.w - W) / 2, camY: (G.roomData.h - H) / 2 };
  c.fillStyle = "#0a0604";
  c.fillRect(0, 0, W, H);
  drawRoom(camX, camY);
  drawFog(camX, camY, dt);
  for (const e of G.entities) drawEntity(e, camX, camY);
  if (G.bloodza === "rush") {
    const by = G.roomData.h / 2 + Math.sin(G.time * 8) * 18;
    const px = G.bloodzaX - camX;
    const py = by - camY;
    c.fillStyle = "#4a0008";
    c.beginPath();
    c.ellipse(px, py, 34, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e01020";
    c.beginPath();
    c.arc(px - 10, py - 4, 4, 0, Math.PI * 2);
    c.arc(px + 8, py - 2, 3, 0, Math.PI * 2);
    c.fill();
  }
  if (G.xillie === "rush" && G.roomData) {
    const px = G.xillieX - camX;
    const py = G.xillieY - camY;
    c.fillStyle = "#101018";
    c.beginPath();
    c.ellipse(px, py, 48, 14, -0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c0d0ff";
    c.beginPath();
    c.arc(px + 16, py - 2, 4, 0, Math.PI * 2);
    c.fill();
  }
  if (G.player && !G.player.hiding) drawPlayer(G.player, camX, camY);
  else if (G.player?.hiding) {
    c.fillStyle = "rgba(200,180,100,0.55)";
    c.font = "13px DoorsCyr";
    c.textAlign = "center";
    c.fillText("спрятан", G.player.x - camX, G.player.y - camY - 18);
  }
  for (const q of G.particles) {
    c.globalAlpha = q.life / q.max;
    c.fillStyle = q.c;
    c.fillRect(q.x - camX, q.y - camY, q.s, q.s);
  }
  c.globalAlpha = 1;
  if (G.screen === "play") drawLighting(camX, camY);
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.82);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.42)");
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
  if (G.warning > 0) {
    c.fillStyle = `rgba(120,10,10,${(G.warning / 2) * 0.16})`;
    c.fillRect(0, 0, W, H);
  }
}

function ensureBackdrop() {
  if (backdropRoom) {
    G.roomData = backdropRoom;
    return;
  }
  G.seed = 42;
  backdropRoom = generateRoom("theater", 1);
  G.roomData = backdropRoom;
  G.fog = [];
  for (let i = 0; i < 28; i++) {
    G.fog.push({
      x: Math.random() * backdropRoom.w,
      y: Math.random() * backdropRoom.h,
      r: 24 + Math.random() * 40,
      a: 0.02 + Math.random() * 0.03,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 8,
    });
  }
}

function loop(now: number) {
  if (!running || !ctx) return;
  raf = requestAnimationFrame(loop);
  const raw = Math.min((now - last) / 1000, 0.1);
  last = now;
  G.time += raw;
  stepAcc += raw;
  while (stepAcc >= STEP) {
    if (G.screen === "play") {
      updatePlayer(STEP);
      updateEntities(STEP);
      updateParticles(STEP);
      if (G.messageTimer > 0) {
        G.messageTimer -= STEP;
        if (G.messageTimer <= 0) ui.set({ message: "" });
      }
      if (G.shake > 0) G.shake = Math.max(0, G.shake - STEP * 18);
      if (G.warning > 0) G.warning = Math.max(0, G.warning - STEP);
    } else {
      updateParticles(STEP * 0.4);
    }
    stepAcc -= STEP;
  }
  if (G.screen === "play" && G.player) {
    ui.set({
      health: G.player.health,
      battery: G.player.battery,
      flashlight: G.player.flashlight,
      crouch: G.player.crouch,
      hiding: G.player.hiding,
      hasKey: G.hasKey,
      hasCrowbar: G.hasCrowbar,
      roomLabel: roomHud(),
      zoneTitle: ZONES[G.zone].title,
    });
  }
  if (G.screen !== "play") {
    if (!G.roomData || G.screen === "title") ensureBackdrop();
  }
  drawWorld(raw);
}

function onKeyDown(e: KeyboardEvent) {
  held.add(e.code);
  if (e.code === "KeyF") toggleFlash();
  if (e.code === "KeyE" || e.code === "Space") {
    e.preventDefault();
    interact();
  }
  if (e.code === "KeyC" || e.code === "ControlLeft") toggleCrouch();
  if (e.code === "Escape") {
    if (G.screen === "play") setScreen("pause");
    else if (G.screen === "pause" || G.screen === "settings" || G.screen === "journal" || G.screen === "achievements" || G.screen === "help")
      setScreen(G.player ? "play" : "title");
  }
}

function onKeyUp(e: KeyboardEvent) {
  held.delete(e.code);
}

function onBlur() {
  held.clear();
}

function onVis() {
  if (document.visibilityState === "visible") resumeIfNeeded();
  else if (G.screen === "play" && G.player) saveGame();
}

export function mountGame(el: HTMLCanvasElement) {
  canvas = el;
  ctx = el.getContext("2d");
  if (!ctx) return;
  loadSettings();
  loadMeta();
  G.screen = "title";
  G.player = null;
  ui.set({ hasSave: hasSave(), achievements: meta.achievements, screen: "title", message: "" });
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVis);
  running = true;
  last = performance.now();
  raf = requestAnimationFrame(loop);
  window.__controlsTest = {
    getYaw: () => (G.player ? -G.player.angle : 0),
    getSpeed: () => {
      if (!G.player) return 0;
      return Math.hypot(G.player.vx, G.player.vy);
    },
    setKeys: (codes: string[]) => {
      forcedKeys = codes.length ? codes : null;
    },
  };
}

export function unmountGame() {
  running = false;
  cancelAnimationFrame(raf);
  window.removeEventListener("resize", resize);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("blur", onBlur);
  document.removeEventListener("visibilitychange", onVis);
  stopAmbient();
  delete window.__controlsTest;
}

export const api = {
  start: (fromSave: boolean) => startGame(fromSave),
  interact,
  flash: toggleFlash,
  crouch: toggleCrouch,
  setStick: (x: number, y: number, active: boolean) => {
    input.joy = active;
    if (active) {
      // Clamp stick to unit circle
      const l = Math.hypot(x, y);
      if (l > 1) {
        input.mx = x / l;
        input.my = y / l;
      } else {
        input.mx = x;
        input.my = y;
      }
    } else {
      input.mx = 0;
      input.my = 0;
    }
  },
  pause: () => {
    if (G.screen === "play") setScreen("pause");
  },
  resume: () => {
    if (G.player) setScreen("play");
    else setScreen("title");
  },
  toTitle: () => {
    if (G.player) saveGame();
    G.player = null;
    setScreen("title");
    ui.set({ hasSave: hasSave() });
  },
  open: (s: Screen) => setScreen(s),
  closeNote: () => {
    setScreen("play");
  },
  resetSave: () => {
    clearSave();
    showMsg("Сохранение сброшено");
  },
  setBright: (v: number) => {
    Settings.brightness = v;
    saveSettings();
    ui.set({ brightness: v });
  },
  setSens: (v: number) => {
    Settings.sens = v;
    saveSettings();
    ui.set({ sens: v });
  },
  setDiff: (v: number) => {
    Settings.difficulty = v;
    saveSettings();
    ui.set({ difficulty: v });
  },
  setVol: (v: number) => {
    Settings.volume = v;
    setVolume(v);
    saveSettings();
    ui.set({ volume: v });
  },
  unlock: unlockAudio,
  showCredits: () => setScreen("credits"),
  burstAtPlayer: () => {
    if (G.player) burst(G.player.x, G.player.y, "#c04030", 10);
  },
};

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
    };
  }
}
