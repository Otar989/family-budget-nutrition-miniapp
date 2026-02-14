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
      return NextResponse.json({ error: "Корзина пуста." }, { status: 400 });
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
        "Черновик заказа создан. Для полноценного заказа подключите API ритейлеров с реальными корзинами и оплатой.",
    });
  } catch {
    return NextResponse.json({ error: "Не удалось создать заказ." }, { status: 500 });
  }
}
