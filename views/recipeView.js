import {
  addRecipe,
  deleteRecipe,
  getIngredients,
  getRecipeById,
  getRecipes,
  updateRecipe
} from "../core/store.js";
import {
  calculatePerPortion,
  calculateRecipeNutrition,
  formatMacro
} from "../core/nutrition.js";
import { closeModal, showModal } from "../core/modal.js";

let draft = createEmptyDraft();
let listenersBound = false;
let recipeMessage = "";
let recipeMessageIsError = false;
let activePickerIndex = null;
let recipeMode = "list";
let recipeSearchQuery = "";
let expandedRecipeIds = new Set();

function createEmptyDraft() {
  return {
    id: null,
    name: "",
    portions: 1,
    items: []
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanDraft() {
  return {
    name: draft.name.trim(),
    portions: Math.max(Number(draft.portions) || 1, 1),
    items: draft.items
      .filter((item) => item.ingredientId && Number(item.grams) > 0)
      .map((item) => ({
        ingredientId: item.ingredientId,
        grams: Number(item.grams)
      }))
  };
}

function getDraftNutrition() {
  const ingredients = getIngredients();
  const totals = calculateRecipeNutrition(draft, ingredients);
  const perPortion = calculatePerPortion(totals, draft.portions);

  return { totals, perPortion };
}

function getIngredientName(item) {
  const ingredient = getIngredients().find((i) => i.id === item.ingredientId);
  return ingredient?.name || "";
}

function getIngredientCaloriesPer100g(ingredientId) {
  const ingredient = getIngredients().find((i) => i.id === ingredientId);
  return Number(ingredient?.caloriesPer100g) || 0;
}

function getCaloriesFromGrams(ingredientId, grams) {
  const caloriesPer100g = getIngredientCaloriesPer100g(ingredientId);
  return caloriesPer100g * (Number(grams) || 0) / 100;
}

function getGramsFromCalories(ingredientId, calories) {
  const caloriesPer100g = getIngredientCaloriesPer100g(ingredientId);
  if (caloriesPer100g <= 0) return "";
  return (Number(calories) || 0) * 100 / caloriesPer100g;
}

function formatInputNumber(value, decimals = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return Number(number.toFixed(decimals)).toString();
}

function getIngredientPickerResults(query = "") {
  const normalizedQuery = query.trim().toLowerCase();
  const ingredients = [...getIngredients()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  if (!normalizedQuery) return ingredients.slice(0, 24);

  return ingredients.filter((ingredient) =>
    [ingredient.name, ingredient.category, ingredient.notes]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );
}

function renderIngredientPickerResults(query = "") {
  const results = getIngredientPickerResults(query);

  if (!results.length) {
    return `
      <div class="empty-state compact-empty">
        <h3>No matching ingredients</h3>
        <p class="muted">Try another name or category.</p>
      </div>
    `;
  }

  return results.map((ingredient) => `
    <button type="button" class="picker-result" data-pick-ingredient="${ingredient.id}">
      <span>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <small>${escapeHtml(ingredient.category || "Other")}</small>
      </span>
      <span class="picker-macros">
        ${formatMacro(ingredient.caloriesPer100g)} cal
        <small>${formatMacro(ingredient.proteinPer100g, 1)}g protein</small>
      </span>
    </button>
  `).join("");
}

function renderItemSummary(item) {
  const ingredient = getIngredients().find((i) => i.id === item.ingredientId);
  const itemNutrition = calculateRecipeNutrition({ items: [item] }, getIngredients());

  return `
    <strong>${formatMacro(itemNutrition.calories)} cal</strong>
    <span>${formatMacro(itemNutrition.protein, 1)}g protein</span>
    ${ingredient ? "" : "<span class=\"danger-copy\">Choose an ingredient</span>"}
  `;
}

function renderRecipeItems() {
  if (!draft.items.length) {
    return `
      <div class="empty-state compact-empty">
        <h3>No ingredients added</h3>
        <p class="muted">Add raw ingredients and enter the grams used in the full recipe.</p>
      </div>
    `;
  }

  return draft.items.map((item, index) => {
    return `
      <article class="recipe-item" data-recipe-item="${index}">
        <label>
          <span>Ingredient</span>
          <button type="button" class="ingredient-picker-button" data-open-ingredient-picker="${index}">
            <strong>${escapeHtml(getIngredientName(item) || "Choose ingredient")}</strong>
            <small>${getIngredientName(item) ? "Tap to change" : "Search saved ingredients"}</small>
          </button>
        </label>

        <label>
          <span>Raw grams</span>
          <input data-recipe-field="grams" data-index="${index}" type="number" min="0" step="1" value="${escapeHtml(item.grams)}" placeholder="100" />
        </label>

        <label>
          <span>Calories</span>
          <input
            data-recipe-field="calories"
            data-index="${index}"
            type="number"
            min="0"
            step="1"
            value="${escapeHtml(formatInputNumber(getCaloriesFromGrams(item.ingredientId, item.grams), 0))}"
            placeholder="250"
            ${item.ingredientId ? "" : "disabled"}
          />
        </label>

        <div class="item-summary" data-item-summary="${index}">
          ${renderItemSummary(item)}
        </div>

        <button type="button" class="secondary small-button" data-remove-recipe-item="${index}">Remove</button>
      </article>
    `;
  }).join("");
}

function renderTotals() {
  const { totals, perPortion } = getDraftNutrition();

  return `
    <div class="metric-grid recipe-totals">
      <div class="metric">
        <span class="muted">Per portion</span>
        <strong>${formatMacro(perPortion.calories)}</strong>
        <small>calories</small>
      </div>
      <div class="metric">
        <span class="muted">Per portion</span>
        <strong>${formatMacro(perPortion.protein, 1)}g</strong>
        <small>protein</small>
      </div>
      <div class="metric">
        <span class="muted">Full recipe</span>
        <strong>${formatMacro(totals.calories)}</strong>
        <small>calories</small>
      </div>
      <div class="metric">
        <span class="muted">Full recipe</span>
        <strong>${formatMacro(totals.protein, 1)}g</strong>
        <small>protein</small>
      </div>
    </div>
  `;
}

function getFilteredRecipes() {
  const query = recipeSearchQuery.trim().toLowerCase();
  const recipes = [...getRecipes()].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
  );

  if (!query) return recipes;

  return recipes.filter((recipe) =>
    (recipe.name || "").toLowerCase().includes(query)
  );
}

function getRecipeIngredientLines(recipe) {
  return (recipe.items || []).map((item) => {
    const ingredient = getIngredients().find((candidate) => candidate.id === item.ingredientId);
    const name = ingredient?.name || "Missing ingredient";
    const calories = getCaloriesFromGrams(item.ingredientId, item.grams);

    return {
      name,
      grams: Number(item.grams) || 0,
      calories
    };
  });
}

function getRecipeSummary(recipe) {
  const lines = getRecipeIngredientLines(recipe);
  if (!lines.length) return "No ingredients";

  const summary = lines.slice(0, 3).map((line) => line.name).join(", ");
  return lines.length > 3 ? `${summary} +${lines.length - 3}` : summary;
}

function renderRecipeIngredientList(recipe) {
  const lines = getRecipeIngredientLines(recipe);

  if (!lines.length) {
    return `<p class="muted recipe-expanded-empty">No ingredients saved on this recipe.</p>`;
  }

  return `
    <ul class="recipe-ingredient-list">
      ${lines.map((line) => `
        <li>
          <span>${escapeHtml(line.name)}</span>
          <strong>${formatMacro(line.grams)}g · ${formatMacro(line.calories)} cal</strong>
        </li>
      `).join("")}
    </ul>
  `;
}

function renderRecipeCard(recipe) {
  const totals = calculateRecipeNutrition(recipe, getIngredients());
  const perPortion = calculatePerPortion(totals, recipe.portions);
  const expanded = expandedRecipeIds.has(recipe.id);

  return `
    <article class="saved-recipe-card recipe-library-card ${expanded ? "expanded" : ""}">
      <button type="button" class="recipe-card-toggle" data-toggle-recipe="${recipe.id}" aria-expanded="${expanded}">
        <span class="recipe-card-main">
          <strong>${escapeHtml(recipe.name || "Untitled recipe")}</strong>
          <small>${formatMacro(perPortion.calories)} cal / portion · ${escapeHtml(recipe.portions || 1)} portions</small>
          <small>${escapeHtml(getRecipeSummary(recipe))}</small>
        </span>
        <span class="recipe-card-chevron">${expanded ? "Hide" : "Show"}</span>
      </button>

      ${expanded ? renderRecipeIngredientList(recipe) : ""}

      <button type="button" class="icon-action danger-text" aria-label="Delete ${escapeHtml(recipe.name || "recipe")}" data-delete-recipe="${recipe.id}">&times;</button>
      <button type="button" class="icon-action edit-action" aria-label="Edit ${escapeHtml(recipe.name || "recipe")}" data-edit-recipe="${recipe.id}">&#9998;</button>
    </article>
  `;
}

function renderRecipeList() {
  const recipes = getFilteredRecipes();

  if (!recipes.length) {
    return `
      <div class="empty-state">
        <h3>${recipeSearchQuery ? "No matching recipes" : "No recipes yet"}</h3>
        <p class="muted">${recipeSearchQuery ? "Try another recipe name." : "Add a recipe from raw ingredients and save it here."}</p>
      </div>
    `;
  }

  return `
    <div class="list">
      ${recipes.map(renderRecipeCard).join("")}
    </div>
  `;
}

function refreshRecipeList() {
  const results = document.getElementById("recipe-library-results");
  const count = document.getElementById("recipe-library-count");

  if (results) results.innerHTML = renderRecipeList();
  if (count) count.textContent = `${getFilteredRecipes().length} saved`;
}

function startNewRecipe() {
  draft = createEmptyDraft();
  recipeMessage = "";
  recipeMessageIsError = false;
  recipeMode = "builder";
  window.render();
}

function openDeleteRecipeModal(id) {
  const recipe = getRecipeById(id);
  if (!recipe) return;

  showModal({
    title: "Delete Recipe",
    content: `
      <p class="modal-copy">
        Delete <strong>${escapeHtml(recipe.name || "this recipe")}</strong>? This removes it from saved recipes.
      </p>
    `,
    actions: [
      {
        label: "Delete",
        className: "danger",
        onClick: async () => {
          try {
            await deleteRecipe(id);
            expandedRecipeIds.delete(id);
            window.render();
          } catch (error) {
            console.error("Could not delete recipe", error);
            return false;
          }
        }
      },
      {
        label: "Keep",
        className: "secondary"
      }
    ]
  });
}

function refreshRecipeBuilder() {
  const items = document.getElementById("recipe-items");
  const totals = document.getElementById("recipe-totals");
  const saveButton = document.getElementById("save-recipe-button");

  if (items) items.innerHTML = renderRecipeItems();
  if (totals) totals.innerHTML = renderTotals();
  if (saveButton) saveButton.textContent = draft.id ? "Update Recipe" : "Save Recipe";
}

function refreshRecipeItemIngredient(index) {
  const item = document.querySelector(`[data-recipe-item="${index}"]`);
  if (!item || !draft.items[index]) return;

  const button = item.querySelector("[data-open-ingredient-picker]");
  const ingredientName = getIngredientName(draft.items[index]);

  if (button) {
    button.innerHTML = `
      <strong>${escapeHtml(ingredientName || "Choose ingredient")}</strong>
      <small>${ingredientName ? "Tap to change" : "Search saved ingredients"}</small>
    `;
  }
}

function refreshRecipeTotals() {
  const totals = document.getElementById("recipe-totals");
  if (totals) totals.innerHTML = renderTotals();
}

function refreshRecipeItemSummary(index) {
  const summary = document.querySelector(`[data-item-summary="${index}"]`);
  if (summary && draft.items[index]) summary.innerHTML = renderItemSummary(draft.items[index]);
}

function refreshRecipePairedInput(index, field) {
  const item = draft.items[index];
  const row = document.querySelector(`[data-recipe-item="${index}"]`);
  if (!item || !row) return;

  const gramsInput = row.querySelector('[data-recipe-field="grams"]');
  const caloriesInput = row.querySelector('[data-recipe-field="calories"]');

  if (caloriesInput) {
    caloriesInput.disabled = !item.ingredientId;
  }

  if (field === "grams" && caloriesInput) {
    caloriesInput.value = formatInputNumber(getCaloriesFromGrams(item.ingredientId, item.grams), 0);
  }

  if (field === "calories" && gramsInput) {
    gramsInput.value = item.grams;
  }
}

function setRecipeMessage(message, isError = false) {
  recipeMessage = message || "";
  recipeMessageIsError = isError;

  const element = document.getElementById("recipe-message");
  if (!element) return;
  element.textContent = recipeMessage;
  element.className = isError ? "form-error" : "success-copy";
}

function handleRecipeFieldChange(target) {
  if (target.id === "recipe-name") {
    draft.name = target.value;
    setRecipeMessage("");
    return true;
  }

  if (target.id === "recipe-portions") {
    draft.portions = target.value;
    setRecipeMessage("");
    refreshRecipeTotals();
    return true;
  }

  const recipeField = target.dataset.recipeField;
  if (!recipeField) return false;

  const index = Number(target.dataset.index);
  if (!draft.items[index]) return true;

  if (recipeField === "calories") {
    draft.items[index].grams = formatInputNumber(
      getGramsFromCalories(draft.items[index].ingredientId, target.value),
      1
    );
  } else {
    draft.items[index][recipeField] = target.value;
  }

  setRecipeMessage("");
  refreshRecipePairedInput(index, recipeField);
  refreshRecipeItemSummary(index);
  refreshRecipeTotals();
  return true;
}

function openIngredientPicker(index) {
  activePickerIndex = index;

  showModal({
    title: "Choose Ingredient",
    content: `
      <label class="search-field">
        <span>Search ingredients</span>
        <input id="ingredient-picker-search" type="search" placeholder="Type a name or category" autocomplete="off" />
      </label>
      <div class="picker-results" id="ingredient-picker-results">
        ${renderIngredientPickerResults()}
      </div>
    `,
    actions: [
      {
        label: "Cancel",
        className: "secondary"
      }
    ],
    onClose: () => {
      activePickerIndex = null;
    }
  });
}

function selectIngredient(ingredientId) {
  if (activePickerIndex === null || !draft.items[activePickerIndex]) return;

  draft.items[activePickerIndex].ingredientId = ingredientId;
  setRecipeMessage("");
  refreshRecipeItemIngredient(activePickerIndex);
  refreshRecipePairedInput(activePickerIndex, "grams");
  refreshRecipeItemSummary(activePickerIndex);
  refreshRecipeTotals();
  closeModal();
}

async function saveDraft() {
  setRecipeMessage("");
  const recipe = cleanDraft();
  const totals = calculateRecipeNutrition(recipe, getIngredients());
  const perPortion = calculatePerPortion(totals, recipe.portions);

  if (!recipe.name) {
    setRecipeMessage("Name the recipe before saving.", true);
    return;
  }

  if (!recipe.items.length) {
    setRecipeMessage("Add at least one ingredient with grams.", true);
    return;
  }

  const savedRecipe = {
    ...recipe,
    caloriesTotal: Math.round(totals.calories),
    proteinTotal: Number(totals.protein.toFixed(1)),
    caloriesPerPortion: Math.round(perPortion.calories),
    proteinPerPortion: Number(perPortion.protein.toFixed(1))
  };

  try {
    if (draft.id) {
      await updateRecipe(draft.id, savedRecipe);
      setRecipeMessage("Recipe updated.");
    } else {
      await addRecipe(savedRecipe);
      setRecipeMessage("Recipe saved.");
    }

    draft = createEmptyDraft();
    recipeMode = "list";
    window.render();
  } catch (error) {
    console.error("Could not save recipe", error);
    setRecipeMessage("Could not save recipe. Try again.", true);
  }
}

function bindRecipeListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("input", (event) => {
    if (event.target.id === "recipe-library-search") {
      recipeSearchQuery = event.target.value;
      refreshRecipeList();
      return;
    }

    handleRecipeFieldChange(event.target);
  });

  document.addEventListener("change", (event) => {
    handleRecipeFieldChange(event.target);
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-start-recipe]")) {
      startNewRecipe();
      return;
    }

    if (event.target.closest("[data-back-to-recipes]")) {
      recipeMode = "list";
      recipeMessage = "";
      recipeMessageIsError = false;
      window.render();
      return;
    }

    const editButton = event.target.closest("[data-edit-recipe]");
    if (editButton) {
      loadRecipeForEditing(editButton.dataset.editRecipe);
      window.render();
      return;
    }

    const deleteButton = event.target.closest("[data-delete-recipe]");
    if (deleteButton) {
      openDeleteRecipeModal(deleteButton.dataset.deleteRecipe);
      return;
    }

    const toggleButton = event.target.closest("[data-toggle-recipe]");
    if (toggleButton) {
      const id = toggleButton.dataset.toggleRecipe;
      if (expandedRecipeIds.has(id)) {
        expandedRecipeIds.delete(id);
      } else {
        expandedRecipeIds.add(id);
      }
      refreshRecipeList();
      return;
    }

    if (event.target.closest("[data-add-recipe-item]")) {
      draft.items.push({ ingredientId: "", grams: "" });
      refreshRecipeBuilder();
      return;
    }

    const pickerButton = event.target.closest("[data-open-ingredient-picker]");
    if (pickerButton) {
      openIngredientPicker(Number(pickerButton.dataset.openIngredientPicker));
      return;
    }

    const ingredientButton = event.target.closest("[data-pick-ingredient]");
    if (ingredientButton) {
      selectIngredient(ingredientButton.dataset.pickIngredient);
      return;
    }

    const removeButton = event.target.closest("[data-remove-recipe-item]");
    if (removeButton) {
      draft.items.splice(Number(removeButton.dataset.removeRecipeItem), 1);
      refreshRecipeBuilder();
      return;
    }

    if (event.target.closest("[data-save-recipe]")) {
      saveDraft();
      return;
    }

    if (event.target.closest("[data-clear-recipe]")) {
      startNewRecipe();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "ingredient-picker-search") return;

    const results = document.getElementById("ingredient-picker-results");
    if (results) results.innerHTML = renderIngredientPickerResults(event.target.value);
  });
}

