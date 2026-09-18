import { create } from "zustand";

export type Screen =
  | "title"
  | "play"
  | "settings"
  | "note"
  | "dead"
  | "win"
  | "credits"
  | "pause"
  | "journal"
  | "achievements"
  | "help";

export type WinKind = "outdoors" | "rooms" | "alleys" | null;

export interface GameUI {
  screen: Screen;
  health: number;
  battery: number;
  roomLabel: string;
  zoneTitle: string;
  message: string;
  noteTitle: string;
  noteText: string;
  flashlight: boolean;
  crouch: boolean;
  hiding: boolean;
  hasKey: boolean;
  hasCrowbar: boolean;
  keys: number;
  techBatteries: number;
  notesFound: string[];
  achievements: string[];
  hasSave: boolean;
  winKind: WinKind;
  creditsLines: string[];
  brightness: number;
  sens: number;
  difficulty: number;
  volume: number;
  objective: string;
}

export const useGameUI = create<GameUI>(() => ({
  screen: "title",
  health: 100,
  battery: 100,
  roomLabel: "1 / 40",
  zoneTitle: "Театр «Этерния»",
  message: "",
  noteTitle: "",
  noteText: "",
  flashlight: false,
  crouch: false,
  hiding: false,
  hasKey: false,
  hasCrowbar: false,
  keys: 0,
  techBatteries: 0,
  notesFound: [],
  achievements: [],
  hasSave: false,
  winKind: null,
  creditsLines: [],
  brightness: 1.15,
  sens: 1,
  difficulty: 1,
  volume: 0.7,
  objective: "Найди выход из театра",
}));

export const ui = {
  set: (p: Partial<GameUI>) => useGameUI.setState(p),
  get: () => useGameUI.getState(),
};
