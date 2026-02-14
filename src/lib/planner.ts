import { MEALS, PRODUCTS, STORES } from "@/data/catalog";
import type {
  Allergy,
  CartItem,
  DietPref,
  Meal,
  PlanPeriod,
  PlanRequest,
  PlanResponse,
  PlannedMeal,
  StoreSummary,
} from "@/types";

const PERIOD_MULTIPLIER: Record<PlanPeriod, number> = {
  meal: 1,
  day: 3,
  week: 21,
  month: 90,
};

const AGE_FACTOR = {
  adult: 1,
  teen: 0.9,
  child: 0.65,
} as const;

const DIET_TAGS: Record<DietPref, string[]> = {
  classic: [],
  healthy: ["белок"],
  vegetarian: ["вегетарианское"],
  budget: ["бюджет"],
};

function getProduct(productId: string) {
  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Продукт ${productId} не найден`);
  }
  return product;
}

function cheapestStore(productId: string) {
  const product = getProduct(productId);
  const [storeId, price] = Object.entries(product.prices).sort(
    (a, b) => a[1] - b[1],
  )[0];
  return { storeId, price };
}

function mealContainsAllergen(meal: Meal, blockedAllergens: Set<Allergy>) {
  return meal.products.some((entry) => {
    const product = getProduct(entry.productId);
    return product.allergens.some((allergen) => blockedAllergens.has(allergen));
  });
}

function mealCostPerServing(meal: Meal) {
  return meal.products.reduce((sum, entry) => {
    const cheapest = cheapestStore(entry.productId);
    return sum + cheapest.price * entry.unitsPerServing;
  }, 0);
}

function mealMatchesDiet(meal: Meal, dietPref: DietPref) {
  const requiredTags = DIET_TAGS[dietPref];
  if (!requiredTags.length) return true;
  return requiredTags.some((tag) => meal.tags.includes(tag));
}

function buildCart(meals: PlannedMeal[], familyWeight: number) {
  const cartMap = new Map<string, CartItem>();

  meals.forEach(({ meal, times }) => {
    meal.products.forEach(({ productId, unitsPerServing }) => {
      const needed = unitsPerServing * familyWeight * times;
      const { storeId } = cheapestStore(productId);

      const existing = cartMap.get(productId);
      if (existing) {
        existing.quantity += needed;
      } else {
        cartMap.set(productId, {
          productId,
          quantity: needed,
          selectedStoreId: storeId,
        });
      }
    });
  });

  return [...cartMap.values()];
}

function summarizeStores(cart: CartItem[]): StoreSummary[] {
  const groups = new Map<string, StoreSummary>();

  cart.forEach((item) => {
    const product = getProduct(item.productId);
    const store = STORES.find((storeItem) => storeItem.id === item.selectedStoreId);

    if (!store) {
      return;
    }

    const price = product.prices[item.selectedStoreId] * item.quantity;
    const roundedQuantity = Number(item.quantity.toFixed(2));

    if (!groups.has(store.id)) {
      groups.set(store.id, {
        store,
        subtotal: 0,
        items: [],
      });
    }

    const group = groups.get(store.id)!;
    group.subtotal += price;
    group.items.push({
      productName: product.name,
      quantity: roundedQuantity,
      unit: product.unit,
      price,
    });
  });

  return [...groups.values()].map((entry) => ({
    ...entry,
    subtotal: Number((entry.subtotal + entry.store.deliveryFee).toFixed(2)),
    items: entry.items.map((item) => ({
      ...item,
      price: Number(item.price.toFixed(2)),
    })),
  }));
}

export function buildNutritionPlan(input: PlanRequest): PlanResponse {
  if (!input.family.length) {
    throw new Error("Добавьте хотя бы одного члена семьи.");
  }

  if (input.budget <= 0) {
    throw new Error("Бюджет должен быть больше 0.");
  }

  const blockedAllergens = new Set<Allergy>(
    input.family.flatMap((member) => member.allergies),
  );

  const familyWeight = input.family.reduce(
    (sum, member) => sum + AGE_FACTOR[member.ageGroup],
    0,
  );

  const targetMeals = PERIOD_MULTIPLIER[input.period];
  const dietPref = input.dietPref ?? "classic";

  let safeMeals = MEALS.filter((meal) => !mealContainsAllergen(meal, blockedAllergens));

  // Prefer meals matching diet preference, but fallback to all safe meals
  const dietMeals = safeMeals.filter((m) => mealMatchesDiet(m, dietPref));
  if (dietMeals.length >= 3) {
    safeMeals = dietMeals;
  }

  if (!safeMeals.length) {
    throw new Error("Не найдено блюд с учётом выбранных аллергий и предпочтений.");
  }

  const sorted = [...safeMeals].sort((a, b) => mealCostPerServing(a) - mealCostPerServing(b));
  const planMap = new Map<string, PlannedMeal>();

  let spent = 0;
  let plannedCount = 0;
  let cursor = 0;

  while (plannedCount < targetMeals) {
    const meal = sorted[cursor % sorted.length];
    const cost = mealCostPerServing(meal) * familyWeight;

    if (spent + cost > input.budget && plannedCount > 0) {
      break;
    }

    const existing = planMap.get(meal.id);
    if (existing) {
      existing.times += 1;
      existing.estimatedTotal += cost;
    } else {
      planMap.set(meal.id, {
        meal,
        times: 1,
        estimatedTotal: cost,
      });
    }

    spent += cost;
    plannedCount += 1;
    cursor += 1;

    if (cursor > targetMeals * 3) {
      break;
    }
  }

  const meals = [...planMap.values()].map((entry) => ({
    ...entry,
    estimatedTotal: Number(entry.estimatedTotal.toFixed(2)),
  }));

  const cart = buildCart(meals, familyWeight);
  const stores = summarizeStores(cart);
  const totalEstimated = Number(stores.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));

  const notes: string[] = [];
  if (plannedCount < targetMeals) {
    notes.push(
      `Бюджета хватает на ${plannedCount} из ${targetMeals} приёмов пищи. Увеличьте бюджет для полного плана.`,
    );
  }

  if (blockedAllergens.size) {
    notes.push(
      `Исключены аллергены: ${[...blockedAllergens].join(", ")}.`,
    );
  }

  return {
    familySize: input.family.length,
    period: input.period,
    budget: input.budget,
    totalEstimated,
    meals,
    stores,
    cart: cart.map((item) => ({
      ...item,
      quantity: Number(item.quantity.toFixed(2)),
    })),
    notes,
  };
}
