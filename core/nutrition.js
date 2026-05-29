export function getIngredientMeasureType(ingredient) {
  return ingredient?.measureType === "each" ? "each" : "weight";
}

export function getIngredientUnitLabel(ingredient) {
  return ingredient?.eachLabel?.trim() || "item";
}

export function getIngredientCaloriesPerUnit(ingredient) {
  if (getIngredientMeasureType(ingredient) === "each") {
    return Number(ingredient?.caloriesPerEach) || 0;
  }

  return Number(ingredient?.caloriesPer100g) || 0;
}

export function getIngredientProteinPerUnit(ingredient) {
  if (getIngredientMeasureType(ingredient) === "each") {
    return Number(ingredient?.proteinPerEach) || 0;
  }

  return Number(ingredient?.proteinPer100g) || 0;
}

export function getRecipeItemAmount(item, ingredient) {
  if (getIngredientMeasureType(ingredient) === "each") {
    return Number(item.quantity) || 0;
  }

  return Number(item.grams) || 0;
}

export function calculateIngredientItemNutrition(item, ingredient) {
  const amount = getRecipeItemAmount(item, ingredient);

  if (!ingredient || amount <= 0) {
    return { calories: 0, protein: 0 };
  }

  if (getIngredientMeasureType(ingredient) === "each") {
    return {
      calories: getIngredientCaloriesPerUnit(ingredient) * amount,
      protein: getIngredientProteinPerUnit(ingredient) * amount
    };
  }

  return {
    calories: getIngredientCaloriesPerUnit(ingredient) * amount / 100,
    protein: getIngredientProteinPerUnit(ingredient) * amount / 100
  };
}

export function calculateRecipeNutrition(recipe, ingredients) {
  const items = recipe.items || [];

  return items.reduce(
    (totals, item) => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      const itemNutrition = calculateIngredientItemNutrition(item, ingredient);

      totals.calories += itemNutrition.calories;
      totals.protein += itemNutrition.protein;

      return totals;
    },
    { calories: 0, protein: 0 }
  );
}

export function calculatePerPortion(totals, portions) {
  const portionCount = Math.max(Number(portions) || 1, 1);

  return {
    calories: totals.calories / portionCount,
    protein: totals.protein / portionCount
  };
}

export function formatMacro(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toFixed(decimals);
}
