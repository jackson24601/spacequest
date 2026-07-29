/**
 * Player inventory. Items (key cards, etc.) unlock doors and show in the Inventory panel.
 */
window.SpaceQuestInventory = (() => {
  const KEY_IDS = {
    ENGINE_ROOM: "engine-room-key",
    INFIRMARY: "infirmary-key",
    MISSION_CONTROL: "mission-control-key",
  };

  const ITEM_DEFS = {
    [KEY_IDS.ENGINE_ROOM]: {
      id: KEY_IDS.ENGINE_ROOM,
      name: "Engine Room Key Card",
      description: "Opens the locked Engine Room door.",
    },
    [KEY_IDS.INFIRMARY]: {
      id: KEY_IDS.INFIRMARY,
      name: "Infirmary Key Card",
      description: "Opens the locked Infirmary door.",
    },
    [KEY_IDS.MISSION_CONTROL]: {
      id: KEY_IDS.MISSION_CONTROL,
      name: "Mission Control Key Card",
      description: "Opens the locked Mission Control door.",
    },
  };

  const KEY_CARD_FIND_CHANCE = 1 / 5;

  const items = new Set();
  const listeners = new Set();

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(listItems());
      } catch (err) {
        // Ignore listener errors so inventory stays usable
      }
    });
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function hasKey(keyId) {
    return Boolean(keyId) && items.has(keyId);
  }

  function addKey(keyId) {
    if (!keyId) return false;
    const sizeBefore = items.size;
    items.add(keyId);
    if (items.size !== sizeBefore) notify();
    return true;
  }

  function addItem(itemId) {
    return addKey(itemId);
  }

  function listKeys() {
    return [...items];
  }

  function listItems() {
    return listKeys().map((id) => {
      const def = ITEM_DEFS[id];
      return (
        def || {
          id,
          name: id,
          description: "",
        }
      );
    });
  }

  function count() {
    return items.size;
  }

  function isEmpty() {
    return items.size === 0;
  }

  function reset() {
    items.clear();
    notify();
  }

  function rollKeyCardFind() {
    return Math.random() < KEY_CARD_FIND_CHANCE;
  }

  return {
    KEY_IDS,
    ITEM_DEFS,
    KEY_CARD_FIND_CHANCE,
    hasKey,
    addKey,
    addItem,
    listKeys,
    listItems,
    count,
    isEmpty,
    reset,
    rollKeyCardFind,
    onChange,
  };
})();
