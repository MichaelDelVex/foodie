import {
  getIngredients,
  getQuickFoods,
  getRecipes
} from "../core/store.js";

const HOUSEHOLD_LABEL = "Michael & Jade";
const HOUSEHOLD_ID = "michael-and-jade";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDisplayName(user) {
  return user.displayName || user.email || "Signed in";
}

export function renderSettingsView(user) {
  return `
    <section class="view-header">
      <div>
        <h2>Settings</h2>
        <p class="muted">Account, household, and app status.</p>
      </div>
    </section>

    <section class="card settings-profile">
      <div class="settings-avatar">
        ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="" />` : `<span>${escapeHtml(getDisplayName(user).slice(0, 1).toUpperCase())}</span>`}
      </div>
      <div>
        <h3>${escapeHtml(getDisplayName(user))}</h3>
        <p class="muted">${escapeHtml(user.email || "")}</p>
      </div>
      <button type="button" class="secondary" onclick="logout()">Logout</button>
    </section>

    <section class="card">
      <h3 class="compact-heading">Household</h3>
      <div class="settings-row">
        <span>Name</span>
        <strong>${HOUSEHOLD_LABEL}</strong>
      </div>
      <div class="settings-row">
        <span>Sync</span>
        <strong>Firestore</strong>
      </div>
      <div class="settings-row">
        <span>ID</span>
        <strong>${HOUSEHOLD_ID}</strong>
      </div>
    </section>

    <section class="card">
      <h3 class="compact-heading">Library</h3>
      <div class="settings-stats">
        <div class="metric">
          <span class="muted">Ingredients</span>
          <strong>${getIngredients().length}</strong>
        </div>
        <div class="metric">
          <span class="muted">Recipes</span>
          <strong>${getRecipes().length}</strong>
        </div>
        <div class="metric">
          <span class="muted">Quick foods</span>
          <strong>${getQuickFoods().length}</strong>
        </div>
      </div>
    </section>
  `;
}
