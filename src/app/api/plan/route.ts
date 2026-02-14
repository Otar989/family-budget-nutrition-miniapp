import { buildNutritionPlan } from "@/lib/planner";
import type { PlanRequest } from "@/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlanRequest;
    const plan = buildNutritionPlan(body);
    return NextResponse.json(plan);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build nutrition plan.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
