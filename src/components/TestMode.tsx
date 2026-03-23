import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Play, Settings, Map as MapIcon, Car as CarIcon } from 'lucide-react';
import { Car, Part, PartType } from '../types';
import { INITIAL_PARTS, SHOP_PARTS, TRACKS } from '../constants';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

const ALL_PARTS = [...INITIAL_PARTS, ...SHOP_PARTS];

interface TestModeProps {
  playerCar: Car;
  onStartRace: (playerCar: Car, opponentCar: Car, stage: number) => void;
  onClose: () => void;
}

export const TestMode: React.FC<TestModeProps> = ({ playerCar, onStartRace, onClose }) => {
  const { t } = useTranslation();
  const [stage, setStage] = useState(1);
  const [testPlayerCar, setTestPlayerCar] = useState<Car>(playerCar);
  const [testOpponentCar, setTestOpponentCar] = useState<Car>({
    manufacturer: playerCar.manufacturer,
    parts: { ...playerCar.parts }
  });

  const handlePartChange = (isPlayer: boolean, type: PartType, partId: string) => {
    const part = ALL_PARTS.find(p => p.id === partId);
    if (!part) return;

    if (isPlayer) {
      setTestPlayerCar(prev => ({
        ...prev,
        parts: { ...prev.parts, [type]: part }
      }));
    } else {
      setTestOpponentCar(prev => ({
        ...prev,
        parts: { ...prev.parts, [type]: part }
      }));
    }
  };

  const renderPartSelect = (isPlayer: boolean, type: PartType) => {
    const currentCar = isPlayer ? testPlayerCar : testOpponentCar;
    const currentPart = currentCar.parts[type];
    const availableParts = ALL_PARTS.filter(p => p.type === type);

    return (
      <div key={type} className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 uppercase font-bold">{type}</label>
        <select
          value={currentPart?.id || ''}
          onChange={(e) => handlePartChange(isPlayer, type, e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        >
          <option value="">None</option>
          {availableParts.map(p => (
            <option key={p.id} value={p.id}>
              [{p.rarity}] {p.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const partTypes: PartType[] = ['chassis', 'body', 'motor', 'tire', 'battery', 'special', 'weapon'];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-8 flex flex-col gap-8 overflow-y-auto"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter">Test Mode</h2>
          <p className="text-zinc-500">Freely configure cars and map</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Selection */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-blue-400 mb-4">
            <MapIcon size={24} />
            <h3 className="text-xl font-bold uppercase tracking-widest">Map</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TRACKS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStage(i + 1)}
                className={cn(
                  "p-3 rounded-xl font-bold transition-colors",
                  stage === i + 1 ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
              >
                Stage {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Player Car */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <CarIcon size={24} />
            <h3 className="text-xl font-bold uppercase tracking-widest">Player Car</h3>
          </div>
          <div className="space-y-3">
            {partTypes.map(type => renderPartSelect(true, type))}
          </div>
        </div>

        {/* Opponent Car */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-red-400 mb-4">
            <CarIcon size={24} />
            <h3 className="text-xl font-bold uppercase tracking-widest">Opponent Car</h3>
          </div>
          <div className="space-y-3">
            {partTypes.map(type => renderPartSelect(false, type))}
          </div>
        </div>
      </div>

      <div className="mt-auto flex justify-center gap-4">
        <button 
          onClick={onClose}
          className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors"
        >
          {t('garage')}
        </button>
        <button 
          onClick={() => onStartRace(testPlayerCar, testOpponentCar, stage)}
          className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <Play size={20} fill="currentColor" />
          Start Test Race
        </button>
      </div>
    </motion.div>
  );
};
