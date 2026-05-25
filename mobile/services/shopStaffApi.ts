import { apiFetch } from "./api";
import {
  getMergedPlaceholderShops,
  getPlaceholderShop,
  isPlaceholderShopId,
  PLACEHOLDER_SHOPS,
  savePlaceholderShopLocally,
  type ShopRow,
} from "./shopPlaceholderStore";

export type { ShopRow };
export { PLACEHOLDER_SHOPS };

export const SHOP_SAVE_UNAVAILABLE = "Shop save unavailable right now.";

export type SaveShopResult = {
  shop: ShopRow;
  savedLocally: boolean;
};

function detailQuery(businessId: string | number) {
  return `/api/shop/detail?businessId=${encodeURIComponent(String(businessId))}`;
}

function userFacingShopError(e: unknown): string {
  if (e instanceof Error && e.message.includes("[api]")) {
    return SHOP_SAVE_UNAVAILABLE;
  }
  return SHOP_SAVE_UNAVAILABLE;
}

export async function fetchShopList(): Promise<ShopRow[]> {
  try {
    const res = await apiFetch("/api/shop/list");
    const json = (await res.json()) as {
      success?: boolean;
      shops?: ShopRow[];
      message?: string;
      error?: string;
    };
    if (!res.ok || json.success === false) {
      throw new Error("shop_list_unavailable");
    }
    const shops = Array.isArray(json.shops) ? json.shops : [];
    if (shops.length > 0) {
      return shops;
    }
  } catch {
    // Fall back to preview shops when list API is empty or unavailable.
  }
  return getMergedPlaceholderShops();
}

export async function fetchShopDetail(businessId: string | number): Promise<ShopRow | null> {
  if (isPlaceholderShopId(businessId)) {
    return getPlaceholderShop(businessId);
  }

  try {
    const res = await apiFetch(detailQuery(businessId));
    const json = (await res.json()) as {
      success?: boolean;
      shop?: ShopRow;
      message?: string;
      error?: string;
    };
    if (!res.ok || json.success === false) {
      return null;
    }
    return json.shop ?? null;
  } catch {
    return null;
  }
}

export async function saveShopDetail(
  businessId: string | number,
  body: { name?: string; phone?: string | null },
): Promise<SaveShopResult> {
  if (isPlaceholderShopId(businessId)) {
    const shop = await savePlaceholderShopLocally(businessId, body);
    return { shop, savedLocally: true };
  }

  try {
    const res = await apiFetch(detailQuery(businessId), {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      success?: boolean;
      shop?: ShopRow;
      message?: string;
      error?: string;
    };
    if (!res.ok || json.success === false || !json.shop) {
      throw new Error(SHOP_SAVE_UNAVAILABLE);
    }
    return { shop: json.shop, savedLocally: false };
  } catch (e) {
    throw new Error(userFacingShopError(e));
  }
}
