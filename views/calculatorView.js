import {
  getIngredients,
  getQuickFoods,
  getRecipes
} from "../core/store.js";
import {
  calculatePerPortion,
  calculateRecipeNutrition,
  formatMacro
} from "../core/nutrition.js";
import { closeModal, showModal } from "../core/modal.js";

let scratchItems = [];
let listenersBound = false;
let kjValue = "";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQuickFoodTitle(food) {
  return food.title || food.name || "Untitled quick food";
}

function getQuickFoodCalories(food) {
  return Number(food.calories ?? food.caloriesPerServe) || 0;
}

function getQuickFoodServes(food) {
  return food.serves || food.servingDescription || "1 serve";
}

function getRecipeCaloriesPerPortion(recipe) {
  if (Number.isFinite(Number(recipe.caloriesPerPortion))) {
    return Number(recipe.caloriesPerPortion);
  }

  const totals = calculateRecipeNutrition(recipe, getIngredients());
  return calculatePerPortion(totals, recipe.portions).calories;
}

function getScratchItemCalories(item) {
  if (item.type === "ingredient") {
    const ingredient = getIngredients().find((candidate) => candidate.id === item.id);
    if (!ingredient) return 0;
    return (Number(ingredient.caloriesPer100g) || 0) * (Number(item.amount) || 0) / 100;
  }

  if (item.type === "recipe") {
    const recipe = getRecipes().find((candidate) => candidate.id === item.id);
    if (!recipe) return 0;
    return getRecipeCaloriesPerPortion(recipe) * (Number(item.amount) || 0);
  }

  if (item.type === "quickFood") {
    const food = getQuickFoods().find((candidate) => candidate.id === item.id);
    if (!food) return 0;
    return getQuickFoodCalories(food) * (Number(item.amount) || 0);
  }

  return Number(item.calories) || 0;
}

function getScratchTotal() {
  return scratchItems.reduce((total, item) => total + getScratchItemCalories(item), 0);
}

function getScratchItemTitle(item) {
  if (item.type === "ingredient") {
    return getIngredients().find((ingredient) => ingredient.id === item.id)?.name || "Missing ingredient";
  }

  if (item.type === "recipe") {
    return getRecipes().find((recipe) => recipe.id === item.id)?.name || "Missing recipe";
  }

  if (item.type === "quickFood") {
    const food = getQuickFoods().find((candidate) => candidate.id === item.id);
    return food ? getQuickFoodTitle(food) : "Missing quick food";
  }

  return item.title || "Manual item";
}

function getScratchItemDetail(item) {
  if (item.type === "ingredient") {
    return Number(item.amount) > 0 ? `${formatMacro(item.amount)}g raw` : "Add grams";
  }

  if (item.type === "recipe") {
    const amount = Number(item.amount) || 0;
    return amount > 0 ? `${formatMacro(amount, 1)} portion${amount === 1 ? "" : "s"}` : "Add portions";
  }

  if (item.type === "quickFood") {
    const food = getQuickFoods().find((candidate) => candidate.id === item.id);
    const label = food ? getQuickFoodServes(food) : "serve";
    const amount = Number(item.amount) || 0;
    return amount > 0 ? `${formatMacro(amount, 1)} x ${label}` : `Add serves · ${label}`;
  }

  return item.notes || "Manual calories";
}

function renderScratchItems() {
  if (!scratchItems.length) {
    return `
      <div class="empty-state compact-empty">
        <h3>No items yet</h3>
        <p class="muted">Add ingredients, recipes, quick foods, or manual calories as you go.</p>
      </div>
    `;
  }

  return scratchItems.map((item, index) => `
    <article class="scratch-item" data-scratch-item="${index}">
      <div class="scratch-main">
        <strong>${escapeHtml(getScratchItemTitle(item))}</strong>
        <span data-scratch-detail="${index}">${escapeHtml(getScratchItemDetail(item))}</span>
      </div>

      ${item.type === "manual" ? `
        <label class="scratch-amount">
          <span>Calories</span>
          <input data-scratch-field="calories" data-index="${index}" type="number" min="0" step="1" value="${escapeHtml(item.calories)}" />
        </label>
      ` : `
        <label class="scratch-amount">
          <span>${item.type === "ingredient" ? "Grams" : "Serves"}</span>
          <input data-scratch-field="amount" data-index="${index}" type="number" min="0" step="${item.type === "ingredient" ? "1" : "0.1"}" value="${escapeHtml(item.amount)}" />
        </label>
      `}

      <div class="scratch-calories" data-scratch-calories="${index}">
        ${formatMacro(getScratchItemCalories(item))} cal
      </div>

      <button type="button" class="icon-action danger-text" aria-label="Remove ${escapeHtml(getScratchItemTitle(item))}" data-remove-scratch-item="${index}">x</button>
    </article>
  `).join("");
}

