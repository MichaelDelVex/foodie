import {
  getIngredients,
  getQuickFoods,
  getRecipes
} from "../core/store.js";
import {
  calculatePerPortion,
  calculateRecipeNutrition,
  formatMacro,
  getIngredientCaloriesPerUnit,
  getIngredientMeasureType,
  getIngredientUnitLabel
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

function getIngredient(ingredientId) {
  const ingredient = getIngredients().find((candidate) => candidate.id === ingredientId);
  return ingredient;
}

function getCaloriesFromAmount(ingredientId, amount) {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) return 0;

  if (getIngredientMeasureType(ingredient) === "each") {
    return getIngredientCaloriesPerUnit(ingredient) * (Number(amount) || 0);
  }

  return getIngredientCaloriesPerUnit(ingredient) * (Number(amount) || 0) / 100;
}

function getAmountFromCalories(ingredientId, calories) {
  const ingredient = getIngredient(ingredientId);
  const caloriesPerUnit = getIngredientCaloriesPerUnit(ingredient);
  if (!ingredient || caloriesPerUnit <= 0) return "";

  if (getIngredientMeasureType(ingredient) === "each") {
    return (Number(calories) || 0) / caloriesPerUnit;
  }

  return (Number(calories) || 0) * 100 / caloriesPerUnit;
}

function formatInputNumber(value, decimals = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return Number(number.toFixed(decimals)).toString();
}

function formatAmount(value, decimals = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number(number.toFixed(decimals)).toString();
}

