/**
 * Player inventory. Items (key cards, etc.) unlock doors and show in the Inventory panel.
 */
window.SpaceQuestInventory = (() => {
  const KEY_IDS = {
    ENGINE_ROOM: "engine-room-key",
    INFIRMARY: "infirmary-key",
    MISSION_CONTROL: "mission-control-key",
    LODGING_LOCKER: "lodging-locker-key",
  };

  const ITEM_IDS = {
    COFFEE: "coffee",
    BLASTER: "blaster",
    ...KEY_IDS,
  };

  const ITEM_DEFS = {
    [ITEM_IDS.COFFEE]: {
      id: ITEM_IDS.COFFEE,
      name: "Pot of Coffee",
      description: "Still hot. Can be thrown once in combat for heavy damage.",
    },
    [ITEM_IDS.BLASTER]: {
      id: ITEM_IDS.BLASTER,
      name: "Blaster",
      description: "A crewmate's sidearm. Still charged.",
    },
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
    [KEY_IDS.LODGING_LOCKER]: {
      id: KEY_IDS.LODGING_LOCKER,
      name: "Foot Locker Key",
      description: "Opens the foot locker in Lodging.",
    },
  };

  const KEY_CARD_FIND_CHANCE = 1 / 5;

  const items = new Set();
  const takenWorldPickups = new Set();
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

  function hasItem(itemId) {
    return Boolean(itemId) && items.has(itemId);
  }

  function hasKey(keyId) {
    return hasItem(keyId);
  }

  function addItem(itemId) {
    if (!itemId) return false;
    const sizeBefore = items.size;
    items.add(itemId);
    if (items.size !== sizeBefore) notify();
    return true;
  }

  function addKey(keyId) {
    return addItem(keyId);
  }

  function removeItem(itemId) {
    if (!itemId || !items.has(itemId)) return false;
    items.delete(itemId);
    notify();
    return true;
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

  function hasTakenWorldPickup(pickupId) {
    return Boolean(pickupId) && takenWorldPickups.has(pickupId);
  }

  function takeWorldPickup(pickupId) {
    if (!pickupId || takenWorldPickups.has(pickupId)) return false;
    takenWorldPickups.add(pickupId);
    return true;
  }

  function reset() {
    items.clear();
    takenWorldPickups.clear();
    notify();
  }

  function rollKeyCardFind() {
    return Math.random() < KEY_CARD_FIND_CHANCE;
  }

  return {
    KEY_IDS,
    ITEM_IDS,
    ITEM_DEFS,
    KEY_CARD_FIND_CHANCE,
    hasKey,
    hasItem,
    addKey,
    addItem,
    removeItem,
    listKeys,
    listItems,
    count,
    isEmpty,
    hasTakenWorldPickup,
    takeWorldPickup,
    reset,
    rollKeyCardFind,
    onChange,
  };
})();
