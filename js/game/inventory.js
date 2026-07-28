/**
 * Player inventory. Key cards unlock special room doors.
 */
window.SpaceQuestInventory = (() => {
  const KEY_IDS = {
    ENGINE_ROOM: "engine-room-key",
    INFIRMARY: "infirmary-key",
    MISSION_CONTROL: "mission-control-key",
  };

  const KEY_CARD_FIND_CHANCE = 1 / 5;

  const keys = new Set();

  function hasKey(keyId) {
    return Boolean(keyId) && keys.has(keyId);
  }

  function addKey(keyId) {
    if (keyId) keys.add(keyId);
  }

  function listKeys() {
    return [...keys];
  }

  function reset() {
    keys.clear();
  }

  function rollKeyCardFind() {
    return Math.random() < KEY_CARD_FIND_CHANCE;
  }

  return {
    KEY_IDS,
    KEY_CARD_FIND_CHANCE,
    hasKey,
    addKey,
    listKeys,
    reset,
    rollKeyCardFind,
  };
})();
