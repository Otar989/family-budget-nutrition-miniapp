export type PlanPeriod = "meal" | "day" | "week" | "month";

export type Allergy =
  | "nuts"
  | "lactose"
  | "gluten"
  | "seafood"
  | "eggs"
  | "soy";

export type AgeGroup = "adult" | "teen" | "child";

export type DietPref = "classic" | "healthy" | "vegetarian" | "budget";

export interface FamilyMember {
  id: string;
  name: string;
  ageGroup: AgeGroup;
  allergies: Allergy[];
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  allergens: Allergy[];
  category: "protein" | "garnish" | "vegetable" | "dairy" | "basic" | "fruit";
  prices: Record<string, number>;
}

export interface MealProduct {
  productId: string;
  unitsPerServing: number;
}

export interface Meal {
  id: string;
  title: string;
  description: string;
  minutes: number;
  tags: string[];
  kcalPerServing: number;
  products: MealProduct[];
  steps: string[];
}

export interface RetailStore {
  id: string;
  name: string;
  logo: string;
  deliveryFee: number;
  checkoutUrl: string;
}

export interface PlanRequest {
  period: PlanPeriod;
  budget: number;
  family: FamilyMember[];
  dietPref?: DietPref;
}

export interface PlannedMeal {
  meal: Meal;
  times: number;
  estimatedTotal: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  selectedStoreId: string;
}

export interface StoreSummary {
  store: RetailStore;
  subtotal: number;
  items: Array<{
    productName: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
}

export interface PlanResponse {
  familySize: number;
  period: PlanPeriod;
  budget: number;
  totalEstimated: number;
  meals: PlannedMeal[];
  stores: StoreSummary[];
  cart: CartItem[];
  notes: string[];
}
