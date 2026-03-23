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
  // AeroTech
  { id: 'at-chassis-1', name: 'AT-1 轻量底盘', type: 'chassis', manufacturer: 'aero-tech', price: 0, rarity: 'common', stats: { speed: 10, acceleration: 10, handling: 5, stability: 0, weight: 5, energy: 0 }, description: 'AeroTech 基础轻量化底盘。', tags: ['aero-tech', 'lightweight'] },
  { id: 'at-body-1', name: 'AT 流线外壳', type: 'body', manufacturer: 'aero-tech', price: 0, rarity: 'common', stats: { speed: 5, acceleration: 5, handling: 5, stability: 0, weight: 3, energy: 0 }, description: '符合空气动力学的基础外壳。', tags: ['aero-tech', 'aero'] },
  { id: 'at-motor-1', name: 'AT 高转速马达', type: 'motor', manufacturer: 'aero-tech', price: 0, rarity: 'common', stats: { speed: 15, acceleration: 10, handling: 0, stability: 0, weight: 4, energy: -10 }, description: '提供较高极速的基础马达。', tags: ['aero-tech', 'speed'] },
  { id: 'at-tire-1', name: 'AT 竞速窄胎', type: 'tire', manufacturer: 'aero-tech', price: 0, rarity: 'common', stats: { speed: 5, acceleration: 5, handling: 0, stability: -5, weight: 2, energy: 0 }, description: '减少阻力的窄胎。', tags: ['aero-tech', 'speed'] },
  { id: 'at-battery-1', name: 'AT 微型电池', type: 'battery', manufacturer: 'aero-tech', price: 0, rarity: 'common', stats: { speed: 0, acceleration: 0, handling: 0, stability: 0, weight: 3, energy: 30 }, description: '容量较小但极轻的电池。', tags: ['aero-tech', 'lightweight'] },
  
  // HeavyMetal
  { id: 'hm-chassis-1', name: 'HM-1 钢骨底盘', type: 'chassis', manufacturer: 'heavy-metal', price: 0, rarity: 'common', stats: { speed: 0, acceleration: 0, handling: 5, stability: 15, weight: 15, energy: 0 }, description: 'HeavyMetal 坚固的钢制底盘。', tags: ['heavy-metal', 'heavy'] },
  { id: 'hm-body-1', name: 'HM 装甲外壳', type: 'body', manufacturer: 'heavy-metal', price: 0, rarity: 'common', stats: { speed: -5, acceleration: -5, handling: 0, stability: 10, weight: 10, energy: 0 }, description: '抗撞击的厚重外壳。', tags: ['heavy-metal', 'defense'] },
  { id: 'hm-motor-1', name: 'HM 扭力马达', type: 'motor', manufacturer: 'heavy-metal', price: 0, rarity: 'common', stats: { speed: 5, acceleration: 15, handling: 0, stability: 5, weight: 8, energy: -5 }, description: '扭力强大的基础马达。', tags: ['heavy-metal', 'torque'] },
  { id: 'hm-tire-1', name: 'HM 宽幅越野胎', type: 'tire', manufacturer: 'heavy-metal', price: 0, rarity: 'common', stats: { speed: -5, acceleration: 5, handling: 10, stability: 10, weight: 6, energy: 0 }, description: '抓地力极强的宽胎。', tags: ['heavy-metal', 'grip'] },
  { id: 'hm-battery-1', name: 'HM 工业电池', type: 'battery', manufacturer: 'heavy-metal', price: 0, rarity: 'common', stats: { speed: 0, acceleration: 0, handling: 0, stability: 0, weight: 10, energy: 50 }, description: '容量大但沉重的电池。', tags: ['heavy-metal', 'energy'] },

  // SparkCore
  { id: 'sc-chassis-1', name: 'SC-1 导电底盘', type: 'chassis', manufacturer: 'spark-core', price: 0, rarity: 'common', stats: { speed: 5, acceleration: 10, handling: 5, stability: 5, weight: 8, energy: 10 }, description: 'SparkCore 优化能量传输的底盘。', tags: ['spark-core', 'energy'] },
  { id: 'sc-body-1', name: 'SC 霓虹外壳', type: 'body', manufacturer: 'spark-core', price: 0, rarity: 'common', stats: { speed: 0, acceleration: 5, handling: 5, stability: 0, weight: 5, energy: 5 }, description: '带有能量回路的炫酷外壳。', tags: ['spark-core', 'energy'] },
  { id: 'sc-motor-1', name: 'SC 脉冲马达', type: 'motor', manufacturer: 'spark-core', price: 0, rarity: 'common', stats: { speed: 10, acceleration: 15, handling: 0, stability: 0, weight: 6, energy: -15 }, description: '耗电快但加速迅猛的马达。', tags: ['spark-core', 'acceleration'] },
  { id: 'sc-tire-1', name: 'SC 磁悬浮胎', type: 'tire', manufacturer: 'spark-core', price: 0, rarity: 'common', stats: { speed: 5, acceleration: 5, handling: 10, stability: -5, weight: 4, energy: -5 }, description: '微弱磁悬浮效果，提升操控。', tags: ['spark-core', 'handling'] },
  { id: 'sc-battery-1', name: 'SC 聚能电池', type: 'battery', manufacturer: 'spark-core', price: 0, rarity: 'common', stats: { speed: 0, acceleration: 0, handling: 0, stability: 0, weight: 6, energy: 60 }, description: '高效储能的基础电池。', tags: ['spark-core', 'energy'] },
];

