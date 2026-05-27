export function calculateRecipeNutrition(recipe, ingredients) {
  const items = recipe.items || [];

  return items.reduce(
    (totals, item) => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      const grams = Number(item.grams) || 0;

      if (!ingredient || grams <= 0) return totals;

      totals.calories += (Number(ingredient.caloriesPer100g) || 0) * grams / 100;
      totals.protein += (Number(ingredient.proteinPer100g) || 0) * grams / 100;

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
