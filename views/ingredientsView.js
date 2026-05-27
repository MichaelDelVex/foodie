import {
  addIngredient,
  deleteIngredient,
  getIngredientById,
  getIngredients,
  updateIngredient
} from "../core/store.js";
import { showModal } from "../core/modal.js";

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
  const caloriesPer100g = Number(document.getElementById("ingredient-calories").value);
  const proteinPer100g = Number(document.getElementById("ingredient-protein").value);
  const notes = document.getElementById("ingredient-notes").value.trim();

  if (!name) return { error: "Add an ingredient name." };
  if (!category) return { error: "Choose a category." };
  if (!Number.isFinite(caloriesPer100g) || caloriesPer100g < 0) {
    return { error: "Calories must be zero or higher." };
  }
  if (!Number.isFinite(proteinPer100g) || proteinPer100g < 0) {
    return { error: "Protein must be zero or higher." };
  }

  return {
    value: {
      name,
      category,
      caloriesPer100g,
      proteinPer100g,
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

      <div class="form-grid">
        <label>
          <span>Calories per 100g</span>
          <input id="ingredient-calories" type="number" min="0" step="0.1" value="${escapeHtml(ingredient?.caloriesPer100g)}" placeholder="165" />
        </label>

        <label>
          <span>Protein per 100g</span>
          <input id="ingredient-protein" type="number" min="0" step="0.1" value="${escapeHtml(ingredient?.proteinPer100g)}" placeholder="31" />
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
        <button type="button" class="icon-action danger-text" aria-label="Delete ${escapeHtml(ingredient.name)}" data-delete-ingredient="${ingredient.id}">x</button>
      </div>

      <div class="compact-card-meta">
        <span class="category-pill">${escapeHtml(ingredient.category || "Other")}</span>
        <span class="compact-macros">${formatNumber(ingredient.caloriesPer100g)} cal / 100g · ${formatNumber(ingredient.proteinPer100g)}g protein</span>
      </div>

      ${ingredient.notes ? `<p class="ingredient-notes">${escapeHtml(ingredient.notes)}</p>` : ""}

      <button type="button" class="icon-action edit-action" aria-label="Edit ${escapeHtml(ingredient.name)}" data-edit-ingredient="${ingredient.id}">Edit</button>
    </article>
  `;
}

function renderIngredientsList() {
  const ingredients = getFilteredIngredients();

  if (!ingredients.length) {
    return `
      <div class="empty-state">
        <h3>${searchQuery ? "No matching ingredients" : "No ingredients yet"}</h3>
        <p class="muted">${searchQuery ? "Try a different search term." : "Add raw ingredients with calories and protein per 100g."}</p>
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
}

export function renderIngredientsView() {
  bindIngredientListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Ingredients</h2>
        <p class="muted">Raw ingredient nutrition, stored per 100g for recipe maths.</p>
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