export function loadRecipeForEditing(id) {
  const recipe = getRecipeById(id);
  if (!recipe) return;

  draft = {
    id: recipe.id,
    name: recipe.name || "",
    portions: recipe.portions || 1,
    items: (recipe.items || []).map((item) => ({
      ingredientId: item.ingredientId,
      grams: item.grams
    }))
  };
  setRecipeMessage("");
  recipeMode = "builder";
}

export function renderRecipeView() {
  bindRecipeListeners();

  if (recipeMode === "list") {
    return `
      <section class="view-header">
        <div>
          <h2>Recipes</h2>
          <p class="muted">Saved meals with portion calories and raw ingredient breakdowns.</p>
        </div>
        <button type="button" data-start-recipe>Add</button>
      </section>

      <section class="card ingredient-toolbar">
        <label class="search-field">
          <span>Search recipes</span>
          <input id="recipe-library-search" type="search" value="${escapeHtml(recipeSearchQuery)}" placeholder="Search saved meals" autocomplete="off" />
        </label>
        <span class="muted" id="recipe-library-count">${getFilteredRecipes().length} saved</span>
      </section>

      <div id="recipe-library-results">
        ${renderRecipeList()}
      </div>
    `;
  }

  const hasIngredients = getIngredients().length > 0;

  return `
    <section class="view-header">
      <div>
        <h2>${draft.id ? "Edit Recipe" : "Add Recipe"}</h2>
        <p class="muted">Build meals from raw ingredient weights and calculate portions.</p>
      </div>
      <button type="button" class="secondary" data-back-to-recipes>Back</button>
    </section>

    ${hasIngredients ? "" : `
      <div class="empty-state">
        <h3>Add ingredients first</h3>
        <p class="muted">Recipes use the raw ingredient list for calories and protein per 100g.</p>
      </div>
    `}

    <section class="card recipe-shell">
      <div class="form-grid">
        <label>
          <span>Recipe name</span>
          <input id="recipe-name" type="text" value="${escapeHtml(draft.name)}" placeholder="Chicken rice bowls" autocomplete="off" />
        </label>

        <label>
          <span>Portions</span>
          <input id="recipe-portions" type="number" min="1" step="1" value="${escapeHtml(draft.portions)}" />
        </label>
      </div>

      <div class="section-heading">
        <h3>Ingredients</h3>
        <button type="button" class="secondary small-button" data-add-recipe-item ${hasIngredients ? "" : "disabled"}>Add Ingredient</button>
      </div>

      <div id="recipe-items">
        ${renderRecipeItems()}
      </div>
    </section>

    <section class="card">
      <div id="recipe-totals">
        ${renderTotals()}
      </div>
      <p id="recipe-message" class="${recipeMessageIsError ? "form-error" : "success-copy"}" aria-live="polite">${escapeHtml(recipeMessage)}</p>
      <button id="save-recipe-button" type="button" data-save-recipe ${hasIngredients ? "" : "disabled"}>
        ${draft.id ? "Update Recipe" : "Save Recipe"}
      </button>
    </section>
  `;
}
