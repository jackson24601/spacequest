/**
 * Enemy archetypes for hallway encounters.
 */
window.SpaceQuestEnemies = (() => {
  const LEVEL_ONE_ALIEN = {
    type: "alien-l1",
    name: "Level 1 Alien",
    sprite: "assets/sprites/alien-l1.png",
    deadSprite: "assets/sprites/alien-l1-dead.png",
    hp: 5,
    maxHp: 5,
    attackDamage: 1,
    hitChance: 0.25,
    speed: 95,
    w: 56,
    h: 84,
  };

  const LEVEL_TWO_ALIEN = {
    type: "alien-l2",
    name: "Level 2 Alien",
    sprite: "assets/sprites/alien-l2.png",
    deadSprite: "assets/sprites/alien-l2-dead.png",
    hp: 1,
    maxHp: 1,
    attackDamage: 5,
    hitChance: 0.5,
    speed: 100,
    w: 84,
    h: 91,
  };

  // Twice the Level 1 footprint — larger than every other alien
  const BOSS_ALIEN = {
    type: "alien-boss",
    name: "Boss Alien",
    sprite: "assets/sprites/alien-l2.png",
    deadSprite: "assets/sprites/alien-l2-dead.png",
    hp: 50,
    maxHp: 50,
    attackDamage: 5,
    hitChance: 1,
    speed: 110,
    w: LEVEL_ONE_ALIEN.w * 2,
    h: LEVEL_ONE_ALIEN.h * 2,
  };

  function createLevelOneAlien(overrides = {}) {
    return {
      ...LEVEL_ONE_ALIEN,
      id: overrides.id || `alien-l1-${Date.now()}`,
      defeated: false,
      bob: Math.random() * Math.PI * 2,
      ...overrides,
    };
  }

  function createLevelTwoAlien(overrides = {}) {
    return {
      ...LEVEL_TWO_ALIEN,
      id: overrides.id || `alien-l2-${Date.now()}`,
      defeated: false,
      bob: Math.random() * Math.PI * 2,
      ...overrides,
    };
  }

  function createBossAlien(overrides = {}) {
    return {
      ...BOSS_ALIEN,
      id: overrides.id || `alien-boss-${Date.now()}`,
      defeated: false,
      bob: Math.random() * Math.PI * 2,
      ...overrides,
    };
  }

  return {
    LEVEL_ONE_ALIEN,
    LEVEL_TWO_ALIEN,
    BOSS_ALIEN,
    createLevelOneAlien,
    createLevelTwoAlien,
    createBossAlien,
  };
})();
