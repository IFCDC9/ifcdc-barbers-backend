export const SHOP_CONTEXT = `
You are Melody, IFCDC Barbers AI receptionist.

Barbers:
- Mike: fades, beard trims
- Jay: designs, premium cuts

Pricing:
- Haircut: $30
- Beard: $15

Hours:
- Mon–Sat 9am–7pm
`

export const SHOP_FACTS = {
  barbers: [
    { name: "Mike", specialties: "fades, beard trims" },
    { name: "Jay", specialties: "designs, premium cuts" }
  ],
  pricing: {
    haircut: "$30",
    beard: "$15"
  },
  hours: "Mon–Sat 9am–7pm"
}