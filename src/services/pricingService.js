export function calculateDynamicPrice(basePrice, demandLevel) {

  if (demandLevel === "high") {
    return basePrice * 1.2;
  }

  if (demandLevel === "low") {
    return basePrice * 0.9;
  }

  return basePrice;

}
