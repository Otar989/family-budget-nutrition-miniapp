import { STORES } from "@/data/catalog";
import type { CartItem } from "@/types";
import { NextResponse } from "next/server";

interface OrderBody {
  cart: CartItem[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrderBody;
    if (!body.cart?.length) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    const storeIds = [...new Set(body.cart.map((item) => item.selectedStoreId))];

    const orderLinks = storeIds.map((storeId) => {
      const store = STORES.find((entry) => entry.id === storeId);
      return {
        storeId,
        storeName: store?.name ?? storeId,
        checkoutUrl: store?.checkoutUrl ?? "",
      };
    });

    return NextResponse.json({
      orderId: `ORD-${Date.now()}`,
      status: "created",
      orderLinks,
      message:
        "Order draft created. In production, this endpoint should call retail APIs for real checkout sessions.",
    });
  } catch {
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }
}
