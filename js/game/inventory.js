/**
 * Player inventory. Keys unlock special room doors later.
 */
window.SpaceQuestInventory = (() => {
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

  return { hasKey, addKey, listKeys, reset };
})();
