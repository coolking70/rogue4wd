import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Float, useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ShoppingCart, Settings, Play, RefreshCw, Coins, ChevronRight, Info, Zap, Shield, Gauge, Camera, FastForward, Map, Globe, Flame } from 'lucide-react';
import * as THREE from 'three';
import { CarModel } from './components/CarModel';
import { RaceScene } from './components/RaceScene';
import { GarageCarPreview } from './components/GaragePreview';
import { TestMode } from './components/TestMode';
import { GameState, Car, Part, Manufacturer, Stats, PartType } from './types';
import { SYNERGIES, MANUFACTURERS, INITIAL_PARTS, SHOP_PARTS, SHOP_PROBABILITIES, TRACKS } from './constants';
import { Synergy } from './types';
import { cn } from './lib/utils';
import { encodePlayerData, decodePlayerData, PlayerData } from './utils/multiplayer';
import { useTranslation } from './hooks/useTranslation';
import { Language } from './i18n/translations';

// --- Game Logic Helpers ---
const calculateStats = (car: Car): { stats: Stats, activeSynergies: Synergy[] } => {
  const baseStats: Stats = { speed: 0, acceleration: 0, handling: 0, stability: 0, weight: 0, energy: 0, attack: 0, defense: 0 };
  
  // Add manufacturer bonus
  Object.entries(car.manufacturer.bonus).forEach(([key, val]) => {
    (baseStats as any)[key] += val;
  });

  // Add parts stats
  const equippedParts = Object.values(car.parts).filter(Boolean) as Part[];
  equippedParts.forEach(part => {
    Object.entries(part.stats).forEach(([key, val]) => {
      (baseStats as any)[key] += val;
    });
  });

  // Calculate Synergies
  const allTags = equippedParts.flatMap(p => [...p.tags, p.manufacturer]);
  const activeSynergies = SYNERGIES.filter(synergy => {
    const required = [...synergy.requiredParts];
    const tags = [...allTags];
    
    for (const req of required) {
      const index = tags.indexOf(req);
      if (index === -1) return false;
      tags.splice(index, 1);
    }
    return true;
  });

  // Apply Synergy Bonuses
  activeSynergies.forEach(synergy => {
    Object.entries(synergy.bonus).forEach(([key, val]) => {
      (baseStats as any)[key] += val;
    });
  });

  return { stats: baseStats, activeSynergies };
};

const generateShop = (level: number, currentManufacturerId?: string): Part[] => {
  const probs = SHOP_PROBABILITIES[level as keyof typeof SHOP_PROBABILITIES] || SHOP_PROBABILITIES[10];

  const getRarity = () => {
    const rand = Math.random() * 100;
    if (rand < probs.common) return 'common';
    if (rand < probs.common + probs.rare) return 'rare';
    if (rand < probs.common + probs.rare + probs.epic) return 'epic';
    return 'legendary';
  };

  const shop: Part[] = [];
  for (let i = 0; i < 5; i++) {
    const targetRarity = getRarity();
    const availableParts = SHOP_PARTS.filter(p => p.rarity === targetRarity);
    
    if (availableParts.length === 0) {
      // Fallback if no parts of that rarity exist
      const fallback = SHOP_PARTS[Math.floor(Math.random() * SHOP_PARTS.length)];
      shop.push({ ...fallback, id: `${fallback.id}-${Math.random()}`, baseId: fallback.id, star: 1 } as any);
      continue;
    }

    // Give higher weight to parts from the same manufacturer
    const weightedParts = availableParts.flatMap(p => {
      if (p.manufacturer === currentManufacturerId) {
        return [p, p, p]; // 3x chance
      }
      return [p];
    });

    const selected = weightedParts[Math.floor(Math.random() * weightedParts.length)];
    // Add a unique ID suffix so we can have multiple of the same part in shop/inventory
    // We add baseId to track the original ID for merging
    shop.push({ 
      ...selected, 
      id: `${selected.id}-${Math.random()}`, 
      baseId: selected.id, 
      star: 1,
      name: `${selected.name} ★1`
    } as any);
  }

  return shop;
};

// --- Sub-Components ---

const RotatingGroup = ({ children, duration }: { children: React.ReactNode, duration: number }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (ref.current) {
      // delta is in seconds. We want one full rotation (2*PI) in 'duration' seconds.
      ref.current.rotation.y += (Math.PI * 2) * (delta / duration);
    }
  });
  return <group ref={ref}>{children}</group>;
};

const StatBar = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between items-center text-xs text-zinc-400">
      <div className="flex items-center gap-1">
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <span className="font-mono">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        className={cn("h-full rounded-full", color)}
      />
    </div>
  </div>
);