export const SHOP_PROBABILITIES = {
  1: { common: 100, rare: 0, epic: 0, legendary: 0 },
  2: { common: 80, rare: 20, epic: 0, legendary: 0 },
  3: { common: 60, rare: 35, epic: 5, legendary: 0 },
  4: { common: 40, rare: 45, epic: 15, legendary: 0 },
  5: { common: 25, rare: 45, epic: 25, legendary: 5 },
  6: { common: 15, rare: 40, epic: 35, legendary: 10 },
  7: { common: 10, rare: 30, epic: 40, legendary: 20 },
  8: { common: 5, rare: 20, epic: 45, legendary: 30 },
  9: { common: 0, rare: 10, epic: 50, legendary: 40 },
  10: { common: 0, rare: 0, epic: 40, legendary: 60 },
};

export const SYNERGIES: Synergy[] = [
  {
    id: 'aero-tech-2',
    name: 'AeroTech (2)',
    description: '装备2件 AeroTech 零件：极速+10%',
    requiredParts: ['aero-tech', 'aero-tech'],
    bonus: { speed: 10 }
  },
  {
    id: 'aero-tech-4',
    name: 'AeroTech (4)',
    description: '装备4件 AeroTech 零件：极速+25%',
    requiredParts: ['aero-tech', 'aero-tech', 'aero-tech', 'aero-tech'],
    bonus: { speed: 25 }
  },
  {
    id: 'heavy-metal-2',
    name: 'HeavyMetal (2)',
    description: '装备2件 HeavyMetal 零件：稳定性+15%',
    requiredParts: ['heavy-metal', 'heavy-metal'],
    bonus: { stability: 15 }
  },
  {
    id: 'heavy-metal-4',
    name: 'HeavyMetal (4)',
    description: '装备4件 HeavyMetal 零件：稳定性+35%',
    requiredParts: ['heavy-metal', 'heavy-metal', 'heavy-metal', 'heavy-metal'],
    bonus: { stability: 35 }
  },
  {
    id: 'spark-core-2',
    name: 'SparkCore (2)',
    description: '装备2件 SparkCore 零件：能量+20%',
    requiredParts: ['spark-core', 'spark-core'],
    bonus: { energy: 20 }
  },
  {
    id: 'spark-core-4',
    name: 'SparkCore (4)',
    description: '装备4件 SparkCore 零件：能量+50%',
    requiredParts: ['spark-core', 'spark-core', 'spark-core', 'spark-core'],
    bonus: { energy: 50 }
  },
  {
    id: 'speed-2',
    name: '极速先锋 (2)',
    description: '装备2件 "speed" 标签零件：加速度+15%',
    requiredParts: ['speed', 'speed'],
    bonus: { acceleration: 15 }
  },
  {
    id: 'energy-2',
    name: '能量核心 (2)',
    description: '装备2件 "energy" 标签零件：能量+30%',
    requiredParts: ['energy', 'energy'],
    bonus: { energy: 30 }
  }
];

