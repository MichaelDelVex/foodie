import {
  addQuickFood,
  deleteQuickFood,
  getQuickFoodById,
  getQuickFoods,
  updateQuickFood
} from "../core/store.js";
import { showModal } from "../core/modal.js";

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

function getFoodTitle(food) {
  return food?.title || food?.name || "";
}

function getFoodCalories(food) {
  return food?.calories ?? food?.caloriesPerServe ?? "";
}

function getFoodServes(food) {
  return food?.serves || food?.servingDescription || "";
}

function getFoodNotes(food) {
  return food?.notes || "";
}

function getFilteredQuickFoods() {
  const query = searchQuery.trim().toLowerCase();
  const foods = [...getQuickFoods()].sort((a, b) =>
    getFoodTitle(a).localeCompare(getFoodTitle(b), undefined, { sensitivity: "base" })
  );

  if (!query) return foods;

  return foods.filter((food) =>
    [getFoodTitle(food), getFoodNotes(food), getFoodServes(food)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query))
  );
}

function setFormError(message) {
  const error = document.getElementById("quick-food-form-error");
  if (error) error.textContent = message || "";
}

function normalizeQuickFoodForm() {
  const title = document.getElementById("quick-food-title").value.trim();
  const notes = document.getElementById("quick-food-notes").value.trim();
  const energyUnit = document.getElementById("quick-food-energy-unit").value === "kj" ? "kj" : "cal";
  const calories = convertEnergyToCalories(document.getElementById("quick-food-calories").value, energyUnit);
  const serves = document.getElementById("quick-food-serves").value.trim();

  if (!title) return { error: "Add a title." };
  if (!Number.isFinite(calories) || calories < 0) {
    return { error: "Calories must be zero or higher." };
  }
  if (!serves) return { error: "Add what it serves, like 1 bowl or 6 pieces." };

  return {
    value: {
      title,
      notes,
      calories: Number(calories.toFixed(1)),
      serves
    }
  };
}

function renderQuickFoodForm(food) {
  return `
    <form class="stack" id="quick-food-form">
      <p class="form-error" id="quick-food-form-error" aria-live="polite"></p>

      <label>
        <span>Title</span>
        <input id="quick-food-title" type="text" value="${escapeHtml(getFoodTitle(food))}" placeholder="Chicken kebab" autocomplete="off" />
      </label>

      <label>
        <span>Notes</span>
        <textarea id="quick-food-notes" rows="3" placeholder="Shop, size, sauce, rough estimate...">${escapeHtml(getFoodNotes(food))}</textarea>
      </label>

      <div class="form-grid">
        <div>
          <span class="field-label">Energy input</span>
          <input id="quick-food-energy-unit" type="hidden" value="cal" data-current-unit="cal" />
          <div class="segmented-control" role="group" aria-label="Energy input">
            <button type="button" class="active" data-quick-food-energy-option="cal" aria-pressed="true">Calories</button>
            <button type="button" data-quick-food-energy-option="kj" aria-pressed="false">kJ</button>
          </div>
        </div>

        <label>
          <span id="quick-food-calories-label">Calories</span>
          <input id="quick-food-calories" type="number" min="0" step="1" value="${escapeHtml(getFoodCalories(food))}" placeholder="650" />
        </label>
      </div>

      <div class="form-grid">
        <label>
          <span>Serves</span>
          <input id="quick-food-serves" type="text" value="${escapeHtml(getFoodServes(food))}" placeholder="1 wrap" autocomplete="off" />
        </label>
      </div>
    </form>
  `;
}

function refreshQuickFoodEnergyFields() {
  const energyUnit = document.getElementById("quick-food-energy-unit")?.value === "kj" ? "kJ" : "Calories";
  const label = document.getElementById("quick-food-calories-label");
  const input = document.getElementById("quick-food-calories");

  if (label) label.textContent = energyUnit;
  if (input) input.placeholder = energyUnit === "kJ" ? "2730" : "650";
}

function convertQuickFoodEnergyInput() {
  const unitInput = document.getElementById("quick-food-energy-unit");
  const caloriesInput = document.getElementById("quick-food-calories");
  if (!unitInput || !caloriesInput) return;

  const previousUnit = unitInput.dataset.currentUnit || "cal";
  const nextUnit = unitInput.value === "kj" ? "kj" : "cal";
  const currentValue = Number(caloriesInput.value);

  if (previousUnit !== nextUnit && Number.isFinite(currentValue) && currentValue >= 0) {
    caloriesInput.value = formatEnergyInput(nextUnit === "kj" ? currentValue * 4.2 : currentValue / 4.2);
  }

  unitInput.dataset.currentUnit = nextUnit;
}

