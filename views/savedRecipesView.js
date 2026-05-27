import {
  deleteRecipe,
  getIngredients,
  getRecipeById,
  getRecipes
} from "../core/store.js";
import {
  calculatePerPortion,
  calculateRecipeNutrition,
  formatMacro
} from "../core/nutrition.js";
import { showModal } from "../core/modal.js";
import { loadRecipeForEditing } from "./recipeView.js";

let listenersBound = false;
let searchQuery = "";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredRecipes() {
  const query = searchQuery.trim().toLowerCase();
  const recipes = [...getRecipes()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  if (!query) return recipes;

  return recipes.filter((recipe) => recipe.name?.toLowerCase().includes(query));
}

function getRecipeLine(recipe) {
  const ingredients = getIngredients();
  return (recipe.items || []).map((item) => {
    const ingredient = ingredients.find((candidate) => candidate.id === item.ingredientId);
    const name = ingredient?.name || "Missing ingredient";
    return `${name} ${item.grams}g`;
  }).join(", ");
}

function openDeleteRecipeModal(id) {
  const recipe = getRecipeById(id);
  if (!recipe) return;

  showModal({
    title: "Delete Recipe",
    content: `
      <p class="modal-copy">
        Delete <strong>${escapeHtml(recipe.name)}</strong>? This removes it from saved recipes.
      </p>
    `,
    actions: [
      {
        label: "Delete",
        className: "danger",
        onClick: async () => {
          await deleteRecipe(id);
          window.render();
        }
      },
      {
        label: "Keep",
        className: "secondary"
      }
    ]
  });
}

function renderRecipeCard(recipe) {
  const totals = calculateRecipeNutrition(recipe, getIngredients());
  const perPortion = calculatePerPortion(totals, recipe.portions);

  return `
    <article class="saved-recipe-card">
      <div class="ingredient-card-header">
        <div>
          <h3>${escapeHtml(recipe.name || "Untitled recipe")}</h3>
          <p class="muted">${escapeHtml(recipe.portions || 1)} portions</p>
        </div>
        <div class="card-actions">
          <button type="button" class="secondary small-button" data-edit-recipe="${recipe.id}">Edit</button>
          <button type="button" class="secondary small-button danger-text" data-delete-recipe="${recipe.id}">Delete</button>
        </div>
      </div>

      <div class="macro-row">
        <div>
          <span class="muted">Per portion</span>
          <strong>${formatMacro(perPortion.calories)}</strong>
          <small>calories</small>
        </div>
        <div>
          <span class="muted">Per portion</span>
          <strong>${formatMacro(perPortion.protein, 1)}g</strong>
          <small>protein</small>
        </div>
      </div>

      <p class="ingredient-notes">${escapeHtml(getRecipeLine(recipe) || "No ingredients")}</p>
    </article>
  `;
}

function renderSavedRecipeList() {
  const recipes = getFilteredRecipes();

  if (!recipes.length) {
    return `
      <div class="empty-state">
        <h3>${searchQuery ? "No matching recipes" : "No saved recipes yet"}</h3>
        <p class="muted">${searchQuery ? "Try another recipe name." : "Save a meal from the Recipe Builder to reuse it here."}</p>
      </div>
    `;
  }

  return `
    <div class="list">
      ${recipes.map(renderRecipeCard).join("")}
    </div>
  `;
}

function refreshSavedRecipes() {
  const results = document.getElementById("saved-recipe-results");
  const count = document.getElementById("saved-recipe-count");

  if (results) results.innerHTML = renderSavedRecipeList();
  if (count) count.textContent = `${getFilteredRecipes().length} saved`;
}

function bindSavedRecipeListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("input", (event) => {
    if (event.target.id !== "saved-recipe-search") return;
    searchQuery = event.target.value;
    refreshSavedRecipes();
  });

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-recipe]");
    const deleteButton = event.target.closest("[data-delete-recipe]");

    if (editButton) {
      loadRecipeForEditing(editButton.dataset.editRecipe);
      window.switchView("recipe");
      return;
    }

    if (deleteButton) {
      openDeleteRecipeModal(deleteButton.dataset.deleteRecipe);
    }
  });
}

export function renderSavedRecipesView() {
  bindSavedRecipeListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Saved Recipes</h2>
        <p class="muted">Reuse common meals and adjust them later.</p>
      </div>
      <button type="button" onclick="switchView('recipe')">Builder</button>
    </section>

    <section class="card ingredient-toolbar">
      <label class="search-field">
        <span>Search recipes</span>
        <input id="saved-recipe-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search saved meals" autocomplete="off" />
      </label>
      <span class="muted" id="saved-recipe-count">${getFilteredRecipes().length} saved</span>
    </section>

    <div id="saved-recipe-results">
      ${renderSavedRecipeList()}
    </div>
  `;
}
