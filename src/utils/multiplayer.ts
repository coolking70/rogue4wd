import { Car } from '../types';

export interface PlayerData {
  name: string;
  car: Car;
}

export const encodePlayerData = (data: PlayerData): string => {
  try {
    const json = JSON.stringify(data);
    return btoa(encodeURIComponent(json));
  } catch (e) {
    console.error("Failed to encode player data", e);
    return "";
  }
};

export const decodePlayerData = (code: string): PlayerData | null => {
  try {
    const json = decodeURIComponent(atob(code));
    return JSON.parse(json) as PlayerData;
  } catch (e) {
    console.error("Failed to decode player data", e);
    return null;
  }
};
