import AsyncStorage from "@react-native-async-storage/async-storage";

export type ShopRow = {
  business_id: string | number;
  name?: string;
  phone?: string | null;
  plan?: string | null;
  status?: string | null;
  owner_name?: string | null;
  barber_count?: number;
  booking_count?: number;
  isPlaceholder?: boolean;
};

export const PLACEHOLDER_SHOPS: ShopRow[] = [
  {
    business_id: "placeholder-ifcdc",
    name: "IFCDC Barbers HQ",
    status: "active",
    owner_name: "IFCDC Platform",
    barber_count: 0,
    booking_count: 0,
    isPlaceholder: true,
  },
  {
    business_id: "placeholder-westside",
    name: "Westside Barbers",
    status: "active",
    owner_name: "Shop Owner",
    barber_count: 0,
    booking_count: 0,
    isPlaceholder: true,
  },
];

const OVERRIDES_KEY = "ifcdc_placeholder_shop_overrides";

export function isPlaceholderShopId(businessId: string | number): boolean {
  return String(businessId).startsWith("placeholder-");
}

async function loadOverrides(): Promise<Record<string, Partial<ShopRow>>> {
  const raw = await AsyncStorage.getItem(OVERRIDES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ShopRow>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getMergedPlaceholderShops(): Promise<ShopRow[]> {
  const overrides = await loadOverrides();
  return PLACEHOLDER_SHOPS.map((base) => {
    const patch = overrides[String(base.business_id)];
    if (!patch) return { ...base };
    return {
      ...base,
      ...patch,
      business_id: base.business_id,
      isPlaceholder: true,
    };
  });
}

export async function getPlaceholderShop(businessId: string | number): Promise<ShopRow | null> {
  const shops = await getMergedPlaceholderShops();
  return shops.find((s) => String(s.business_id) === String(businessId)) ?? null;
}

export async function savePlaceholderShopLocally(
  businessId: string | number,
  patch: { name?: string; phone?: string | null },
): Promise<ShopRow> {
  const id = String(businessId);
  const base = PLACEHOLDER_SHOPS.find((s) => String(s.business_id) === id);
  const overrides = await loadOverrides();
  const prev = overrides[id] || {};
  const next: Partial<ShopRow> = {
    ...prev,
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
  };
  overrides[id] = next;
  await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));

  return {
    ...(base || { business_id: id, name: patch.name || "Shop", isPlaceholder: true }),
    ...next,
    business_id: id,
    isPlaceholder: true,
  } as ShopRow;
}