function getScratchItemCalories(item) {
  if (item.type === "ingredient") {
    return getCaloriesFromAmount(item.id, item.amount);
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

  if (item.type === "manual" && item.manualBasis === "weight") {
    return (Number(item.caloriesPer100g) || 0) * (Number(item.amount) || 0) / 100;
  }

  if (item.type === "manual" && item.manualBasis === "each") {
    return (Number(item.caloriesPerEach) || 0) * (Number(item.amount) || 0);
  }

  return Number(item.calories) || 0;
}

function getScratchTotal() {
  return scratchItems.reduce((total, item) => total + getScratchItemCalories(item), 0);
}

function getScratchItemTitle(item) {
  if (item.type === "ingredient") {
    return getIngredient(item.id)?.name || "Missing ingredient";
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
    const ingredient = getIngredient(item.id);
    const amount = Number(item.amount) || 0;
    if (getIngredientMeasureType(ingredient) === "each") {
      return amount > 0 ? `${formatAmount(amount, 2)} ${getIngredientUnitLabel(ingredient)}` : "Add quantity";
    }

    return amount > 0 ? `${formatAmount(amount, 1)}g raw` : "Add grams";
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

  if (item.type === "manual" && item.manualBasis === "weight") {
    const amount = Number(item.amount) || 0;
    return amount > 0 ? `${formatAmount(amount, 1)}g` : "Add grams";
  }

  if (item.type === "manual" && item.manualBasis === "each") {
    const amount = Number(item.amount) || 0;
    return amount > 0 ? `${formatAmount(amount, 2)} ${item.unitLabel || "item"}` : "Add quantity";
  }

  return item.notes || "Manual calories";
}

function getManualCaloriesFromAmount(item, amount) {
  if (item.manualBasis === "weight") {
    return (Number(item.caloriesPer100g) || 0) * (Number(amount) || 0) / 100;
  }

  if (item.manualBasis === "each") {
    return (Number(item.caloriesPerEach) || 0) * (Number(amount) || 0);
  }

  return Number(item.calories) || 0;
}

function getManualAmountFromCalories(item, calories) {
  if (item.manualBasis === "weight") {
    const caloriesPer100g = Number(item.caloriesPer100g) || 0;
    return caloriesPer100g > 0 ? (Number(calories) || 0) * 100 / caloriesPer100g : "";
  }

  if (item.manualBasis === "each") {
    const caloriesPerEach = Number(item.caloriesPerEach) || 0;
    return caloriesPerEach > 0 ? (Number(calories) || 0) / caloriesPerEach : "";
  }

  return "";
}

function renderManualScratchControls(item, index) {
  if (item.manualBasis === "weight" || item.manualBasis === "each") {
    const isEach = item.manualBasis === "each";
    return `
      <div class="paired-inputs">
        <label class="scratch-amount">
          <span>${isEach ? "Quantity" : "Grams"}</span>
          <input data-scratch-field="amount" data-index="${index}" type="number" min="0" step="${isEach ? "0.1" : "1"}" value="${escapeHtml(item.amount)}" />
        </label>

        <label class="scratch-amount">
          <span>Calories</span>
          <input data-scratch-field="manualCalories" data-index="${index}" type="number" min="0" step="1" value="${escapeHtml(formatInputNumber(getScratchItemCalories(item), 0))}" />
        </label>
      </div>
    `;
  }

  return `
    <label class="scratch-amount">
      <span>Calories</span>
      <input data-scratch-field="calories" data-index="${index}" type="number" min="0" step="1" value="${escapeHtml(item.calories)}" />
    </label>
  `;
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

      ${item.type === "ingredient" ? `
        <div class="paired-inputs">
          <label class="scratch-amount">
            <span>${getIngredientMeasureType(getIngredient(item.id)) === "each" ? "Quantity" : "Grams"}</span>
            <input data-scratch-field="amount" data-index="${index}" type="number" min="0" step="${getIngredientMeasureType(getIngredient(item.id)) === "each" ? "0.1" : "1"}" value="${escapeHtml(item.amount)}" />
          </label>

          <label class="scratch-amount">
            <span>Calories</span>
            <input data-scratch-field="ingredientCalories" data-index="${index}" type="number" min="0" step="1" value="${escapeHtml(formatInputNumber(getScratchItemCalories(item), 0))}" />
          </label>
        </div>
      ` : item.type === "manual" ? renderManualScratchControls(item, index) : `
        <label class="scratch-amount">
          <span>${item.type === "ingredient" ? "Grams" : "Serves"}</span>
          <input data-scratch-field="amount" data-index="${index}" type="number" min="0" step="${item.type === "ingredient" ? "1" : "0.1"}" value="${escapeHtml(item.amount)}" />
        </label>
      `}

      <div class="scratch-calories" data-scratch-calories="${index}">
        ${formatMacro(getScratchItemCalories(item))} cal
      </div>

      <button type="button" class="icon-action danger-text" aria-label="Remove ${escapeHtml(getScratchItemTitle(item))}" data-remove-scratch-item="${index}">&times;</button>
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

function refreshScratchPairedInput(index, field) {
  const item = scratchItems[index];
  const row = document.querySelector(`[data-scratch-item="${index}"]`);
  if (!item || !row) return;

  const amountInput = row.querySelector('[data-scratch-field="amount"]');
  const caloriesInput = row.querySelector('[data-scratch-field="ingredientCalories"], [data-scratch-field="manualCalories"]');

  if (item.type === "manual") {
    if (field === "amount" && caloriesInput) {
      caloriesInput.value = formatInputNumber(getScratchItemCalories(item), 0);
    }

    if (field === "manualCalories" && amountInput) {
      amountInput.value = item.amount;
    }

    return;
  }

  if (item.type !== "ingredient") return;

  if (field === "amount" && caloriesInput) {
    caloriesInput.value = formatInputNumber(getScratchItemCalories(item), 0);
  }

  if (field === "ingredientCalories" && amountInput) {
    amountInput.value = item.amount;
  }
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
      meta: getIngredientMeasureType(ingredient) === "each"
        ? `${formatMacro(getIngredientCaloriesPerUnit(ingredient))} cal / ${getIngredientUnitLabel(ingredient)}`
        : `${formatMacro(getIngredientCaloriesPerUnit(ingredient))} cal / 100g`
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

function refreshManualBasisFields() {
  const basis = document.getElementById("manual-basis")?.value || "total";
  const unitWrap = document.getElementById("manual-unit-wrap");
  const amountWrap = document.getElementById("manual-amount-wrap");
  const caloriesLabel = document.getElementById("manual-calories-label");
  const amountLabel = document.getElementById("manual-amount-label");
  const amountInput = document.getElementById("manual-amount");

  if (unitWrap) unitWrap.classList.toggle("is-hidden", basis !== "each");
  if (amountWrap) amountWrap.classList.toggle("is-hidden", basis === "total");

  if (caloriesLabel) {
    caloriesLabel.textContent = basis === "weight"
      ? "Calories per 100g"
      : basis === "each"
        ? "Calories per item"
        : "Calories";
  }

  if (amountLabel) amountLabel.textContent = basis === "each" ? "Quantity" : "Grams";
  if (amountInput) {
    amountInput.placeholder = basis === "each" ? "1.5" : "100";
    amountInput.step = basis === "each" ? "0.1" : "1";
  }
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
          <span>Nutrition basis</span>
          <select id="manual-basis">
            <option value="total">Total calories</option>
            <option value="weight">Per 100g</option>
            <option value="each">Per item</option>
          </select>
        </label>

        <label id="manual-unit-wrap" class="is-hidden">
          <span>Item label</span>
          <input id="manual-unit-label" type="text" placeholder="egg, tomato, banana" autocomplete="off" />
        </label>

        <label>
          <span id="manual-calories-label">Calories</span>
          <input id="manual-calories" type="number" min="0" step="1" placeholder="280" />
        </label>

        <label id="manual-amount-wrap" class="is-hidden">
          <span id="manual-amount-label">Grams</span>
          <input id="manual-amount" type="number" min="0" step="1" placeholder="100" />
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
          const manualBasis = document.getElementById("manual-basis").value;
          const calories = Number(document.getElementById("manual-calories").value);
          const amount = Number(document.getElementById("manual-amount").value);
          const unitLabel = document.getElementById("manual-unit-label").value.trim();
          const notes = document.getElementById("manual-notes").value.trim();
          const error = document.getElementById("manual-calories-error");

          if (!title) {
            error.textContent = "Add a title.";
            return false;
          }

          if (manualBasis === "each" && !unitLabel) {
            error.textContent = "Add an item label.";
            return false;
          }

          if (!Number.isFinite(calories) || calories < 0) {
            error.textContent = "Calories must be zero or higher.";
            return false;
          }

          if (manualBasis !== "total" && (!Number.isFinite(amount) || amount <= 0)) {
            error.textContent = manualBasis === "each" ? "Add a quantity." : "Add grams.";
            return false;
          }

          const manualItem = {
            type: "manual",
            title,
            manualBasis,
            notes
          };

          if (manualBasis === "weight") {
            manualItem.caloriesPer100g = calories;
            manualItem.amount = amount;
          } else if (manualBasis === "each") {
            manualItem.caloriesPerEach = calories;
            manualItem.amount = amount;
            manualItem.unitLabel = unitLabel;
          } else {
            manualItem.calories = calories;
          }

          scratchItems.push(manualItem);

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

    if (field === "ingredientCalories" && scratchItems[index].type === "ingredient") {
      const ingredient = getIngredient(scratchItems[index].id);
      scratchItems[index].amount = formatInputNumber(
        getAmountFromCalories(scratchItems[index].id, target.value),
        getIngredientMeasureType(ingredient) === "each" ? 2 : 1
      );
    } else if (field === "manualCalories" && scratchItems[index].type === "manual") {
      scratchItems[index].amount = formatInputNumber(
        getManualAmountFromCalories(scratchItems[index], target.value),
        scratchItems[index].manualBasis === "each" ? 2 : 1
      );
    } else {
      scratchItems[index][field] = target.value;
    }

    refreshScratchPairedInput(index, field);
    refreshScratchCalories(index);
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "manual-basis") refreshManualBasisFields();
  });
}

export function renderCalculatorView() {
  bindCalculatorListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Scratch Pad</h2>
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