export const SHOP_PARTS: Part[] = [
  // Motors
  {
    id: 'plasma-motor',
    name: '等离子马达',
    type: 'motor',
    manufacturer: 'spark-core',
    price: 2,
    rarity: 'rare',
    stats: { speed: 25, acceleration: 20, handling: -5, stability: -5, weight: 8, energy: -15 },
    description: '高能耗但爆发力极强的马达。',
    tags: ['plasma', 'high-speed']
  },
  {
    id: 'v2-motor',
    name: 'V2 强化马达',
    type: 'motor',
    manufacturer: 'aero-tech',
    price: 1,
    rarity: 'common',
    stats: { speed: 15, acceleration: 15, handling: 0, stability: 0, weight: 6, energy: -8 },
    description: '比入门级马达更强劲。',
    tags: ['speed']
  },
  {
    id: 'v3-motor',
    name: 'V3 竞速马达',
    type: 'motor',
    manufacturer: 'aero-tech',
    price: 3,
    rarity: 'epic',
    stats: { speed: 35, acceleration: 30, handling: -10, stability: -10, weight: 10, energy: -25 },
    description: '职业赛车手专用的顶级马达。',
    tags: ['speed', 'aero']
  },
  // Bodies
  {
    id: 'carbon-body',
    name: '碳纤维车壳',
    type: 'body',
    manufacturer: 'aero-tech',
    price: 2,
    rarity: 'rare',
    stats: { speed: 10, acceleration: 15, handling: 5, stability: 0, weight: -10, energy: 0 },
    description: '极轻的材质，大幅提升灵活性。',
    tags: ['lightweight', 'aero']
  },
  {
    id: 'alloy-body',
    name: '合金装甲车壳',
    type: 'body',
    manufacturer: 'heavy-metal',
    price: 2,
    rarity: 'rare',
    stats: { speed: -5, acceleration: -5, handling: -5, stability: 25, weight: 15, energy: 0 },
    description: '沉重但极其坚固。',
    tags: ['heavy', 'defense']
  },
  // Tires
  {
    id: 'spiked-tire',
    name: '防滑钉胎',
    type: 'tire',
    manufacturer: 'heavy-metal',
    price: 1,
    rarity: 'common',
    stats: { speed: -5, acceleration: 5, handling: 15, stability: 20, weight: 5, energy: 0 },
    description: '在复杂赛道上表现出色。',
    tags: ['grip', 'stability', 'heavy']
  },
  {
    id: 'slick-tire',
    name: '光头胎',
    type: 'tire',
    manufacturer: 'aero-tech',
    price: 2,
    rarity: 'rare',
    stats: { speed: 15, acceleration: 10, handling: -5, stability: -10, weight: 3, energy: 0 },
    description: '极致降低摩擦力，专为直线加速设计。',
    tags: ['speed', 'aero']
  },
  // Batteries
  {
    id: 'nuclear-battery',
    name: '核能电池',
    type: 'battery',
    manufacturer: 'spark-core',
    price: 3,
    rarity: 'epic',
    stats: { speed: 5, acceleration: 5, handling: 0, stability: 0, weight: 15, energy: 100 },
    description: '几乎无限的能源，但非常沉重。',
    tags: ['energy', 'heavy']
  },
  {
    id: 'lithium-battery',
    name: '高能锂电池',
    type: 'battery',
    manufacturer: 'spark-core',
    price: 1,
    rarity: 'common',
    stats: { speed: 0, acceleration: 0, handling: 0, stability: 0, weight: 4, energy: 40 },
    description: '轻量化且电量充足。',
    tags: ['energy', 'lightweight']
  },
  // Chassis
  {
    id: 'titanium-chassis',
    name: '钛合金底盘',
    type: 'chassis',
    manufacturer: 'heavy-metal',
    price: 2,
    rarity: 'rare',
    stats: { speed: 0, acceleration: 5, handling: 10, stability: 25, weight: 15, energy: 0 },
    description: '极其稳固的底盘，适合高难度赛道。',
    tags: ['heavy', 'stability']
  },
  {
    id: 'aero-chassis',
    name: '破风底盘',
    type: 'chassis',
    manufacturer: 'aero-tech',
    price: 2,
    rarity: 'rare',
    stats: { speed: 15, acceleration: 10, handling: 5, stability: -5, weight: -5, energy: 0 },
    description: '流线型设计，减少风阻。',
    tags: ['aero', 'speed']
  },
  {
    id: 'carbon-chassis',
    name: '碳纤维底盘',
    type: 'chassis',
    manufacturer: 'aero-tech',
    price: 3,
    rarity: 'epic',
    stats: { speed: 20, acceleration: 20, handling: 10, stability: -10, weight: -15, energy: 0 },
    description: '极致轻量化，专为竞速而生。',
    tags: ['aero', 'lightweight']
  },
  // Specials & Weapons
  {
    id: 'laser-cannon',
    name: '微型激光炮',
    type: 'weapon',
    manufacturer: 'heavy-metal',
    price: 3,
    rarity: 'epic',
    stats: { speed: -5, acceleration: -5, handling: -5, stability: 0, weight: 20, energy: -20, attack: 30 },
    description: '干扰对手的强力武器。',
    tags: ['weapon', 'attack']
  },
  {
    id: 'plasma-shield',
    name: '等离子护盾',
    type: 'special',
    manufacturer: 'spark-core',
    price: 3,
    rarity: 'epic',
    stats: { speed: -2, acceleration: -2, handling: 5, stability: 30, weight: 10, energy: -15 },
    description: '生成能量场，大幅提升稳定性。',
    tags: ['plasma', 'defense']
  },
  {
    id: 'super-charger',
    name: '超级增压器',
    type: 'special',
    manufacturer: 'aero-tech',
    price: 2,
    rarity: 'rare',
    stats: { speed: 15, acceleration: 25, handling: -10, stability: -5, weight: 5, energy: -10 },
    description: '牺牲稳定性换取极致的爆发力。',
    tags: ['aero', 'boost']
  },
  {
    id: 'smart-chip',
    name: '智能AI芯片',
    type: 'special',
    manufacturer: 'generic',
    price: 2,
    rarity: 'rare',
    stats: { speed: 5, acceleration: 5, handling: 20, stability: 10, weight: 2, energy: -5 },
    description: '优化行车路径，显著提升操控性。',
    tags: ['tech', 'ai']
  },
  {
    id: 'quantum-core',
    name: '量子核心',
    type: 'special',
    manufacturer: 'spark-core',
    price: 4,
    rarity: 'legendary',
    stats: { speed: 30, acceleration: 30, handling: 30, stability: 30, weight: -10, energy: 50 },
    description: '传说中的终极配件，全方位提升赛车性能。',
    tags: ['legendary', 'plasma', 'energy']
  },
  {
    id: 'gravity-anchor',
    name: '重力锚定器',
    type: 'special',
    manufacturer: 'heavy-metal',
    price: 4,
    rarity: 'legendary',
    stats: { speed: -10, acceleration: -10, handling: 10, stability: 100, weight: 50, energy: -20 },
    description: '让赛车稳如泰山，绝不翻车。',
    tags: ['legendary', 'heavy', 'stability']
  },
  {
    id: 'at-legendary-body',
    name: 'AT 幻影外壳',
    type: 'body',
    manufacturer: 'aero-tech',
    price: 4,
    rarity: 'legendary',
    stats: { speed: 40, acceleration: 20, handling: 15, stability: -5, weight: -20, energy: 0 },
    description: '传说中的空气动力学巅峰之作，轻如鸿毛。',
    tags: ['legendary', 'aero', 'lightweight']
  },
  {
    id: 'hm-epic-motor',
    name: 'HM 工业巨兽马达',
    type: 'motor',
    manufacturer: 'heavy-metal',
    price: 3,
    rarity: 'epic',
    stats: { speed: 10, acceleration: 40, handling: -10, stability: 15, weight: 25, energy: -30 },
    description: '提供无与伦比的扭矩，无视任何阻力。',
    tags: ['epic', 'heavy', 'torque']
  },
  {
    id: 'sc-epic-tire',
    name: 'SC 闪电磁悬浮胎',
    type: 'tire',
    manufacturer: 'spark-core',
    price: 3,
    rarity: 'epic',
    stats: { speed: 20, acceleration: 25, handling: 20, stability: -15, weight: 5, energy: -15 },
    description: '极高能耗的磁悬浮轮胎，带来极致的加速和操控。',
    tags: ['epic', 'plasma', 'handling']
  }
];

