import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const HOUSEHOLD_ID = "michael-and-jade";

let ingredients = [];
let quickFoods = [];
let recipes = [];

function householdCollection(collectionName) {
  return collection(db, "households", HOUSEHOLD_ID, collectionName);
}

function householdDoc(collectionName, id) {
  return doc(db, "households", HOUSEHOLD_ID, collectionName, id);
}

export async function loadData() {
  const ingredientSnapshot = await getDocs(householdCollection("ingredients"));
  ingredients = ingredientSnapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const quickFoodSnapshot = await getDocs(householdCollection("quickFoods"));
  quickFoods = quickFoodSnapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const recipeSnapshot = await getDocs(householdCollection("recipes"));
  recipes = recipeSnapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

export function clearData() {
  ingredients = [];
  quickFoods = [];
  recipes = [];
}

export function getIngredients() {
  return ingredients;
}

export function getQuickFoods() {
  return quickFoods;
}

export function getQuickFoodById(id) {
  return quickFoods.find(food => food.id === id);
}

export function getRecipes() {
  return recipes;
}

export function getRecipeById(id) {
  return recipes.find(r => r.id === id);
}

export function getIngredientById(id) {
  return ingredients.find(i => i.id === id);
}

export async function addIngredient(ingredient) {
  const now = Date.now();
  const savedIngredient = {
    ...ingredient,
    createdAt: now,
    updatedAt: now
  };

  const ref = await addDoc(householdCollection("ingredients"), savedIngredient);

  ingredients.push({
    id: ref.id,
    ...savedIngredient
  });

  return {
    id: ref.id,
    ...savedIngredient
  };
}

export async function updateIngredient(id, updated) {
  const savedIngredient = {
    ...updated,
    updatedAt: Date.now()
  };

  await updateDoc(householdDoc("ingredients", id), savedIngredient);

  ingredients = ingredients.map(i =>
    i.id === id ? { ...i, ...savedIngredient } : i
  );
}

export async function deleteIngredient(id) {
  await deleteDoc(householdDoc("ingredients", id));
  ingredients = ingredients.filter(i => i.id !== id);
}

export async function addQuickFood(food) {
  const now = Date.now();
  const savedFood = {
    ...food,
    createdAt: now,
    updatedAt: now
  };

  const ref = await addDoc(householdCollection("quickFoods"), savedFood);

  quickFoods.push({
    id: ref.id,
    ...savedFood
  });
}

export async function updateQuickFood(id, updated) {
  const savedFood = {
    ...updated,
    updatedAt: Date.now()
  };

  await updateDoc(householdDoc("quickFoods", id), savedFood);

  quickFoods = quickFoods.map(food =>
    food.id === id ? { ...food, ...savedFood } : food
  );
}

export async function deleteQuickFood(id) {
  await deleteDoc(householdDoc("quickFoods", id));
  quickFoods = quickFoods.filter(food => food.id !== id);
}

export async function addRecipe(recipe) {
  const now = Date.now();
  const savedRecipe = {
    ...recipe,
    createdAt: now,
    updatedAt: now
  };

  const ref = await addDoc(householdCollection("recipes"), savedRecipe);

  recipes.push({
    id: ref.id,
    ...savedRecipe
  });

  return {
    id: ref.id,
    ...savedRecipe
  };
}

export async function updateRecipe(id, updated) {
  const savedRecipe = {
    ...updated,
    updatedAt: Date.now()
  };

  await updateDoc(householdDoc("recipes", id), savedRecipe);

  recipes = recipes.map(r =>
    r.id === id ? { ...r, ...savedRecipe } : r
  );
}

export async function deleteRecipe(id) {
  await deleteDoc(householdDoc("recipes", id));
  recipes = recipes.filter(r => r.id !== id);
}
