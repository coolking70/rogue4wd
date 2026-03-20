import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Float } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ShoppingCart, Settings, Play, RefreshCw, Coins, ChevronRight, Info, Zap, Shield, Gauge, Camera, FastForward, Map, Globe } from 'lucide-react';
import * as THREE from 'three';
import { CarModel } from './components/CarModel';
import { RaceScene } from './components/RaceScene';
import { GameState, Car, Part, Manufacturer, Stats } from './types';
import { SYNERGIES, MANUFACTURERS, INITIAL_PARTS, SHOP_PARTS } from './constants';
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

const generateShop = (day: number, currentManufacturerId?: string): Part[] => {
  // Filter parts based on day (e.g., epic/legendary appear later)
  const availableParts = SHOP_PARTS.filter(p => {
    if (p.rarity === 'legendary' && day < 15) return false;
    if (p.rarity === 'epic' && day < 5) return false;
    return true;
  });

  // Give higher weight to parts from the same manufacturer
  const weightedParts = availableParts.flatMap(p => {
    if (p.manufacturer === currentManufacturerId) {
      return [p, p, p]; // 3x chance
    }
    return [p];
  });

  const shuffled = [...weightedParts].sort(() => 0.5 - Math.random());
  
  // Deduplicate
  const uniqueParts: Part[] = [];
  for (const part of shuffled) {
    if (!uniqueParts.find(p => p.id === part.id)) {
      uniqueParts.push(part);
    }
    if (uniqueParts.length >= 4) break;
  }
  
  // Fallback if not enough unique parts
  if (uniqueParts.length < 4) {
    const moreShuffled = [...SHOP_PARTS].sort(() => 0.5 - Math.random());
    for (const part of moreShuffled) {
      if (!uniqueParts.find(p => p.id === part.id)) {
        uniqueParts.push(part);
      }
      if (uniqueParts.length >= 4) break;
    }
  }

  return uniqueParts;
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

// --- Main App ---

export default function App() {
  const { t, lang, toggleLang } = useTranslation();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'start' | 'garage' | 'shop' | 'race' | 'result' | 'online'>('start');
  const [shopItems, setShopItems] = useState<Part[]>([]);
  const [raceResult, setRaceResult] = useState<{ winner: boolean, reward: number } | null>(null);
  const [activePartType, setActivePartType] = useState<string | null>(null);
  const [raceProgress, setRaceProgress] = useState({ player: 0, opponent: 0 });
  const [racePositions, setRacePositions] = useState({ player: [0, 0], opponent: [0, 0] });
  const [timeScale, setTimeScale] = useState(1);
  const [cameraView, setCameraView] = useState<'follow' | 'top' | 'fpv'>('follow');
  const [equipFlash, setEquipFlash] = useState(0);
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [onlineCodeInput, setOnlineCodeInput] = useState('');
  const [onlineOpponent, setOnlineOpponent] = useState<PlayerData | null>(null);

  // Initialize Game
  const startGame = (manufacturer: Manufacturer) => {
    const initialCar: Car = {
      manufacturer,
      parts: {
        chassis: INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === 'chassis'),
        body: INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === 'body'),
        motor: INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === 'motor'),
        tire: INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === 'tire'),
        battery: INITIAL_PARTS.find(p => p.manufacturer === manufacturer.id && p.type === 'battery'),
      }
    };
    setGameState({
      playerName: playerNameInput || 'Player',
      money: 200,
      currentCar: initialCar,
      inventory: [],
      day: 1,
      stage: 1,
      bossDefeated: false,
      wins: 0,
      losses: 0
    });
    setShopItems(generateShop(1, manufacturer.id));
    setView('garage');
  };

  const currentData = useMemo(() => {
    if (!gameState) return null;
    return calculateStats(gameState.currentCar);
  }, [gameState]);

  const currentStats = currentData?.stats;
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
    const baseScale = (gameState.day - 1) * 1.5 + (gameState.stage - 1) * 8;
    const finalStats = {
      speed: stats.speed + baseScale,
      acceleration: stats.acceleration + baseScale,
      handling: stats.handling + baseScale,
      stability: stats.stability + baseScale,
      weight: stats.weight,
      energy: stats.energy,
      attack: stats.attack || 0,
      defense: stats.defense || 0
    };

    return { opponentCar: car, opponentStats: finalStats };
  }, [gameState?.day, gameState?.stage]);

  const handleBuy = (part: Part) => {
    if (!gameState || gameState.money < part.price) return;
    setGameState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        money: prev.money - part.price,
        inventory: [...prev.inventory, part]
      };
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

  const startRace = () => {
    setOnlineOpponent(null); // Clear online opponent if starting a normal race
    setRaceProgress({ player: 0, opponent: 0 });
    setRacePositions({ player: [0, 0], opponent: [0, 0] });
    setTimeScale(1);
    setCameraView('follow');
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
      setView('race');
    } else {
      alert(t('online.invalidCode'));
    }
  };

  const handleRaceFinish = (isWinner: boolean) => {
    if (!gameState) return;
    
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
    const reward = isWinner ? (isBoss ? 500 : 150) : 50;
    
    setRaceResult({ winner: isWinner, reward });
    setGameState(prev => {
      if (!prev) return null;
      
      const newDay = prev.day + 1;
      const newStage = (isWinner && isBoss) ? prev.stage + 1 : prev.stage;
      const bossDefeated = isWinner && isBoss ? true : prev.bossDefeated;

      setShopItems(generateShop(newDay, prev.currentCar.manufacturer.id));

      return {
        ...prev,
        money: prev.money + reward,
        day: newDay,
        stage: newStage,
        bossDefeated: bossDefeated,
        wins: isWinner ? prev.wins + 1 : prev.wins,
        losses: isWinner ? prev.losses : prev.losses + 1
      };
    });
    setView('result');
  };

  const refreshShop = () => {
    setView('shop');
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
      <div className="w-80 bg-zinc-900/50 border-r border-zinc-800 p-6 flex flex-col gap-8 z-20">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-1 text-yellow-500 font-mono font-bold">
              <Coins size={16} />
              <span>{gameState.money}</span>
            </div>
          </div>

          <div className="space-y-6">
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

        <div className="mt-auto space-y-2">
          <button 
            onClick={() => setView('garage')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
              view === 'garage' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-zinc-800 text-zinc-400"
            )}
          >
            <Settings size={20} />
            <span className="font-bold">{t('garage')}</span>
          </button>
          <button 
            onClick={refreshShop}
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
                <Canvas shadows>
                  <PerspectiveCamera makeDefault position={[4, 3, 5]} />
                  <OrbitControls enablePan={false} minDistance={3} maxDistance={8} />
                  <Environment preset="city" />
                  <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                  <ambientLight intensity={0.5} />
                  <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                  
                  <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                    <CarModel car={gameState.currentCar} equipFlash={equipFlash} />
                  </Float>

                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#09090b" roughness={0.8} />
                  </mesh>
                  <gridHelper args={[20, 20, '#18181b', '#09090b']} position={[0, -0.49, 0]} />
                </Canvas>

                {/* Part Slots Overlay */}
                <div className="absolute top-8 right-8 flex flex-col gap-4">
                  {['chassis', 'body', 'motor', 'tire', 'battery', 'weapon'].map((type) => (
                    <div key={type} className="group relative">
                      <div className={cn(
                        "h-14 w-14 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer",
                        gameState.currentCar.parts[type as keyof Car['parts']] 
                          ? "bg-zinc-900 border-blue-500 shadow-lg shadow-blue-500/20" 
                          : "bg-zinc-900/50 border-zinc-800 border-dashed hover:border-zinc-600"
                      )}>
                        {gameState.currentCar.parts[type as keyof Car['parts']] ? (
                          <div className="text-[10px] font-bold text-center px-1 truncate">
                            {gameState.currentCar.parts[type as keyof Car['parts']]?.name}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-600 uppercase font-bold">{type}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inventory Drawer */}
              <div className="h-64 bg-zinc-900 border-t border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold italic uppercase flex items-center gap-2">
                    <RefreshCw size={18} className="text-blue-500" />
                    {t('garage')}
                  </h3>
                  <span className="text-xs text-zinc-500">{t('online.pasteHint')}</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {gameState.inventory.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-600 italic">
                      {t('online.pasteHint')}
                    </div>
                  ) : (
                    gameState.inventory.map((part) => (
                      <motion.button
                        key={part.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => equipPart(part)}
                        className="flex-shrink-0 w-40 bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-left space-y-2 hover:border-blue-500 transition-colors"
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
                      </motion.button>
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
                <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-zinc-500 uppercase font-bold">{t('money')}</div>
                    <div className="text-2xl font-mono font-bold text-yellow-500 flex items-center gap-2">
                      <Coins size={24} />
                      {gameState.money}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  onClick={() => setView('garage')}
                  className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
                >
                  返回车库
                </button>
              </div>
            </motion.div>
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
                  onClick={() => setView('garage')}
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
                <PerspectiveCamera makeDefault position={[0, 8, 15]} />
                <RaceScene 
                  playerCar={gameState.currentCar}
                  playerStats={currentStats!}
                  opponentCar={onlineOpponent ? onlineOpponent.car : opponentCar}
                  opponentStats={onlineOpponent ? calculateStats(onlineOpponent.car).stats : opponentStats}
                  timeScale={timeScale}
                  cameraView={cameraView}
                  stage={gameState.stage}
                  onFinish={handleRaceFinish}
                  onProgress={(playerProg, oppProg, pPos, oPos) => {
                    setRaceProgress({ player: playerProg, opponent: oppProg });
                    setRacePositions({ player: pPos, opponent: oPos });
                  }}
                />
              </Canvas>

              {/* Minimap */}
              <div className="absolute top-6 right-6 w-48 h-48 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 pointer-events-none">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <Map className="w-4 h-4" /> Minimap
                </div>
                <div className="relative w-full h-full">
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
                  onClick={() => setCameraView(v => v === 'follow' ? 'top' : v === 'top' ? 'fpv' : 'follow')}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors pointer-events-auto"
                  title="Switch Camera"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTimeScale(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                  className="w-12 h-12 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors font-bold pointer-events-auto"
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

                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 flex items-center justify-between">
                  <div className="text-left">
                    <div className="text-xs text-zinc-500 uppercase font-bold">{t('money')}</div>
                    <div className="text-3xl font-mono font-bold text-yellow-500 flex items-center gap-2">
                      <Coins size={28} />
                      +{raceResult.reward}
                    </div>
                  </div>
                  <ChevronRight className="text-zinc-600" />
                </div>

                <button 
                  onClick={() => setView('garage')}
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
