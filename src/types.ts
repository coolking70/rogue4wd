export type PartType = 'chassis' | 'body' | 'motor' | 'tire' | 'battery' | 'special' | 'weapon';

export interface Stats {
  speed: number;
  acceleration: number;
  handling: number;
  stability: number;
  weight: number;
  energy: number;
  attack?: number;
  defense?: number;
}

export interface Synergy {
  id: string;
  name: string;
  description: string;
  requiredParts: string[]; // Part IDs or Tags
  bonus: Partial<Stats>;
}

export interface Part {
  id: string;
  baseId?: string; // Used for 3-in-1 merging
  name: string;
  type: PartType;
  manufacturer: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  stats: Stats;
  description: string;
  tags: string[];
  star?: number; // 1, 2, 3
}

export interface Manufacturer {
  id: string;
  name: string;
  description: string;
  focus: string;
  bonus: Partial<Stats>;
}

export interface Car {
  manufacturer: Manufacturer;
  parts: Partial<Record<PartType, Part>>;
}

export interface GameState {
  playerName: string;
  money: number;
  level: number;
  xp: number;
  currentCar: Car;
  inventory: Part[];
  day: number;
  stage: number;
  bossDefeated: boolean;
  wins: number;
  losses: number;
  streak: number; // positive for win streak, negative for loss streak
}