function renderScratchTotal() {
  return `
    <div class="metric scratch-total">
      <span class="muted">Scratchpad total</span>
      <strong>${formatMacro(getScratchTotal())}</strong>
      <small>calories</small>
    </div>
  `;
}

function refreshScratchItems() {
  const items = document.getElementById("scratch-items");
  const total = document.getElementById("scratch-total");

  if (items) items.innerHTML = renderScratchItems();
  if (total) total.innerHTML = renderScratchTotal();
}

function refreshScratchCalories(index) {
  const itemCalories = document.querySelector(`[data-scratch-calories="${index}"]`);
  const detail = document.querySelector(`[data-scratch-detail="${index}"]`);
  const total = document.getElementById("scratch-total");

  if (itemCalories && scratchItems[index]) {
    itemCalories.textContent = `${formatMacro(getScratchItemCalories(scratchItems[index]))} cal`;
  }

  if (detail && scratchItems[index]) {
    detail.textContent = getScratchItemDetail(scratchItems[index]);
  }

  if (total) total.innerHTML = renderScratchTotal();
}

function filterList(items, query, getText) {
  const normalizedQuery = query.trim().toLowerCase();
  const sorted = [...items].sort((a, b) =>
    getText(a).localeCompare(getText(b), undefined, { sensitivity: "base" })
  );

  if (!normalizedQuery) return sorted.slice(0, 24);

  return sorted.filter((item) =>
    getText(item).toLowerCase().includes(normalizedQuery)
  );
}

function renderPickerResults(type, query = "") {
  if (type === "ingredient") {
    const results = filterList(getIngredients(), query, (ingredient) =>
      `${ingredient.name} ${ingredient.category || ""} ${ingredient.notes || ""}`
    );

    return renderPickerButtons(results, "ingredient", (ingredient) => ({
      id: ingredient.id,
      title: ingredient.name,
      meta: `${formatMacro(ingredient.caloriesPer100g)} cal / 100g`
    }));
  }

  if (type === "recipe") {
    const results = filterList(getRecipes(), query, (recipe) => recipe.name || "");

    return renderPickerButtons(results, "recipe", (recipe) => ({
      id: recipe.id,
      title: recipe.name || "Untitled recipe",
      meta: `${formatMacro(getRecipeCaloriesPerPortion(recipe))} cal / portion`
    }));
  }

  const results = filterList(getQuickFoods(), query, (food) =>
    `${getQuickFoodTitle(food)} ${food.notes || ""} ${getQuickFoodServes(food)}`
  );

  return renderPickerButtons(results, "quickFood", (food) => ({
    id: food.id,
    title: getQuickFoodTitle(food),
    meta: `${formatMacro(getQuickFoodCalories(food))} cal · ${getQuickFoodServes(food)}`
  }));
}

function renderPickerButtons(results, type, getResult) {
  if (!results.length) {
    return `
      <div class="empty-state compact-empty">
        <h3>No matches</h3>
        <p class="muted">Try another search term.</p>
      </div>
    `;
  }

  return results.map((item) => {
    const result = getResult(item);
    return `
      <button type="button" class="picker-result" data-add-picked-item="${type}" data-picked-id="${result.id}">
        <span>
          <strong>${escapeHtml(result.title)}</strong>
          <small>${escapeHtml(result.meta)}</small>
        </span>
      </button>
    `;
  }).join("");
}

function openPicker(type) {
  const titles = {
    ingredient: "Add Ingredient",
    recipe: "Add Recipe",
    quickFood: "Add Quick Food"
  };

  showModal({
    title: titles[type],
    content: `
      <label class="search-field">
        <span>Search</span>
        <input id="scratch-picker-search" data-picker-type="${type}" type="search" placeholder="Type to filter" autocomplete="off" />
      </label>
      <div class="picker-results" id="scratch-picker-results">
        ${renderPickerResults(type)}
      </div>
    `,
    actions: [
      {
        label: "Cancel",
        className: "secondary"
      }
    ]
  });
}

function addPickedItem(type, id) {
  scratchItems.push({
    type,
    id,
    amount: type === "ingredient" ? "" : 1
  });

  closeModal();
  refreshScratchItems();
}

