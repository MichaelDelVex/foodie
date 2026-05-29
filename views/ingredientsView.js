import {
  addIngredient,
  deleteIngredient,
  getIngredientById,
  getIngredients,
  updateIngredient
} from "../core/store.js";
import { showModal } from "../core/modal.js";
import {
  getIngredientCaloriesPerUnit,
  getIngredientMeasureType,
  getIngredientProteinPerUnit,
  getIngredientUnitLabel
} from "../core/nutrition.js";

const CATEGORIES = [
  "Meat",
  "Dairy",
  "Deli",
  "Vegetables",
  "Carbs",
  "Sauces",
  "Oils",
  "Frozen",
  "Snacks",
  "Other"
];

let searchQuery = "";
let listenersBound = false;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function normalizeIngredientForm() {
  const name = document.getElementById("ingredient-name").value.trim();
  const category = document.getElementById("ingredient-category").value;
  const measureType = document.getElementById("ingredient-measure-type").value === "each" ? "each" : "weight";
  const calories = Number(document.getElementById("ingredient-calories").value);
  const protein = Number(document.getElementById("ingredient-protein").value);
  const eachLabel = document.getElementById("ingredient-each-label").value.trim();
  const notes = document.getElementById("ingredient-notes").value.trim();

  if (!name) return { error: "Add an ingredient name." };
  if (!category) return { error: "Choose a category." };
  if (measureType === "each" && !eachLabel) return { error: "Add an item label." };
  if (!Number.isFinite(calories) || calories < 0) {
    return { error: "Calories must be zero or higher." };
  }
  if (!Number.isFinite(protein) || protein < 0) {
    return { error: "Protein must be zero or higher." };
  }

  return {
    value: {
      name,
      category,
      measureType,
      caloriesPer100g: measureType === "weight" ? calories : null,
      proteinPer100g: measureType === "weight" ? protein : null,
      eachLabel: measureType === "each" ? eachLabel : "",
      caloriesPerEach: measureType === "each" ? calories : null,
      proteinPerEach: measureType === "each" ? protein : null,
      notes
    }
  };
}

function setFormError(message) {
  const error = document.getElementById("ingredient-form-error");
  if (error) error.textContent = message || "";
}