// Track coordinates [x, y, z] for different stages
export const TRACKS: [number, number, number][][] = [
  // Stage 1: Simple Loop
  [
    [0, 0, 20], [20, 0, 10], [15, 0, -15], [-15, 0, -15], [-20, 0, 10]
  ],
  // Stage 2: Diamond
  [
    [0, 0, 25], [25, 0, 5], [10, 0, -20], [-10, 0, -20], [-25, 0, 5]
  ],
  // Stage 3: Complex Loop
  [
    [0, 0, 30], [20, 0, 15], [30, 0, -10], [0, 0, -25], [-30, 0, -10], [-20, 0, 15]
  ],
  // Stage 4: Figure 8ish (CatmullRom will smooth it)
  [
    [0, 0, 35], [25, 0, 20], [10, 0, -10], [30, 0, -30], [0, 0, -40], [-30, 0, -30], [-10, 0, -10], [-25, 0, 20]
  ],
  // Stage 5: Mountain Pass (Elevation changes and tight turns)
  [
    [0, 0, 40], [20, 50, 20], [40, 150, -10], [10, 200, -30], [-20, 100, -40], [-40, 0, -10], [-20, -50, 20]
  ],
  // Stage 6: The Corkscrew (Rapid drops and winding sections)
  [
    [0, 0, 30], [30, 100, 30], [30, 200, 0], [0, 300, -30], [-30, 150, -30], [-30, 0, 0], [-15, -100, 15]
  ]
];
