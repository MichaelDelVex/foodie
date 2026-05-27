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

export function getRecipes() {
  return recipes;
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
  const ref = await addDoc(householdCollection("quickFoods"), {
    ...food,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  quickFoods.push({
    id: ref.id,
    ...food
  });
}

export async function addRecipe(recipe) {
  const ref = await addDoc(householdCollection("recipes"), {
    ...recipe,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  recipes.push({
    id: ref.id,
    ...recipe
  });
}

export async function updateRecipe(id, updated) {
  await updateDoc(householdDoc("recipes", id), {
    ...updated,
    updatedAt: Date.now()
  });

  recipes = recipes.map(r =>
    r.id === id ? { ...r, ...updated } : r
  );
}
