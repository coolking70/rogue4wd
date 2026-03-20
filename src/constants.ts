import { Part, Manufacturer, Synergy } from './types';

export const MANUFACTURERS: Manufacturer[] = [
  {
    id: 'aero-tech',
    name: 'AeroTech (极速先锋)',
    description: '专注于空气动力学与极致速度。',
    focus: '速度与加速度',
    bonus: { speed: 10, acceleration: 5 }
  },
  {
    id: 'heavy-metal',
    name: 'HeavyMetal (重装工业)',
    description: '坚固耐用，提供极高的稳定性与防御力。',
    focus: '稳定性与防御',
    bonus: { stability: 15, defense: 10 }
  },
  {
    id: 'spark-core',
    name: 'SparkCore (闪电核心)',
    description: '先进的能源管理系统，爆发力惊人。',
    focus: '能量与加速度',
    bonus: { energy: 20, acceleration: 10 }
  }
];

export const INITIAL_PARTS: Part[] = [
  {
    id: 'base-chassis',
    name: '标准型底盘',
    type: 'chassis',
    manufacturer: 'Generic',
    price: 0,
    rarity: 'common',
    stats: { speed: 5, acceleration: 5, handling: 5, stability: 5, weight: 10, energy: 0 },
    description: '最基础的底盘，性能均衡。',
    tags: ['basic']
  },
  {
    id: 'basic-motor',
    name: '入门级马达',
    type: 'motor',
    manufacturer: 'Generic',
    price: 0,
    rarity: 'common',
    stats: { speed: 10, acceleration: 10, handling: 0, stability: 0, weight: 5, energy: -5 },
    description: '普通的马达，提供基础动力。',
    tags: ['basic']
  },
  // Add more parts as needed
];

export const SYNERGIES: Synergy[] = [
  {
    id: 'plasma-overload',
    name: '等离子过载',
    description: '同时装备等离子马达与核能电池时，速度额外+15%',
    requiredParts: ['plasma', 'energy'],
    bonus: { speed: 15 }
  },
  {
    id: 'aero-master',
    name: '空力大师',
    description: '装备3件以上带有 "aero" 标签的零件时，加速度+20%',
    requiredParts: ['aero', 'aero', 'aero'],
    bonus: { acceleration: 20 }
  }
];

export const SHOP_PARTS: Part[] = [
  {
    id: 'plasma-motor',
    name: '等离子马达',
    type: 'motor',
    manufacturer: 'SparkCore',
    price: 150,
    rarity: 'rare',
    stats: { speed: 25, acceleration: 20, handling: -5, stability: -5, weight: 8, energy: -15 },
    description: '高能耗但爆发力极强的马达。',
    tags: ['plasma', 'high-speed']
  },
  {
    id: 'carbon-body',
    name: '碳纤维车壳',
    type: 'body',
    manufacturer: 'AeroTech',
    price: 120,
    rarity: 'rare',
    stats: { speed: 10, acceleration: 15, handling: 5, stability: 0, weight: -10, energy: 0 },
    description: '极轻的材质，大幅提升灵活性。',
    tags: ['lightweight', 'aero']
  },
  {
    id: 'spiked-tire',
    name: '防滑钉胎',
    type: 'tire',
    manufacturer: 'HeavyMetal',
    price: 80,
    rarity: 'common',
    stats: { speed: -5, acceleration: 5, handling: 15, stability: 20, weight: 5, energy: 0 },
    description: '在复杂赛道上表现出色。',
    tags: ['grip', 'stability']
  },
  {
    id: 'nuclear-battery',
    name: '核能电池',
    type: 'battery',
    manufacturer: 'SparkCore',
    price: 200,
    rarity: 'epic',
    stats: { speed: 5, acceleration: 5, handling: 0, stability: 0, weight: 15, energy: 100 },
    description: '几乎无限的能源，但非常沉重。',
    tags: ['energy', 'heavy']
  },
  {
    id: 'laser-cannon',
    name: '微型激光炮',
    type: 'weapon',
    manufacturer: 'HeavyMetal',
    price: 250,
    rarity: 'epic',
    stats: { speed: -5, acceleration: -5, handling: -5, stability: 0, weight: 20, energy: -20, attack: 30 },
    description: '干扰对手的强力武器。',
    tags: ['weapon', 'attack']
  },
  {
    id: 'titanium-chassis',
    name: '钛合金底盘',
    type: 'chassis',
    manufacturer: 'HeavyMetal',
    price: 180,
    rarity: 'rare',
    stats: { speed: 0, acceleration: 5, handling: 10, stability: 25, weight: 15, energy: 0 },
    description: '极其稳固的底盘，适合高难度赛道。',
    tags: ['heavy', 'stability']
  },
  {
    id: 'super-charger',
    name: '超级增压器',
    type: 'special',
    manufacturer: 'AeroTech',
    price: 160,
    rarity: 'rare',
    stats: { speed: 15, acceleration: 25, handling: -10, stability: -5, weight: 5, energy: -10 },
    description: '牺牲稳定性换取极致的爆发力。',
    tags: ['aero', 'boost']
  },
  {
    id: 'smart-chip',
    name: '智能AI芯片',
    type: 'special',
    manufacturer: 'Generic',
    price: 140,
    rarity: 'rare',
    stats: { speed: 5, acceleration: 5, handling: 20, stability: 10, weight: 2, energy: -5 },
    description: '优化行车路径，显著提升操控性。',
    tags: ['tech', 'ai']
  }
];
