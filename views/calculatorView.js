import {
  addIngredient,
  addRecipe,
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
let activeScratchIndex = null;
let draftScratchItem = null;
let editingNewScratchItem = false;
let scratchModalCommitted = false;

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

function getRecipeProteinPerPortion(recipe) {
  if (Number.isFinite(Number(recipe.proteinPerPortion))) {
    return Number(recipe.proteinPerPortion);
  }

  const totals = calculateRecipeNutrition(recipe, getIngredients());
  return calculatePerPortion(totals, recipe.portions).protein;
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

function convertEnergyToCalories(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  return unit === "kj" ? number / 4.2 : number;
}

function formatEnergyInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number(number.toFixed(1)).toString();
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

function getScratchRecipeIngredientAmount(item, ingredient) {
  const amount = Number(item.amount) || 0;
  if (getIngredientMeasureType(ingredient) === "each") {
    return { quantity: amount };
  }

  return { grams: amount };
}

function getScratchRecipeConversions() {
  return scratchItems.filter((item) => item.type !== "ingredient");
}

function getConversionSummary(item) {
  if (item.type === "recipe") {
    const recipe = getRecipes().find((candidate) => candidate.id === item.id);
    return `${recipe?.name || "Missing recipe"} · per portion`;
  }

  if (item.type === "quickFood") {
    const food = getQuickFoods().find((candidate) => candidate.id === item.id);
    return `${food ? getQuickFoodTitle(food) : "Missing quick food"} · per ${food ? getQuickFoodServes(food) : "serve"}`;
  }

  if (item.manualBasis === "weight") return `${item.title || "Manual item"} · per 100g`;
  if (item.manualBasis === "each") return `${item.title || "Manual item"} · per ${item.unitLabel || "item"}`;
  return `${item.title || "Manual item"} · per serve`;
}

function buildIngredientFromScratchItem(item) {
  const base = {
    name: getScratchItemTitle(item),
    category: "Other",
    notes: item.notes || "Created from Scratch Pad while saving a recipe."
  };

  if (item.type === "recipe") {
    const recipe = getRecipes().find((candidate) => candidate.id === item.id);
    return {
      ...base,
      name: recipe?.name || base.name,
      measureType: "each",
      eachLabel: "portion",
      caloriesPerEach: Number(getRecipeCaloriesPerPortion(recipe || {}).toFixed(1)),
      proteinPerEach: Number(getRecipeProteinPerPortion(recipe || {}).toFixed(1)),
      caloriesPer100g: null,
      proteinPer100g: null
    };
  }

  if (item.type === "quickFood") {
    const food = getQuickFoods().find((candidate) => candidate.id === item.id);
    return {
      ...base,
      name: food ? getQuickFoodTitle(food) : base.name,
      measureType: "each",
      eachLabel: food ? getQuickFoodServes(food) : "serve",
      caloriesPerEach: Number(getQuickFoodCalories(food).toFixed(1)),
      proteinPerEach: 0,
      caloriesPer100g: null,
      proteinPer100g: null,
      notes: food?.notes || base.notes
    };
  }

  if (item.manualBasis === "weight") {
    return {
      ...base,
      measureType: "weight",
      caloriesPer100g: Number((Number(item.caloriesPer100g) || 0).toFixed(1)),
      proteinPer100g: 0,
      eachLabel: "",
      caloriesPerEach: null,
      proteinPerEach: null
    };
  }

  return {
    ...base,
    measureType: "each",
    eachLabel: item.manualBasis === "each" ? item.unitLabel || "item" : "serve",
    caloriesPerEach: Number((Number(item.caloriesPerEach ?? item.calories) || 0).toFixed(1)),
    proteinPerEach: 0,
    caloriesPer100g: null,
    proteinPer100g: null
  };
}

function getRecipeItemForConvertedScratchItem(item, ingredientId) {
  if (item.type === "manual" && item.manualBasis === "weight") {
    return {
      ingredientId,
      grams: Number(item.amount) || 0
    };
  }

  if (item.type === "ingredient") {
    const ingredient = getIngredient(item.id);
    return {
      ingredientId: item.id,
      ...getScratchRecipeIngredientAmount(item, ingredient)
    };
  }

  return {
    ingredientId,
    quantity: Number(item.amount) || 1
  };
}

function renderScratchRecipeConversionList() {
  const conversions = getScratchRecipeConversions();
  if (!conversions.length) {
    return `<p class="muted">All Scratch Pad items are already saved ingredients.</p>`;
  }

  return `
    <div class="conversion-list">
      <p class="muted">These items will be added to Ingredients first, then used in the recipe.</p>
      ${conversions.map((item) => `
        <div class="conversion-row">
          <span>${escapeHtml(getConversionSummary(item))}</span>
          <strong>${formatMacro(getScratchItemCalories(item))} cal</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function openSaveScratchRecipeModal() {
  if (!scratchItems.length) {
    showModal({
      title: "Save Recipe",
      content: `<p class="modal-copy">Add at least one Scratch Pad item before saving a recipe.</p>`,
      actions: [{ label: "OK", className: "secondary" }]
    });
    return;
  }

  showModal({
    title: "Save Recipe",
    content: `
      <form class="stack" id="scratch-recipe-form">
        <p class="form-error" id="scratch-recipe-error" aria-live="polite"></p>

        <div class="form-grid">
          <label>
            <span>Recipe name</span>
            <input id="scratch-recipe-name" type="text" placeholder="Chicken rice bowl" autocomplete="off" />
          </label>

          <label>
            <span>Portions</span>
            <input id="scratch-recipe-portions" type="number" min="1" step="1" value="1" />
          </label>
        </div>

        ${renderScratchRecipeConversionList()}
      </form>
    `,
    actions: [
      {
        label: "Save Recipe",
        onClick: async () => {
          const error = document.getElementById("scratch-recipe-error");
          const name = document.getElementById("scratch-recipe-name").value.trim();
          const portions = Math.max(Number(document.getElementById("scratch-recipe-portions").value) || 1, 1);

          if (!name) {
            if (error) error.textContent = "Name the recipe.";
            return false;
          }

          const recipeItems = [];

          try {
            for (const item of scratchItems) {
              const amount = Number(item.amount) || 0;

              if (item.type === "ingredient") {
                const ingredient = getIngredient(item.id);
                if (!ingredient || amount <= 0) continue;
                recipeItems.push(getRecipeItemForConvertedScratchItem(item, item.id));
                continue;
              }

              const ingredient = await addIngredient(buildIngredientFromScratchItem(item));
              recipeItems.push(getRecipeItemForConvertedScratchItem(item, ingredient.id));
            }

            if (!recipeItems.length) {
              if (error) error.textContent = "Add at least one item with an amount.";
              return false;
            }

            const recipe = {
              name,
              portions,
              items: recipeItems
            };
            const totals = calculateRecipeNutrition(recipe, getIngredients());
            const perPortion = calculatePerPortion(totals, portions);

            await addRecipe({
              ...recipe,
              caloriesTotal: Math.round(totals.calories),
              proteinTotal: Number(totals.protein.toFixed(1)),
              caloriesPerPortion: Math.round(perPortion.calories),
              proteinPerPortion: Number(perPortion.protein.toFixed(1))
            });

            scratchItems = [];
            refreshScratchItems();
            return true;
          } catch (saveError) {
            console.error("Could not save scratch recipe", saveError);
            if (error) error.textContent = "Could not save recipe. Try again.";
            return false;
          }
        }
      },
      {
        label: "Cancel",
        className: "secondary"
      }
    ]
  });
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
    <article class="scratch-item compact-scratch-item" data-scratch-item="${index}" data-edit-scratch-item="${index}" role="button" tabindex="0">
      <div class="scratch-main">
        <strong>${escapeHtml(getScratchItemTitle(item))}</strong>
        <span data-scratch-detail="${index}">${escapeHtml(getScratchItemDetail(item))}</span>
      </div>

      <strong class="scratch-card-calories" data-scratch-calories="${index}">
        ${formatMacro(getScratchItemCalories(item))} cal
      </strong>

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

function renderSaveScratchRecipeAction() {
  if (scratchItems.length < 2) return "";

  return `
    <button type="button" class="secondary scratch-save-recipe-button" data-save-scratch-recipe>
      Save Recipe
    </button>
  `;
}

function refreshScratchItems() {
  const items = document.getElementById("scratch-items");
  const total = document.getElementById("scratch-total");
  const saveAction = document.getElementById("scratch-save-recipe-action");

  if (items) items.innerHTML = renderScratchItems();
  if (total) total.innerHTML = renderScratchTotal();
  if (saveAction) saveAction.innerHTML = renderSaveScratchRecipeAction();
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

function getScratchEditTitle(item) {
  if (item.type === "manual") return "Edit Manual Item";
  if (item.type === "recipe") return "Edit Recipe";
  if (item.type === "quickFood") return "Edit Quick Food";
  return "Edit Ingredient";
}

function getScratchAmountConfig(item) {
  if (item.type === "ingredient") {
    const ingredient = getIngredient(item.id);
    const isEach = getIngredientMeasureType(ingredient) === "each";
    return {
      label: isEach ? "Quantity" : "Grams",
      step: isEach ? "0.1" : "1",
      placeholder: isEach ? "1.5" : "100",
      decimals: isEach ? 2 : 1
    };
  }

  if (item.type === "manual" && item.manualBasis === "weight") {
    return {
      label: "Grams",
      step: "1",
      placeholder: "100",
      decimals: 1
    };
  }

  if (item.type === "manual" && item.manualBasis === "each") {
    return {
      label: "Quantity",
      step: "0.1",
      placeholder: "1.5",
      decimals: 2
    };
  }

  if (item.type === "recipe") {
    return { label: "Portions", step: "0.1", placeholder: "1", decimals: 1 };
  }

  return { label: "Serves", step: "0.1", placeholder: "1", decimals: 1 };
}

function renderScratchEditContent() {
  if (!draftScratchItem) return "";
  const amountConfig = getScratchAmountConfig(draftScratchItem);
  const isManualTotal = draftScratchItem.type === "manual" && (!draftScratchItem.manualBasis || draftScratchItem.manualBasis === "total");

  return `
    <form class="stack" id="scratch-edit-form">
      <p class="form-error" id="scratch-edit-error" aria-live="polite"></p>

      ${draftScratchItem.type === "manual" ? `
        <label>
          <span>Title</span>
          <input id="scratch-edit-title" type="text" value="${escapeHtml(draftScratchItem.title)}" autocomplete="off" />
        </label>
      ` : `
        <div class="selected-ingredient">
          <span class="muted">${draftScratchItem.type === "ingredient" ? "Ingredient" : draftScratchItem.type === "recipe" ? "Recipe" : "Quick food"}</span>
          <strong>${escapeHtml(getScratchItemTitle(draftScratchItem))}</strong>
          <small>${escapeHtml(getScratchItemDetail(draftScratchItem))}</small>
        </div>
      `}

      ${isManualTotal ? `
        <label>
          <span>Calories</span>
          <input id="scratch-edit-calories" type="number" min="0" step="1" value="${escapeHtml(draftScratchItem.calories)}" />
        </label>
      ` : draftScratchItem.type === "recipe" || draftScratchItem.type === "quickFood" ? `
        <label>
          <span>${amountConfig.label}</span>
          <input id="scratch-edit-amount" type="number" min="0" step="${amountConfig.step}" value="${escapeHtml(draftScratchItem.amount)}" placeholder="${amountConfig.placeholder}" />
        </label>
      ` : `
        <div class="form-grid">
          <label>
            <span>${amountConfig.label}</span>
            <input id="scratch-edit-amount" type="number" min="0" step="${amountConfig.step}" value="${escapeHtml(draftScratchItem.amount)}" placeholder="${amountConfig.placeholder}" />
          </label>

          <label>
            <span>Calories</span>
            <input id="scratch-edit-calories" type="number" min="0" step="1" value="${escapeHtml(formatInputNumber(getScratchItemCalories(draftScratchItem), 0))}" />
          </label>
        </div>
      `}

      ${draftScratchItem.type === "manual" ? `
        <label>
          <span>Notes</span>
          <textarea id="scratch-edit-notes" rows="2" placeholder="Optional">${escapeHtml(draftScratchItem.notes)}</textarea>
        </label>
      ` : ""}
    </form>
  `;
}

function refreshScratchEditCalories(field) {
  if (!draftScratchItem) return;
  const amountInput = document.getElementById("scratch-edit-amount");
  const caloriesInput = document.getElementById("scratch-edit-calories");

  if (field === "amount" && caloriesInput) {
    caloriesInput.value = formatInputNumber(getScratchItemCalories(draftScratchItem), 0);
  }

  if (field === "calories" && amountInput) {
    amountInput.value = draftScratchItem.amount;
  }
}

function updateDraftScratchCaloriesFromInput(value) {
  if (!draftScratchItem) return;

  if (draftScratchItem.type === "ingredient") {
    const ingredient = getIngredient(draftScratchItem.id);
    draftScratchItem.amount = formatInputNumber(
      getAmountFromCalories(draftScratchItem.id, value),
      getIngredientMeasureType(ingredient) === "each" ? 2 : 1
    );
    return;
  }

  if (draftScratchItem.type === "manual" && draftScratchItem.manualBasis !== "total") {
    draftScratchItem.amount = formatInputNumber(
      getManualAmountFromCalories(draftScratchItem, value),
      draftScratchItem.manualBasis === "each" ? 2 : 1
    );
    return;
  }

  draftScratchItem.calories = value;
}

function openScratchItemModal(index, isNew = false) {
  activeScratchIndex = index;
  editingNewScratchItem = isNew;
  scratchModalCommitted = false;
  draftScratchItem = { ...scratchItems[index] };

  showModal({
    title: getScratchEditTitle(draftScratchItem),
    content: renderScratchEditContent(),
    actions: [
      {
        label: "Save",
        onClick: () => {
          const error = document.getElementById("scratch-edit-error");
          const amount = Number(draftScratchItem?.amount) || 0;
          const calories = Number(draftScratchItem?.calories) || 0;

          if (draftScratchItem?.type === "manual") {
            draftScratchItem.title = document.getElementById("scratch-edit-title")?.value.trim() || "";
            draftScratchItem.notes = document.getElementById("scratch-edit-notes")?.value.trim() || "";

            if (!draftScratchItem.title) {
              if (error) error.textContent = "Add a title.";
              return false;
            }
          }

          if (draftScratchItem?.type === "manual" && (!draftScratchItem.manualBasis || draftScratchItem.manualBasis === "total")) {
            if (!Number.isFinite(calories) || calories < 0) {
              if (error) error.textContent = "Calories must be zero or higher.";
              return false;
            }
          } else if (amount <= 0) {
            if (error) error.textContent = "Add an amount.";
            return false;
          }

          scratchItems[activeScratchIndex] = { ...draftScratchItem };
          scratchModalCommitted = true;
          refreshScratchItems();
          return true;
        }
      },
      {
        label: "Remove",
        className: "secondary danger-text",
        onClick: () => {
          scratchItems.splice(index, 1);
          scratchModalCommitted = true;
          refreshScratchItems();
          return true;
        }
      },
      {
        label: "Cancel",
        className: "secondary",
        onClick: () => {
          if (editingNewScratchItem) {
            scratchItems.splice(index, 1);
            scratchModalCommitted = true;
            refreshScratchItems();
          }
          return true;
        }
      }
    ],
    onClose: () => {
      if (editingNewScratchItem && !scratchModalCommitted && activeScratchIndex !== null) {
        scratchItems.splice(activeScratchIndex, 1);
        refreshScratchItems();
      }
      activeScratchIndex = null;
      draftScratchItem = null;
      editingNewScratchItem = false;
      scratchModalCommitted = false;
    }
  });
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
  const index = scratchItems.length;
  scratchItems.push({
    type,
    id,
    amount: type === "ingredient" ? "" : 1
  });

  closeModal();
  refreshScratchItems();
  openScratchItemModal(index, true);
}

function refreshManualBasisFields() {
  const basis = document.getElementById("manual-basis")?.value || "total";
  const energyUnit = document.getElementById("manual-energy-unit")?.value === "kj" ? "kJ" : "Calories";
  const unitWrap = document.getElementById("manual-unit-wrap");
  const amountWrap = document.getElementById("manual-amount-wrap");
  const caloriesLabel = document.getElementById("manual-calories-label");
  const amountLabel = document.getElementById("manual-amount-label");
  const amountInput = document.getElementById("manual-amount");

  if (unitWrap) unitWrap.classList.toggle("is-hidden", basis !== "each");
  if (amountWrap) amountWrap.classList.toggle("is-hidden", basis === "total");

  if (caloriesLabel) {
    caloriesLabel.textContent = basis === "weight"
      ? `${energyUnit} per 100g`
      : basis === "each"
        ? `${energyUnit} per item`
        : energyUnit;
  }

  if (amountLabel) amountLabel.textContent = basis === "each" ? "Quantity" : "Grams";
  if (amountInput) {
    amountInput.placeholder = basis === "each" ? "1.5" : "100";
    amountInput.step = basis === "each" ? "0.1" : "1";
  }
}

function convertManualEnergyInput() {
  const unitInput = document.getElementById("manual-energy-unit");
  const caloriesInput = document.getElementById("manual-calories");
  if (!unitInput || !caloriesInput) return;

  const previousUnit = unitInput.dataset.currentUnit || "cal";
  const nextUnit = unitInput.value === "kj" ? "kj" : "cal";
  const currentValue = Number(caloriesInput.value);

  if (previousUnit !== nextUnit && Number.isFinite(currentValue) && currentValue >= 0) {
    caloriesInput.value = formatEnergyInput(nextUnit === "kj" ? currentValue * 4.2 : currentValue / 4.2);
  }

  unitInput.dataset.currentUnit = nextUnit;
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

        <div>
          <span class="field-label">Energy input</span>
          <input id="manual-energy-unit" type="hidden" value="cal" data-current-unit="cal" />
          <div class="segmented-control" role="group" aria-label="Energy input">
            <button type="button" class="active" data-manual-energy-option="cal" aria-pressed="true">Calories</button>
            <button type="button" data-manual-energy-option="kj" aria-pressed="false">kJ</button>
          </div>
        </div>

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
          const energyUnit = document.getElementById("manual-energy-unit").value === "kj" ? "kj" : "cal";
          const calories = convertEnergyToCalories(document.getElementById("manual-calories").value, energyUnit);
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
            manualItem.caloriesPer100g = Number(calories.toFixed(1));
            manualItem.amount = amount;
          } else if (manualBasis === "each") {
            manualItem.caloriesPerEach = Number(calories.toFixed(1));
            manualItem.amount = amount;
            manualItem.unitLabel = unitLabel;
          } else {
            manualItem.calories = Number(calories.toFixed(1));
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
    const saveRecipeButton = event.target.closest("[data-save-scratch-recipe]");
    const manualEnergyButton = event.target.closest("[data-manual-energy-option]");
    const removeButton = event.target.closest("[data-remove-scratch-item]");
    const editButton = event.target.closest("[data-edit-scratch-item]");

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

    if (saveRecipeButton) {
      openSaveScratchRecipeModal();
      return;
    }

    if (manualEnergyButton) {
      const energyInput = document.getElementById("manual-energy-unit");
      const wrapper = manualEnergyButton.closest(".segmented-control");
      if (energyInput) energyInput.value = manualEnergyButton.dataset.manualEnergyOption;
      wrapper?.querySelectorAll("[data-manual-energy-option]").forEach((button) => {
        const isActive = button === manualEnergyButton;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      convertManualEnergyInput();
      refreshManualBasisFields();
      return;
    }

    if (removeButton) {
      scratchItems.splice(Number(removeButton.dataset.removeScratchItem), 1);
      refreshScratchItems();
      return;
    }

    if (editButton) {
      openScratchItemModal(Number(editButton.dataset.editScratchItem));
      return;
    }

    if (event.target.closest("[data-clear-scratchpad]")) {
      scratchItems = [];
      refreshScratchItems();
    }
  });

  document.addEventListener("keydown", (event) => {
    const editButton = event.target.closest("[data-edit-scratch-item]");
    if (!editButton || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    openScratchItemModal(Number(editButton.dataset.editScratchItem));
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

    if (target.id === "scratch-edit-amount" && draftScratchItem) {
      draftScratchItem.amount = target.value;
      refreshScratchEditCalories("amount");
      return;
    }

    if (target.id === "scratch-edit-calories" && draftScratchItem) {
      updateDraftScratchCaloriesFromInput(target.value);
      refreshScratchEditCalories("calories");
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
      <div id="scratch-save-recipe-action">
        ${renderSaveScratchRecipeAction()}
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
