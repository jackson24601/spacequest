(() => {
  const beginBtn = document.getElementById("begin-quest");
  if (!beginBtn) return;

  beginBtn.addEventListener("click", () => {
    beginBtn.classList.add("is-launching");

    // Placeholder until the adventure flow exists.
    window.setTimeout(() => {
      beginBtn.classList.remove("is-launching");
      beginBtn.blur();
    }, 750);
  });
})();
