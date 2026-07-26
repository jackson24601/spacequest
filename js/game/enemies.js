/**
 * Enemy archetypes for hallway encounters.
 */
window.SpaceQuestEnemies = (() => {
  const LEVEL_ONE_ALIEN = {
    type: "alien-l1",
    name: "Level 1 Alien",
    sprite: "assets/sprites/alien-l1.png",
    hp: 5,
    maxHp: 5,
    attackDamage: 1,
    hitChance: 0.25,
    speed: 95,
    w: 56,
    h: 84,
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

  return {
    LEVEL_ONE_ALIEN,
    createLevelOneAlien,
  };
})();