function getFilteredIngredients() {
  const query = searchQuery.trim().toLowerCase();
  const ingredients = [...getIngredients()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  if (!query) return ingredients;

  return ingredients.filter((ingredient) =>
    [ingredient.name, ingredient.category, ingredient.notes]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  );
}

function groupIngredients(ingredients) {
  return ingredients.reduce((groups, ingredient) => {
    const category = ingredient.category || "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(ingredient);
    return groups;
  }, {});
}

function renderCategoryOptions(selectedCategory = "") {
  return CATEGORIES.map((category) => `
    <option value="${category}" ${selectedCategory === category ? "selected" : ""}>${category}</option>
  `).join("");
}

function renderIngredientForm(ingredient) {
  const measureType = getIngredientMeasureType(ingredient);
  const calories = getIngredientCaloriesPerUnit(ingredient);
  const protein = getIngredientProteinPerUnit(ingredient);
  const unitLabel = getIngredientUnitLabel(ingredient);

  return `
    <form class="stack" id="ingredient-form">
      <p class="form-error" id="ingredient-form-error" aria-live="polite"></p>

      <label>
        <span>Name</span>
        <input id="ingredient-name" type="text" value="${escapeHtml(ingredient?.name)}" placeholder="Chicken breast" autocomplete="off" />
      </label>

      <label>
        <span>Category</span>
        <select id="ingredient-category">
          <option value="">Choose category</option>
          ${renderCategoryOptions(ingredient?.category)}
        </select>
      </label>

      <label>
        <span>Nutrition basis</span>
        <select id="ingredient-measure-type">
          <option value="weight" ${measureType === "weight" ? "selected" : ""}>Per 100g</option>
          <option value="each" ${measureType === "each" ? "selected" : ""}>Per item</option>
        </select>
      </label>

      <label id="ingredient-each-label-wrap" class="${measureType === "each" ? "" : "is-hidden"}">
        <span>Item label</span>
        <input id="ingredient-each-label" type="text" value="${escapeHtml(unitLabel === "item" ? "" : unitLabel)}" placeholder="egg, tomato, banana" autocomplete="off" />
      </label>

      <div class="form-grid">
        <label>
          <span id="ingredient-calories-label">${measureType === "each" ? "Calories per item" : "Calories per 100g"}</span>
          <input id="ingredient-calories" type="number" min="0" step="0.1" value="${escapeHtml(calories)}" placeholder="${measureType === "each" ? "70" : "165"}" />
        </label>

        <label>
          <span id="ingredient-protein-label">${measureType === "each" ? "Protein per item" : "Protein per 100g"}</span>
          <input id="ingredient-protein" type="number" min="0" step="0.1" value="${escapeHtml(protein)}" placeholder="${measureType === "each" ? "6" : "31"}" />
        </label>
      </div>

      <label>
        <span>Notes</span>
        <textarea id="ingredient-notes" rows="3" placeholder="Raw, skinless, brand notes...">${escapeHtml(ingredient?.notes)}</textarea>
      </label>
    </form>
  `;
}

function openIngredientModal(id) {
  const ingredient = id ? getIngredientById(id) : null;
  const isEditing = Boolean(ingredient);

  showModal({
    title: isEditing ? "Edit Ingredient" : "Add Ingredient",
    content: renderIngredientForm(ingredient),
    actions: [
      {
        label: isEditing ? "Save" : "Add",
        onClick: async () => {
          setFormError("");
          const result = normalizeIngredientForm();

          if (result.error) {
            setFormError(result.error);
            return false;
          }

          try {
            if (isEditing) {
              await updateIngredient(id, result.value);
            } else {
              await addIngredient(result.value);
            }
          } catch (error) {
            console.error("Could not save ingredient", error);
            setFormError("Could not save ingredient. Try again.");
            return false;
          }

          window.render();
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

function refreshIngredientMeasureFields() {
  const measureType = document.getElementById("ingredient-measure-type")?.value === "each" ? "each" : "weight";
  const itemLabel = document.getElementById("ingredient-each-label-wrap");
  const caloriesLabel = document.getElementById("ingredient-calories-label");
  const proteinLabel = document.getElementById("ingredient-protein-label");

  if (itemLabel) itemLabel.classList.toggle("is-hidden", measureType !== "each");
  if (caloriesLabel) caloriesLabel.textContent = measureType === "each" ? "Calories per item" : "Calories per 100g";
  if (proteinLabel) proteinLabel.textContent = measureType === "each" ? "Protein per item" : "Protein per 100g";
}

function getIngredientMacroText(ingredient) {
  if (getIngredientMeasureType(ingredient) === "each") {
    const unit = getIngredientUnitLabel(ingredient);
    return `${formatNumber(ingredient.caloriesPerEach)} cal / ${unit} · ${formatNumber(ingredient.proteinPerEach)}g protein`;
  }

  return `${formatNumber(ingredient.caloriesPer100g)} cal / 100g · ${formatNumber(ingredient.proteinPer100g)}g protein`;
}

function openDeleteModal(id) {
  const ingredient = getIngredientById(id);
  if (!ingredient) return;

  showModal({
    title: "Delete Ingredient",
    content: `
      <p class="modal-copy">
        Delete <strong>${escapeHtml(ingredient.name)}</strong>? This removes it from the shared ingredient list.
      </p>
    `,
    actions: [
      {
        label: "Delete",
        className: "danger",
        onClick: async () => {
          try {
            await deleteIngredient(id);
            window.render();
          } catch (error) {
            console.error("Could not delete ingredient", error);
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

function renderIngredientCard(ingredient) {
  return `
    <article class="ingredient-card">
      <div class="compact-card-header">
        <h3>${escapeHtml(ingredient.name)}</h3>
        <button type="button" class="icon-action danger-text" aria-label="Delete ${escapeHtml(ingredient.name)}" data-delete-ingredient="${ingredient.id}">&times;</button>
      </div>

      <div class="compact-card-meta">
        <span class="category-pill">${escapeHtml(ingredient.category || "Other")}</span>
        <span class="compact-macros">${escapeHtml(getIngredientMacroText(ingredient))}</span>
      </div>

      ${ingredient.notes ? `<p class="ingredient-notes">${escapeHtml(ingredient.notes)}</p>` : ""}

      <button type="button" class="icon-action edit-action" aria-label="Edit ${escapeHtml(ingredient.name)}" data-edit-ingredient="${ingredient.id}">&#9998;</button>
    </article>
  `;
}

function renderIngredientsList() {
  const ingredients = getFilteredIngredients();

  if (!ingredients.length) {
    return `
      <div class="empty-state">
        <h3>${searchQuery ? "No matching ingredients" : "No ingredients yet"}</h3>
        <p class="muted">${searchQuery ? "Try a different search term." : "Add ingredients by weight or by item."}</p>
        ${searchQuery ? "" : `<button type="button" class="secondary small-button empty-action" data-add-ingredient>Add Ingredient</button>`}
      </div>
    `;
  }

  const groups = groupIngredients(ingredients);
  const orderedCategories = CATEGORIES.filter((category) => groups[category]).concat(
    Object.keys(groups).filter((category) => !CATEGORIES.includes(category))
  );

  return orderedCategories.map((category) => `
    <section class="ingredient-group">
      <div class="group-heading">
        <h3>${escapeHtml(category)}</h3>
        <span>${groups[category].length}</span>
      </div>
      <div class="list">
        ${groups[category].map(renderIngredientCard).join("")}
      </div>
    </section>
  `).join("");
}

function refreshIngredientResults() {
  const results = document.getElementById("ingredient-results");
  const count = document.getElementById("ingredient-count");

  if (results) results.innerHTML = renderIngredientsList();
  if (count) count.textContent = `${getFilteredIngredients().length} saved`;
}

function bindIngredientListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-ingredient]");
    const editButton = event.target.closest("[data-edit-ingredient]");
    const deleteButton = event.target.closest("[data-delete-ingredient]");

    if (addButton) openIngredientModal();
    if (editButton) openIngredientModal(editButton.dataset.editIngredient);
    if (deleteButton) openDeleteModal(deleteButton.dataset.deleteIngredient);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "ingredient-search") return;
    searchQuery = event.target.value;
    refreshIngredientResults();
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "ingredient-measure-type") refreshIngredientMeasureFields();
  });
}

export function renderIngredientsView() {
  bindIngredientListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Ingredients</h2>
        <p class="muted">Ingredient nutrition for weighed foods or simple per-item foods.</p>
      </div>
      <button type="button" data-add-ingredient>Add</button>
    </section>

    <section class="card ingredient-toolbar">
      <label class="search-field">
        <span>Search ingredients</span>
        <input id="ingredient-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search by name, category, or notes" autocomplete="off" />
      </label>
      <span class="muted" id="ingredient-count">${getFilteredIngredients().length} saved</span>
    </section>

    <div id="ingredient-results">
      ${renderIngredientsList()}
    </div>
  `;
}
