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
    PLASMA_RIFFLE: "plasma-riffle",
    PLASMA_CARTRIDGE: "plasma-cartridge",
    MED_KIT: "med-kit",
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
    [ITEM_IDS.PLASMA_RIFFLE]: {
      id: ITEM_IDS.PLASMA_RIFFLE,
      name: "Plasma Riffle",
      description:
        "Powerful, but useless without an ammunition cartridge.",
    },
    [ITEM_IDS.PLASMA_CARTRIDGE]: {
      id: ITEM_IDS.PLASMA_CARTRIDGE,
      name: "Plasma Cartridge",
      description: "Ammunition for the Plasma Riffle.",
    },
    [ITEM_IDS.MED_KIT]: {
      id: ITEM_IDS.MED_KIT,
      name: "Med Kit",
      description: "Restores 10 HP. Click to use, or spend your combat turn.",
      usable: true,
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
  const LOCKER_KEY_FIND_CHANCE = 1 / 4;
  const MED_KIT_FIND_CHANCE = 1 / 2;
  const MED_KIT_HEAL = 10;

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

  function rollLockerKeyFind() {
    return Math.random() < LOCKER_KEY_FIND_CHANCE;
  }

  function rollMedKitFind() {
    return Math.random() < MED_KIT_FIND_CHANCE;
  }

  function canUsePlasmaRiffle() {
    return hasItem(ITEM_IDS.PLASMA_RIFFLE) && hasItem(ITEM_IDS.PLASMA_CARTRIDGE);
  }

  return {
    KEY_IDS,
    ITEM_IDS,
    ITEM_DEFS,
    KEY_CARD_FIND_CHANCE,
    LOCKER_KEY_FIND_CHANCE,
    MED_KIT_FIND_CHANCE,
    MED_KIT_HEAL,
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
    rollLockerKeyFind,
    rollMedKitFind,
    canUsePlasmaRiffle,
    onChange,
  };
})();