function openQuickFoodModal(id) {
  const food = id ? getQuickFoodById(id) : null;
  const isEditing = Boolean(food);

  showModal({
    title: isEditing ? "Edit Quick Food" : "Add Quick Food",
    content: renderQuickFoodForm(food),
    actions: [
      {
        label: isEditing ? "Save" : "Add",
        onClick: async () => {
          setFormError("");
          const result = normalizeQuickFoodForm();

          if (result.error) {
            setFormError(result.error);
            return false;
          }

          try {
            if (isEditing) {
              await updateQuickFood(id, result.value);
            } else {
              await addQuickFood(result.value);
            }
          } catch (error) {
            console.error("Could not save quick food", error);
            setFormError("Could not save quick food. Try again.");
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

function openDeleteQuickFoodModal(id) {
  const food = getQuickFoodById(id);
  if (!food) return;

  showModal({
    title: "Delete Quick Food",
    content: `
      <p class="modal-copy">
        Delete <strong>${escapeHtml(getFoodTitle(food))}</strong>? This removes it from quick foods.
      </p>
    `,
    actions: [
      {
        label: "Delete",
        className: "danger",
        onClick: async () => {
          try {
            await deleteQuickFood(id);
            window.render();
          } catch (error) {
            console.error("Could not delete quick food", error);
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

function renderQuickFoodCard(food) {
  return `
    <article class="quick-food-card">
      <div class="compact-card-header">
        <h3>${escapeHtml(getFoodTitle(food) || "Untitled quick food")}</h3>
        <button type="button" class="icon-action danger-text" aria-label="Delete ${escapeHtml(getFoodTitle(food))}" data-delete-quick-food="${food.id}">&times;</button>
      </div>

      ${getFoodNotes(food) ? `<p class="quick-food-notes">${escapeHtml(getFoodNotes(food))}</p>` : ""}

      <div class="quick-food-meta">
        <span><strong>${formatNumber(getFoodCalories(food))}</strong> cal</span>
        <span>${escapeHtml(getFoodServes(food))}</span>
      </div>

      <button type="button" class="icon-action edit-action" aria-label="Edit ${escapeHtml(getFoodTitle(food))}" data-edit-quick-food="${food.id}">&#9998;</button>
    </article>
  `;
}

function renderQuickFoodList() {
  const foods = getFilteredQuickFoods();

  if (!foods.length) {
    return `
      <div class="empty-state">
        <h3>${searchQuery ? "No matching quick foods" : "No quick foods yet"}</h3>
        <p class="muted">${searchQuery ? "Try another search term." : "Add takeaway, ready meals, sushi, or packaged foods for fast lookup."}</p>
        ${searchQuery ? "" : `<button type="button" class="secondary small-button empty-action" data-add-quick-food>Add Quick Food</button>`}
      </div>
    `;
  }

  return `
    <div class="list">
      ${foods.map(renderQuickFoodCard).join("")}
    </div>
  `;
}

function refreshQuickFoods() {
  const results = document.getElementById("quick-food-results");
  const count = document.getElementById("quick-food-count");

  if (results) results.innerHTML = renderQuickFoodList();
  if (count) count.textContent = `${getFilteredQuickFoods().length} saved`;
}

function bindQuickFoodListeners() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("click", (event) => {
    const energyButton = event.target.closest("[data-quick-food-energy-option]");
    const addButton = event.target.closest("[data-add-quick-food]");
    const editButton = event.target.closest("[data-edit-quick-food]");
    const deleteButton = event.target.closest("[data-delete-quick-food]");

    if (energyButton) {
      const energyInput = document.getElementById("quick-food-energy-unit");
      const wrapper = energyButton.closest(".segmented-control");
      if (energyInput) energyInput.value = energyButton.dataset.quickFoodEnergyOption;
      wrapper?.querySelectorAll("[data-quick-food-energy-option]").forEach((button) => {
        const isActive = button === energyButton;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      convertQuickFoodEnergyInput();
      refreshQuickFoodEnergyFields();
      return;
    }

    if (addButton) openQuickFoodModal();
    if (editButton) openQuickFoodModal(editButton.dataset.editQuickFood);
    if (deleteButton) openDeleteQuickFoodModal(deleteButton.dataset.deleteQuickFood);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id !== "quick-food-search") return;
    searchQuery = event.target.value;
    refreshQuickFoods();
  });
}

window.openQuickFoodModal = openQuickFoodModal;

export function renderQuickFoodsView() {
  bindQuickFoodListeners();

  return `
    <section class="view-header">
      <div>
        <h2>Quick Foods</h2>
        <p class="muted">Fast calorie lookups for takeaway, ready meals, and packaged foods.</p>
      </div>
      <button type="button" data-add-quick-food onclick="event.stopPropagation(); window.openQuickFoodModal()">Add</button>
    </section>

    <section class="card ingredient-toolbar">
      <label class="search-field">
        <span>Search quick foods</span>
        <input id="quick-food-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search by title, notes, or serves" autocomplete="off" />
      </label>
      <span class="muted" id="quick-food-count">${getFilteredQuickFoods().length} saved</span>
    </section>

    <div id="quick-food-results">
      ${renderQuickFoodList()}
    </div>
  `;
}