const LoadingOverlay = () => {
  const { active, progress } = useProgress();
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {active && (
        <motion.div 
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse mb-4">
            {t('loading')}
          </h2>
          <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-zinc-400 text-sm mt-2 font-mono">{Math.round(progress)}%</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const mergeParts = (state: GameState): GameState => {
  let hasMerged = true;
  let currentState = { ...state };

  while (hasMerged) {
    hasMerged = false;
    
    // Combine inventory and equipped parts for checking
    const allParts = [
      ...currentState.inventory,
      ...Object.values(currentState.currentCar.parts).filter(Boolean) as Part[]
    ];

    // Group by baseId and star
    const groups: Record<string, Part[]> = {};
    for (const part of allParts) {
      const key = `${part.baseId || part.id}-${part.star || 1}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(part);
    }

    for (const [key, group] of Object.entries(groups)) {
      if (group.length >= 3 && (group[0].star || 1) < 3) { // Max star is 3
        // We have a merge!
        hasMerged = true;
        const partsToMerge = group.slice(0, 3);
        const mergeIds = partsToMerge.map(p => p.id);
        
        // Check if any of the merged parts was equipped
        let equippedType: PartType | null = null;
        for (const p of partsToMerge) {
          if (currentState.currentCar.parts[p.type]?.id === p.id) {
            equippedType = p.type;
            break;
          }
        }

        // Create the upgraded part
        const basePart = partsToMerge[0];
        const newStar = (basePart.star || 1) + 1;
        
        // Scale stats (e.g. 2x stats per star level)
        const newStats = { ...basePart.stats };
        Object.keys(newStats).forEach(k => {
          (newStats as any)[k] = (newStats as any)[k] * 2;
        });

        const upgradedPart: Part = {
          ...basePart,
          id: `${basePart.baseId || basePart.id}-star${newStar}-${Math.random()}`,
          star: newStar,
          stats: newStats,
          name: `${basePart.name.replace(/ ★+$/, '')} ${'★'.repeat(newStar)}`
        };

        // Remove merged parts from inventory and car
        const newInventory = currentState.inventory.filter(p => !mergeIds.includes(p.id));
        const newCarParts = { ...currentState.currentCar.parts };
        
        for (const type of Object.keys(newCarParts) as PartType[]) {
          if (newCarParts[type] && mergeIds.includes(newCarParts[type]!.id)) {
            delete newCarParts[type];
          }
        }

        // Add the new part
        if (equippedType) {
          newCarParts[equippedType] = upgradedPart;
        } else {
          newInventory.push(upgradedPart);
        }

        currentState = {
          ...currentState,
          inventory: newInventory,
          currentCar: {
            ...currentState.currentCar,
            parts: newCarParts
          }
        };
        
        // Break out of the loop to re-evaluate groups with the new state
        break;
      }
    }
  }

  return currentState;
};

// --- Main App ---

export default function App() {
  const { t, lang, toggleLang } = useTranslation();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'start' | 'garage' | 'shop' | 'race' | 'result' | 'online' | 'test'>('start');
  const [shopItems, setShopItems] = useState<Part[]>([]);
  const [raceResult, setRaceResult] = useState<{ 
    winner: boolean, 
    reward: number, 
    streak?: number, 
    multiplier?: number,
    breakdown?: { base: number, interest: number, streak: number, win: number, boss: number }
  } | null>(null);
  const [activePartType, setActivePartType] = useState<string | null>(null);
  const [raceProgress, setRaceProgress] = useState({ player: 0, opponent: 0 });
  const [racePositions, setRacePositions] = useState({ player: [0, 0], opponent: [0, 0] });
  const [timeScale, setTimeScale] = useState(1);
  const [cameraView, setCameraView] = useState<'follow' | 'top' | 'fpv'>('follow');
  const [equipFlash, setEquipFlash] = useState(0);
  const [boostReady, setBoostReady] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [onlineCodeInput, setOnlineCodeInput] = useState('');
  const [onlineOpponent, setOnlineOpponent] = useState<PlayerData | null>(null);
  const [testRaceConfig, setTestRaceConfig] = useState<{ playerCar: Car, opponentCar: Car, stage: number } | null>(null);

  // Initialize Game
  const startGame = (manufacturer: Manufacturer) => {
    const getInitialPart = (type: PartType) => {
      const part = INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === type)!;
      return { ...part, baseId: part.id, star: 1, name: `${part.name} ★1` };
    };

    const initialCar: Car = {
      manufacturer,
      parts: {
        chassis: getInitialPart('chassis'),
        body: getInitialPart('body'),
        motor: getInitialPart('motor'),
        tire: getInitialPart('tire'),
        battery: getInitialPart('battery'),
      }
    };
    setGameState({
      playerName: playerNameInput || 'Player',
      money: 10,
      level: 1,
      xp: 0,
      currentCar: initialCar,
      inventory: [],
      day: 1,
      stage: 1,
      bossDefeated: false,
      wins: 0,
      losses: 0,
      streak: 0
    });
    setShopItems(generateShop(1, manufacturer.id));
    setView('garage');
  };

  const goToGarage = () => {
    setTestRaceConfig(null);
    setOnlineOpponent(null);
    setView('garage');
  };

  const currentData = useMemo(() => {
    if (!gameState) return null;
    return calculateStats(gameState.currentCar);
  }, [gameState]);

  const currentStats = currentData?.stats;

  const minimapPath = useMemo(() => {
    const currentStage = testRaceConfig ? testRaceConfig.stage : (gameState?.stage || 1);
    const trackIndex = (currentStage - 1) % TRACKS.length;
    const points = TRACKS[trackIndex].map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    const sampledPoints = curve.getPoints(100);
    
    // Map to 0-100% space
    return sampledPoints.map(p => {
      const x = 50 + p.x * 1.2;
      const y = 50 + p.z * 1.2;
      return `${x},${y}`;
    }).join(' L ');
  }, [gameState?.stage, testRaceConfig]);
  const activeSynergies = currentData?.activeSynergies || [];

  const { opponentCar, opponentStats } = useMemo(() => {
    if (!gameState) {
      const defaultCar = { manufacturer: MANUFACTURERS[1], parts: {} } as Car;
      return { opponentCar: defaultCar, opponentStats: { speed: 10, acceleration: 10, handling: 10, stability: 10, weight: 10, energy: 10 } };
    }

    const isBoss = gameState.day % 5 === 0;
    const stageMultiplier = gameState.stage;
    
    // Select parts based on stage and day
    const availableParts = SHOP_PARTS.filter(p => {
      if (isBoss) {
        // Boss gets parts up to a higher price limit, but not strictly all epic/legendary
        return p.price <= (gameState.day * 80 * stageMultiplier);
      }
      return p.price <= (gameState.day * 40 * stageMultiplier);
    });

    const getRandomPart = (type: string) => {
      const parts = availableParts.filter(p => p.type === type);
      if (parts.length === 0) return INITIAL_PARTS.find(p => p.type === type);
      return parts[Math.floor(Math.random() * parts.length)];
    };

    const car: Car = {
      manufacturer: MANUFACTURERS[Math.floor(Math.random() * MANUFACTURERS.length)],
      parts: {
        chassis: getRandomPart('chassis'),
        motor: getRandomPart('motor'),
        tire: getRandomPart('tire'),
        battery: getRandomPart('battery'),
        body: getRandomPart('body'),
        special: isBoss && Math.random() > 0.5 ? getRandomPart('special') : undefined,
      }
    };

    // Add a boss specific weapon if it's a boss to identify it later
    if (isBoss) {
      car.parts.weapon = {
        id: 'boss-weapon',
        name: 'Boss Core',
        type: 'weapon',
        manufacturer: 'Generic',
        price: 0,
        rarity: 'epic',
        stats: { speed: 5 * stageMultiplier, acceleration: 5 * stageMultiplier, handling: 5 * stageMultiplier, stability: 5 * stageMultiplier, weight: 0, energy: 0 },
        description: 'Boss Core',
        tags: []
      };
    }

    const { stats } = calculateStats(car);
    
    // Add some base stats scaling to ensure they are competitive
    const baseScale = (gameState.day - 1) * 3 + (gameState.stage - 1) * 15;
    const finalStats = {
      speed: stats.speed + baseScale,
      acceleration: stats.acceleration + baseScale,
      handling: stats.handling + baseScale,
      stability: stats.stability + baseScale,
      weight: stats.weight,
      energy: stats.energy + baseScale,
      attack: (stats.attack || 0) + baseScale * 0.5,
      defense: (stats.defense || 0) + baseScale * 0.5
    };

    return { opponentCar: car, opponentStats: finalStats };
  }, [gameState?.day, gameState?.stage]);

  const handleBuy = (part: Part) => {
    if (!gameState || gameState.money < part.price) return;
    setGameState(prev => {
      if (!prev) return null;
      const newState = {
        ...prev,
        money: prev.money - part.price,
        inventory: [...prev.inventory, part]
      };
      return mergeParts(newState);
    });
    setShopItems(prev => prev.filter(p => p.id !== part.id));
  };

  const equipPart = (part: Part) => {
    setEquipFlash(Date.now());
    setGameState(prev => {
      if (!prev) return null;
      const oldPart = prev.currentCar.parts[part.type];
      const newInventory = prev.inventory.filter(p => p.id !== part.id);
      if (oldPart) newInventory.push(oldPart);
      
      return {
        ...prev,
        currentCar: {
          ...prev.currentCar,
          parts: {
            ...prev.currentCar.parts,
            [part.type]: part
          }
        },
        inventory: newInventory
      };
    });
  };

  const sellPart = (part: Part, e: React.MouseEvent) => {
    e.stopPropagation();
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        money: prev.money + Math.max(1, Math.floor(part.price * 0.5)),
        inventory: prev.inventory.filter(p => p.id !== part.id)
      };
    });
  };

  const startRace = () => {
    setOnlineOpponent(null); // Clear online opponent if starting a normal race
    setRaceProgress({ player: 0, opponent: 0 });
    setRacePositions({ player: [0, 0], opponent: [0, 0] });
    setTimeScale(1);
    setCameraView('follow');
    setBoostReady(false);
    setBoostActive(false);
    setView('race');
  };

  const startOnlineRace = () => {
    if (!onlineCodeInput) return;
    const decoded = decodePlayerData(onlineCodeInput);
    if (decoded) {
      setOnlineOpponent(decoded);
      setRaceProgress({ player: 0, opponent: 0 });
      setRacePositions({ player: [0, 0], opponent: [0, 0] });
      setTimeScale(1);
      setCameraView('follow');
      setBoostReady(false);
      setBoostActive(false);
      setView('race');
    } else {
      alert(t('online.invalidCode'));
    }
  };

  const handleRaceFinish = (isWinner: boolean) => {
    if (!gameState) return;
    
    if (testRaceConfig) {
      setRaceResult({ winner: isWinner, reward: 0 });
      setView('result');
      return;
    }

    if (onlineOpponent) {
      // Online race logic
      const reward = isWinner ? 200 : 50;
      setRaceResult({ winner: isWinner, reward });
      setGameState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          money: prev.money + reward,
          wins: isWinner ? prev.wins + 1 : prev.wins,
          losses: isWinner ? prev.losses : prev.losses + 1
        };
      });
      setView('result');
      return;
    }

    const isBoss = gameState.day % 5 === 0;
    
    // Auto Chess Economy
    const baseIncome = 5;
    const interest = Math.min(5, Math.floor(gameState.money / 10));
    
    // Calculate new streak
    let newStreak = gameState.streak;
    if (isWinner) {
      newStreak = newStreak > 0 ? newStreak + 1 : 1;
    } else {
      newStreak = newStreak < 0 ? newStreak - 1 : -1;
    }

    // Streak bonus
    const absStreak = Math.abs(newStreak);
    let streakBonus = 0;
    if (absStreak >= 5) streakBonus = 3;
    else if (absStreak >= 4) streakBonus = 2;
    else if (absStreak >= 2) streakBonus = 1;

    const winReward = isWinner ? 1 : 0;
    const bossReward = (isWinner && isBoss) ? 50 : 0;
    
    const finalReward = baseIncome + interest + streakBonus + winReward + bossReward;
    
    setRaceResult({ 
      winner: isWinner, 
      reward: finalReward, 
      streak: newStreak, 
      multiplier: 1,
      breakdown: {
        base: baseIncome,
        interest,
        streak: streakBonus,
        win: winReward,
        boss: bossReward
      }
    });
    
    setGameState(prev => {
      if (!prev) return null;
      
      const newDay = prev.day + 1;
      const newStage = (isWinner && isBoss) ? prev.stage + 1 : prev.stage;
      const bossDefeated = isWinner && isBoss ? true : prev.bossDefeated;

      // XP Gain
      let newXp = prev.xp + 1;
      let newLevel = prev.level;
      const xpRequired = [0, 2, 4, 8, 14, 24, 36, 50, 70, 84];
      
      if (newLevel < 10 && newXp >= xpRequired[newLevel]) {
        newXp -= xpRequired[newLevel];
        newLevel++;
      }

      setShopItems(generateShop(newLevel, prev.currentCar.manufacturer.id));

      return {
        ...prev,
        money: prev.money + finalReward,
        level: newLevel,
        xp: newXp,
        day: newDay,
        stage: newStage,
        bossDefeated: bossDefeated,
        wins: isWinner ? prev.wins + 1 : prev.wins,
        losses: isWinner ? prev.losses : prev.losses + 1,
        streak: newStreak
      };
    });
    setView('result');
  };

  const openShop = () => {
    setView('shop');
  };

  const refreshShop = () => {
    if (!gameState || gameState.money < 2) return;
    setGameState(prev => prev ? { ...prev, money: prev.money - 2 } : null);
    setShopItems(generateShop(gameState.level, gameState.currentCar.manufacturer.id));
  };

  const buyXp = () => {
    if (!gameState || gameState.money < 4 || gameState.level >= 10) return;
    
    setGameState(prev => {
      if (!prev) return null;
      let newXp = prev.xp + 4;
      let newLevel = prev.level;
      const xpRequired = [0, 2, 4, 8, 14, 24, 36, 50, 70, 84];
      
      if (newLevel < 10 && newXp >= xpRequired[newLevel]) {
        newXp -= xpRequired[newLevel];
        newLevel++;
      }
      
      return {
        ...prev,
        money: prev.money - 4,
        level: newLevel,
        xp: newXp
      };
    });
  };

  // --- Views ---

  if (!gameState) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full space-y-12"
        >
          <div className="text-center space-y-4">
            <h1 className="text-6xl font-black tracking-tighter italic uppercase">
              Cyber <span className="text-blue-500">Dash</span>
            </h1>
            <p className="text-zinc-400 text-lg">{t('gameTitle')}</p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="w-full max-w-md space-y-2">
              <label className="text-sm text-zinc-400 font-bold uppercase tracking-widest">{t('playerName')}</label>
              <input 
                type="text" 
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder={t('enterName')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
                maxLength={12}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MANUFACTURERS.map((m) => (
              <motion.button
                key={m.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startGame(m)}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-left space-y-4 hover:border-blue-500/50 transition-colors group"
              >
                <div className="h-12 w-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Settings className="text-zinc-400 group-hover:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{m.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{m.description}</p>
                </div>
                <div className="pt-4 border-t border-zinc-800">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">核心优势</div>
                  <div className="text-blue-400 font-medium mt-1">{m.focus}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden font-sans">
      {/* Sidebar Stats */}
      <div className="w-80 bg-zinc-900/50 border-r border-zinc-800 p-6 flex flex-col gap-6 z-20 h-full">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold italic">CD</div>
              <span className="font-black tracking-tighter uppercase">Cyber Dash</span>
            </div>
            <button 
              onClick={toggleLang}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[10px] font-bold uppercase tracking-tighter text-zinc-400 transition-colors"
            >
              {lang === 'en' ? '中文' : 'EN'}
            </button>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="text-[10px] text-zinc-500 font-bold uppercase">Lv {gameState.level}</div>
                <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-0.5" title={`XP: ${gameState.xp} / ${[0, 2, 4, 8, 14, 24, 36, 50, 70, 84][gameState.level]}`}>
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(gameState.xp / [0, 2, 4, 8, 14, 24, 36, 50, 70, 84][gameState.level]) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-500 font-mono font-bold" title={`Interest: +${Math.min(5, Math.floor(gameState.money / 10))}`}>
                <Coins size={16} />
                <span>{gameState.money}</span>
                <span className="text-[10px] text-yellow-700 ml-1">(+{Math.min(5, Math.floor(gameState.money / 10))})</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold italic uppercase">{t('garage')}</h2>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t('stage')} {gameState.stage}</div>
                <span className="text-xs text-zinc-400 font-mono">{t('day')} {gameState.day}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <StatBar label={t('stats.speed')} value={currentStats?.speed || 0} icon={Gauge} color="bg-blue-500" />
              <StatBar label={t('stats.acceleration')} value={currentStats?.acceleration || 0} icon={Zap} color="bg-emerald-500" />
              <StatBar label={t('stats.handling')} value={currentStats?.handling || 0} icon={RefreshCw} color="bg-purple-500" />
              <StatBar label={t('stats.stability')} value={currentStats?.stability || 0} icon={Shield} color="bg-orange-500" />
            </div>

          {activeSynergies.length > 0 && (
            <div className="pt-6 border-t border-zinc-800 space-y-3">
              <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">激活连协</div>
              <div className="space-y-2">
                {activeSynergies.map(s => (
                  <div key={s.id} className="bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg">
                    <div className="text-xs font-bold text-blue-400">{s.name}</div>
                    <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-zinc-800 grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 p-3 rounded-xl text-center">
              <div className="text-[10px] text-zinc-500 uppercase font-bold">{t('raceResults.victory')}</div>
              <div className="text-xl font-black text-emerald-400">{gameState.wins}</div>
            </div>
            <div className="bg-zinc-800/50 p-3 rounded-xl text-center">
              <div className="text-[10px] text-zinc-500 uppercase font-bold">{t('raceResults.defeat')}</div>
              <div className="text-xl font-black text-red-400">{gameState.losses}</div>
            </div>
          </div>
        </div>

        <div className="mt-auto shrink-0 space-y-2 pt-4 border-t border-zinc-800">
          <button 
            onClick={goToGarage}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              view === 'garage' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
            )}
          >
            <Settings size={20} />
            <span className="font-bold">{t('garage')}</span>
          </button>
          <button 
            onClick={openShop}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              view === 'shop' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
            )}
          >
            <ShoppingCart size={20} />
            <span className="font-bold">{t('shop')}</span>
          </button>
          {gameState.bossDefeated && (
            <button 
              onClick={() => setView('online')}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                view === 'online' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
              )}
            >
              <Globe size={20} />
              <span className="font-bold">{t('onlineRace')}</span>
            </button>
          )}
          <button 
            onClick={() => setView('test')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              view === 'test' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
            )}
          >
            <Settings size={20} />
            <span className="font-bold">Test Mode</span>
          </button>
          <button 
            onClick={startRace}
            disabled={view === 'race'}
            className={cn(
              "w-full flex items-center justify-center gap-3 p-4 rounded-xl font-black uppercase tracking-widest mt-4 transition-all disabled:opacity-50",
              gameState.day % 5 === 0 
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            )}
          >
            <Play size={20} fill="currentColor" />
            <span>{gameState.day % 5 === 0 ? 'BOSS BATTLE' : t('startRace')}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-black">
        <LoadingOverlay />
        <AnimatePresence mode="wait">
          {view === 'garage' && (
            <motion.div 
              key="garage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <div className="flex-1 relative">
                <GarageCarPreview car={gameState.currentCar} equipFlash={equipFlash} />
              </div>

              {/* Inventory Drawer */}
              <div className="h-64 bg-zinc-900 border-t border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold italic uppercase flex items-center gap-2">
                    <RefreshCw size={18} className="text-blue-500" />
                    {t('garage')}
                  </h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {gameState.inventory.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 italic">
                      {t('garageEmpty')}
                    </div>
                  ) : (
                    gameState.inventory.map((part) => (
                      <motion.div
                        key={part.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => equipPart(part)}
                        className="flex-shrink-0 w-40 bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-left space-y-2 hover:border-blue-500 transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between items-start">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                            part.rarity === 'common' ? "bg-zinc-700 text-zinc-300" :
                            part.rarity === 'rare' ? "bg-blue-900 text-blue-300" :
                            part.rarity === 'epic' ? "bg-purple-900 text-purple-300" : "bg-yellow-900 text-yellow-300"
                          )}>
                            {part.rarity}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">{part.type}</span>
                        </div>
                        <div className="font-bold text-sm truncate">{part.name}</div>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          {Object.entries(part.stats).filter(([_, v]) => v !== 0).slice(0, 2).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-zinc-500 uppercase">{k[0]}</span>
                              <span className={v > 0 ? "text-emerald-400" : "text-red-400"}>{v > 0 ? `+${v}` : v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-zinc-700 flex justify-between items-center">
                          <span className="text-[10px] text-zinc-500">Click to equip</span>
                          <button 
                            onClick={(e) => sellPart(part, e)}
                            className="px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold transition-colors"
                          >
                            Sell ${Math.max(1, Math.floor(part.price * 0.5))}
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'shop' && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full p-12 flex flex-col gap-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">{t('shop')}</h2>
                  <p className="text-zinc-500">{t('gameTitle')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <button 
                        onClick={buyXp}
                        disabled={gameState.money < 4 || gameState.level >= 10}
                        className={cn(
                          "px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all",
                          gameState.money >= 4 && gameState.level < 10 ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        Buy XP <span className="text-xs font-mono bg-black/30 px-1.5 py-0.5 rounded">$4</span>
                      </button>
                      <div className="mt-2 text-center">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase">Lv {gameState.level}</div>
                        <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1" title={`XP: ${gameState.xp} / ${[0, 2, 4, 8, 14, 24, 36, 50, 70, 84][gameState.level]}`}>
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${(gameState.xp / [0, 2, 4, 8, 14, 24, 36, 50, 70, 84][gameState.level]) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="w-px h-12 bg-zinc-800" />
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={refreshShop}
                        disabled={gameState.money < 2}
                        className={cn(
                          "px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all h-fit",
                          gameState.money >= 2 ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-zinc-800/50 text-zinc-500 cursor-not-allowed"
                        )}
                      >
                        <RefreshCw size={16} />
                        Refresh <span className="text-xs font-mono bg-black/30 px-1.5 py-0.5 rounded">$2</span>
                      </button>
                      <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
                        <span className="text-zinc-400">{SHOP_PROBABILITIES[gameState.level as keyof typeof SHOP_PROBABILITIES]?.common || 0}%</span>
                        <span className="text-blue-400">{SHOP_PROBABILITIES[gameState.level as keyof typeof SHOP_PROBABILITIES]?.rare || 0}%</span>
                        <span className="text-purple-400">{SHOP_PROBABILITIES[gameState.level as keyof typeof SHOP_PROBABILITIES]?.epic || 0}%</span>
                        <span className="text-yellow-400">{SHOP_PROBABILITIES[gameState.level as keyof typeof SHOP_PROBABILITIES]?.legendary || 0}%</span>
                      </div>
                    </div>
                    <div className="w-px h-12 bg-zinc-800" />
                    <div className="text-right">
                      <div className="text-xs text-zinc-500 uppercase font-bold">{t('money')}</div>
                      <div className="text-2xl font-mono font-bold text-yellow-500 flex items-center gap-2" title={`Interest: +${Math.min(5, Math.floor(gameState.money / 10))}`}>
                        <Coins size={24} />
                        {gameState.money}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {shopItems.map((part) => (
                  <motion.div
                    key={part.id}
                    layoutId={part.id}
                    className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 flex flex-col"
                  >
                    <div className="flex justify-between items-start">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-lg font-bold uppercase",
                        part.rarity === 'common' ? "bg-zinc-800 text-zinc-400" :
                        part.rarity === 'rare' ? "bg-blue-500/20 text-blue-400" :
                        part.rarity === 'epic' ? "bg-purple-500/20 text-purple-400" : "bg-yellow-500/20 text-yellow-400"
                      )}>
                        {part.rarity}
                      </span>
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{part.type}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">{part.name}</h3>
                      <p className="text-xs text-zinc-500 leading-relaxed">{part.description}</p>
                    </div>

                    <div className="flex-1 space-y-2 py-4 border-y border-zinc-800">
                      {Object.entries(part.stats).filter(([_, v]) => v !== 0).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 uppercase font-bold tracking-tighter">{k}</span>
                          <span className={cn("font-mono font-bold", v > 0 ? "text-emerald-400" : "text-red-400")}>
                            {v > 0 ? `+${v}` : v}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      disabled={gameState.money < part.price}
                      onClick={() => handleBuy(part)}
                      className={cn(
                        "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                        gameState.money >= part.price 
                          ? "bg-blue-600 hover:bg-blue-500 text-white" 
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      )}
                    >
                      <Coins size={16} />
                      <span>{part.price}</span>
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="mt-auto flex justify-center">
                <button 
                  onClick={goToGarage}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                >
                  返回车库
                </button>
              </div>
            </motion.div>
          )}

          {view === 'test' && (
            <TestMode 
              playerCar={gameState.currentCar}
              onStartRace={(pCar, oCar, stage) => {
                setTestRaceConfig({ playerCar: pCar, opponentCar: oCar, stage });
                setView('race');
              }}
              onClose={goToGarage}
            />
          )}

          {view === 'online' && (
            <motion.div 
              key="online"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full p-8 flex flex-col gap-8 overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-4xl font-black italic uppercase tracking-tighter">{t('online.title')}</h2>
                  <p className="text-zinc-400">{t('onlineRace')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold uppercase tracking-widest text-blue-400 mb-2">{t('online.yourCode')}</h3>
                    <p className="text-sm text-zinc-500">{t('online.yourCode')}</p>
                  </div>
                  
                  <div className="bg-black p-4 rounded-xl border border-zinc-800 break-all font-mono text-sm text-emerald-400 select-all">
                    {encodePlayerData({ name: gameState.playerName, car: gameState.currentCar })}
                  </div>
                  
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(encodePlayerData({ name: gameState.playerName, car: gameState.currentCar }));
                      alert(t('online.copied'));
                    }}
                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                  >
                    {t('online.copy')}
                  </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold uppercase tracking-widest text-red-400 mb-2">{t('online.opponentCode')}</h3>
                    <p className="text-sm text-zinc-500">{t('online.opponentCode')}</p>
                  </div>
                  
                  <textarea 
                    value={onlineCodeInput}
                    onChange={(e) => setOnlineCodeInput(e.target.value)}
                    placeholder={t('online.pasteHint')}
                    className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition-colors font-mono text-sm resize-none"
                  />
                  
                  <button 
                    onClick={startOnlineRace}
                    disabled={!onlineCodeInput}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <Play size={20} fill="currentColor" />
                    {t('online.challenge')}
                  </button>
                </div>
              </div>

              <div className="mt-auto flex justify-center">
                <button 
                  onClick={goToGarage}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                >
                  {t('garage')}
                </button>
              </div>
            </motion.div>
          )}

          {view === 'race' && (
            <motion.div 
              key="race"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full relative"
            >
              <Canvas shadows>
                <React.Suspense fallback={null}>
                  <PerspectiveCamera makeDefault position={[0, 8, 15]} />
                  <RaceScene 
                    playerCar={testRaceConfig ? testRaceConfig.playerCar : gameState.currentCar}
                    playerStats={testRaceConfig ? calculateStats(testRaceConfig.playerCar).stats : currentStats!}
                    opponentCar={testRaceConfig ? testRaceConfig.opponentCar : (onlineOpponent ? onlineOpponent.car : opponentCar)}
                    opponentStats={testRaceConfig ? calculateStats(testRaceConfig.opponentCar).stats : (onlineOpponent ? calculateStats(onlineOpponent.car).stats : opponentStats)}
                    timeScale={timeScale}
                    cameraView={cameraView}
                    stage={testRaceConfig ? testRaceConfig.stage : gameState.stage}
                    onFinish={handleRaceFinish}
                    onProgress={(playerProg, oppProg, pPos, oPos) => {
                      setRaceProgress({ player: playerProg, opponent: oppProg });
                      setRacePositions({ player: pPos, opponent: oPos });
                    }}
                    boostActive={boostActive}
                    onBoostReady={() => setBoostReady(true)}
                  />
                </React.Suspense>
              </Canvas>

              {/* Minimap */}
              <div className="absolute top-6 right-6 w-48 h-48 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 pointer-events-none">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <Map className="w-4 h-4" /> Minimap
                </div>
                <div className="relative w-full h-full">
                  {/* Track Path */}
                  <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path 
                      d={`M ${minimapPath} Z`} 
                      fill="none" 
                      stroke="rgba(255, 255, 255, 0.2)" 
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {/* Player Dot */}
                  <div 
                    className="absolute w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                    style={{ left: `${50 + racePositions.player[0] * 1.2}%`, top: `${50 + racePositions.player[1] * 1.2}%` }}
                  />
                  {/* Opponent Dot */}
                  <div 
                    className="absolute w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                    style={{ left: `${50 + racePositions.opponent[0] * 1.2}%`, top: `${50 + racePositions.opponent[1] * 1.2}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-32 right-6 flex flex-col gap-3">
                <button 
                  onClick={() => {
                    if (boostReady && !boostActive) {
                      setBoostActive(true);
                      setTimeout(() => setBoostActive(false), 3000); // Boost lasts 3 seconds
                    }
                  }}
                  disabled={!boostReady || boostActive}
                  className={cn(
                    "w-16 h-16 backdrop-blur-md border rounded-full flex items-center justify-center transition-all pointer-events-auto",
                    boostActive ? "bg-cyan-500/80 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.8)]" : 
                    boostReady ? "bg-yellow-500/80 border-yellow-400 text-white shadow-[0_0_15px_rgba(234,179,8,0.6)] hover:bg-yellow-400/90 animate-pulse" : 
                    "bg-black/60 border-white/10 text-white/30"
                  )}
                  title="Nitro Boost"
                >
                  <Flame className={cn("w-8 h-8", boostActive && "animate-bounce")} />
                </button>
                <button 
                  onClick={() => setCameraView(v => v === 'follow' ? 'top' : v === 'top' ? 'fpv' : 'follow')}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors pointer-events-auto self-end"
                  title="Switch Camera"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTimeScale(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors font-bold pointer-events-auto self-end"
                  title="Fast Forward"
                >
                  {timeScale === 1 ? <FastForward className="w-5 h-5" /> : `${timeScale}x`}
                </button>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-end p-12 pointer-events-none">
                <div className="w-full max-w-2xl bg-black/50 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-blue-400">
                      <span>{gameState.playerName} (You)</span>
                      <span>{Math.floor(Math.min(1, raceProgress.player) * 100)}%</span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-100 ease-linear" 
                        style={{ width: `${Math.min(1, raceProgress.player) * 100}%` }} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-red-400">
                      <span>{onlineOpponent ? onlineOpponent.name : 'Opponent'}</span>
                      <span>{Math.floor(Math.min(1, raceProgress.opponent) * 100)}%</span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all duration-100 ease-linear" 
                        style={{ width: `${Math.min(1, raceProgress.opponent) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'result' && raceResult && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex items-center justify-center p-12"
            >
              <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-center space-y-8 shadow-2xl shadow-black">
                <div className={cn(
                  "h-24 w-24 mx-auto rounded-3xl flex items-center justify-center",
                  raceResult.winner ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                )}>
                  <Trophy size={48} />
                </div>

                <div className="space-y-2">
                  <h2 className={cn(
                    "text-5xl font-black italic uppercase tracking-tighter",
                    raceResult.winner ? "text-emerald-400" : "text-red-400"
                  )}>
                    {raceResult.winner ? t('raceResults.victory') : t('raceResults.defeat')}
                  </h2>
                  <p className="text-zinc-500">
                    {raceResult.winner ? t('raceResults.victory') : t('raceResults.defeat')}
                  </p>
                  {gameState.bossDefeated && (
                    <div className="mt-4 p-4 bg-purple-500/20 border border-purple-500/50 rounded-xl text-purple-400 font-bold animate-pulse">
                      BOSS DEFEATED!
                    </div>
                  )}
                </div>

                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-xs text-zinc-500 uppercase font-bold">{t('money')}</div>
                      <div className="text-3xl font-mono font-bold text-yellow-500 flex items-center gap-2">
                        <Coins size={28} />
                        +{raceResult.reward}
                      </div>
                    </div>
                    <ChevronRight className="text-zinc-600" />
                  </div>
                  
                  {raceResult.breakdown && (
                    <div className="pt-4 border-t border-zinc-700/50 flex flex-col gap-2 text-sm">
                      <div className="flex justify-between text-zinc-400">
                        <span>Base Income</span>
                        <span className="font-mono text-yellow-500">+{raceResult.breakdown.base}</span>
                      </div>
                      {raceResult.breakdown.interest > 0 && (
                        <div className="flex justify-between text-zinc-400">
                          <span>Interest</span>
                          <span className="font-mono text-yellow-500">+{raceResult.breakdown.interest}</span>
                        </div>
                      )}
                      {raceResult.breakdown.streak > 0 && (
                        <div className="flex justify-between text-zinc-400">
                          <span className="flex items-center gap-1"><Flame size={14} className="text-emerald-400"/> Streak Bonus</span>
                          <span className="font-mono text-yellow-500">+{raceResult.breakdown.streak}</span>
                        </div>
                      )}
                      {raceResult.breakdown.win > 0 && (
                        <div className="flex justify-between text-zinc-400">
                          <span>Win Reward</span>
                          <span className="font-mono text-yellow-500">+{raceResult.breakdown.win}</span>
                        </div>
                      )}
                      {raceResult.breakdown.boss > 0 && (
                        <div className="flex justify-between text-zinc-400">
                          <span className="text-purple-400 font-bold">Boss Defeated</span>
                          <span className="font-mono text-yellow-500">+{raceResult.breakdown.boss}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={goToGarage}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                >
                  {t('garage')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
