import { login, logout, observeAuth } from "./core/auth.js";
import { loadData, clearData } from "./core/store.js";

import { renderIngredientsView } from "./views/ingredientsView.js";
import { renderRecipeView } from "./views/recipeView.js";
import { renderSavedRecipesView } from "./views/savedRecipesView.js";
import { renderQuickFoodsView } from "./views/quickFoodsView.js";
import { renderCalculatorView } from "./views/calculatorView.js";
import { renderSettingsView } from "./views/settingsView.js";

let currentUser = null;
let currentView = "recipe";

window.login = login;
window.logout = logout;

window.switchView = function (view) {
  currentView = view;
  render();
};

function renderNav() {
  if (!currentUser) return "";

  return `
    <nav class="nav">
      <button onclick="switchView('ingredients')">Ingredients</button>
      <button onclick="switchView('recipe')">Recipe</button>
      <button onclick="switchView('saved')">Saved</button>
      <button onclick="switchView('quick')">Quick</button>
      <button onclick="switchView('calculator')">Calc</button>
      <button onclick="switchView('settings')">Settings</button>
    </nav>
  `;
}

function renderLogin() {
  return `
    <main class="login-screen">
      <div class="login-card">
        <div class="brand-pill">Foodie</div>
        <h1>Foodie</h1>
        <p class="muted">Shared calorie and recipe tracker for quick meal maths.</p>
        <button onclick="login()">Sign in with Google</button>
      </div>
    </main>
  `;
}

window.render = function render() {
  const root = document.getElementById("app");

  if (!currentUser) {
    root.innerHTML = renderLogin();
    return;
  }

  let viewHTML = "";

  if (currentView === "ingredients") viewHTML = renderIngredientsView();
  if (currentView === "recipe") viewHTML = renderRecipeView();
  if (currentView === "saved") viewHTML = renderSavedRecipesView();
  if (currentView === "quick") viewHTML = renderQuickFoodsView();
  if (currentView === "calculator") viewHTML = renderCalculatorView();
  if (currentView === "settings") viewHTML = renderSettingsView(currentUser);

  root.innerHTML = `
    ${renderNav()}
    <main class="view">
      ${viewHTML}
    </main>
  `;
};

observeAuth(async (user) => {
  currentUser = user;

  if (user) {
    await loadData();
  } else {
    clearData();
  }

  render();
});