/**
 * Persistent player combat state across encounters.
 */
window.SpaceQuestPlayerState = (() => {
  const MAX_HP = 50;
  let hp = MAX_HP;

  function getHp() {
    return hp;
  }

  function getMaxHp() {
    return MAX_HP;
  }

  function setHp(next) {
    hp = Math.max(0, Math.min(MAX_HP, Math.round(next)));
    return hp;
  }

  function applyDamage(amount) {
    return setHp(hp - Math.max(0, amount));
  }

  function healFull() {
    hp = MAX_HP;
    return hp;
  }

  function reset() {
    hp = MAX_HP;
  }

  return { getHp, getMaxHp, setHp, applyDamage, healFull, reset };
})();