function openManualModal() {
  showModal({
    title: "Add Manual Calories",
    content: `
      <form class="stack" id="manual-calories-form">
        <p class="form-error" id="manual-calories-error" aria-live="polite"></p>

        <label>
          <span>Title</span>
          <input id="manual-title" type="text" placeholder="Bakery roll" autocomplete="off" />
        </label>

        <label>
          <span>Calories</span>
          <input id="manual-calories" type="number" min="0" step="1" placeholder="280" />
        </label>

        <label>
          <span>Notes</span>
          <textarea id="manual-notes" rows="2" placeholder="Optional"></textarea>
        </label>
      </form>
    `,
    actions: [
      {
        label: "Add",
        onClick: () => {
          const title = document.getElementById("manual-title").value.trim();
          const calories = Number(document.getElementById("manual-calories").value);
          const notes = document.getElementById("manual-notes").value.trim();
          const error = document.getElementById("manual-calories-error");

          if (!title) {
            error.textContent = "Add a title.";
            return false;
          }

          if (!Number.isFinite(calories) || calories < 0) {
            error.textContent = "Calories must be zero or higher.";
            return false;
          }

          scratchItems.push({
            type: "manual",
            title,
            calories,
            notes
          });

          refreshScratchItems();
          return true;
        }
      },
      {
        label: "Cancel",
        className: "secondary"
      }
    ]
  });
}

function updateKjResult() {
  const result = document.getElementById("calorieResult");
  if (!result) return;

  const kj = Number(kjValue || 0);
  result.textContent = kj ? `${formatMacro(kj / 4.2)} calories` : "Enter kJ above";
}

function bindCalculatorListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("click", (event) => {
    const pickerButton = event.target.closest("[data-open-scratch-picker]");
    const pickedButton = event.target.closest("[data-add-picked-item]");
    const manualButton = event.target.closest("[data-add-manual-calories]");
    const removeButton = event.target.closest("[data-remove-scratch-item]");

    if (pickerButton) {
      openPicker(pickerButton.dataset.openScratchPicker);
      return;
    }

    if (pickedButton) {
      addPickedItem(pickedButton.dataset.addPickedItem, pickedButton.dataset.pickedId);
      return;
    }

    if (manualButton) {
      openManualModal();
      return;
    }

    if (removeButton) {
      scratchItems.splice(Number(removeButton.dataset.removeScratchItem), 1);
      refreshScratchItems();
      return;
    }

    if (event.target.closest("[data-clear-scratchpad]")) {
      scratchItems = [];
      refreshScratchItems();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.id === "scratch-picker-search") {
      const results = document.getElementById("scratch-picker-results");
      if (results) {
        results.innerHTML = renderPickerResults(target.dataset.pickerType, target.value);
      }
      return;
    }

    if (target.id === "kjInput") {
      kjValue = target.value;
      updateKjResult();
      return;
    }

    const field = target.dataset.scratchField;
    if (!field) return;

    const index = Number(target.dataset.index);
    if (!scratchItems[index]) return;

    scratchItems[index][field] = target.value;
    refreshScratchCalories(index);
  });
}

export function renderCalculatorView() {
  bindCalculatorListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Daily Calc</h2>
        <p class="muted">A fast scratchpad for ingredients, recipes, quick foods, and manual calories.</p>
      </div>
      <button type="button" class="secondary" data-clear-scratchpad>Clear</button>
    </section>

    <section class="card scratchpad-actions">
      <button type="button" class="secondary small-button" data-open-scratch-picker="ingredient">Ingredient</button>
      <button type="button" class="secondary small-button" data-open-scratch-picker="recipe">Recipe</button>
      <button type="button" class="secondary small-button" data-open-scratch-picker="quickFood">Quick Food</button>
      <button type="button" class="secondary small-button" data-add-manual-calories>Manual</button>
    </section>

    <section class="card">
      <div id="scratch-total">
        ${renderScratchTotal()}
      </div>
      <div id="scratch-items">
        ${renderScratchItems()}
      </div>
    </section>

    <section class="card">
      <h3 class="compact-heading">kJ to calories</h3>
      <input
        id="kjInput"
        type="number"
        value="${escapeHtml(kjValue)}"
        placeholder="Enter kilojoules"
      />

      <div class="metric">
        <span class="muted">Estimated calories</span>
        <strong id="calorieResult">${kjValue ? `${formatMacro(Number(kjValue) / 4.2)} calories` : "Enter kJ above"}</strong>
      </div>
    </section>
  `;
}
