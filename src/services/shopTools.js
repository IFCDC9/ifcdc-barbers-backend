import supabase from "../db/supabaseClient.js"

const AVG_SERVICE_MINUTES = Number(process.env.AVG_SERVICE_MINUTES || 20)
const DEFAULT_ACTIVE_BARBERS = Number(process.env.DEFAULT_ACTIVE_BARBERS || 1)

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY."
    )
  }
}

const getActiveBarbersCount = async () => {
  const { data, error } = await supabase
    .from("barber_status")
    .select("status")

  if (error || !Array.isArray(data)) {
    return Math.max(1, DEFAULT_ACTIVE_BARBERS)
  }

  const activeStatuses = new Set(["available", "busy", "in_service", "cutting"])
  const activeBarbers = data.filter(row => activeStatuses.has(String(row?.status || "").toLowerCase())).length

  return Math.max(1, activeBarbers || DEFAULT_ACTIVE_BARBERS)
}

export async function checkAvailability(date, barber) {
  ensureSupabase()

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("date", date)
    .eq("barber", barber)

  if (error) throw error
  return data
}

export async function createAppointment(customer, barber, date, time) {
  ensureSupabase()

  const { data, error } = await supabase
    .from("appointments")
    .insert([
      {
        customer,
        barber,
        date,
        time
      }
    ])

  if (error) throw error
  return data
}

export async function getQueueStatus() {
  ensureSupabase()

  const { data, error } = await supabase
    .from("queue")
    .select("*")
    .order("position")

  if (error) throw error

  const rawQueue = Array.isArray(data) ? data : []
  const activeBarbers = await getActiveBarbersCount()

  const queue = rawQueue.map((entry, index) => {
    const position = Number(entry.position || index + 1)
    const peopleAhead = Math.max(0, position - 1)
    const estimatedWait = Math.ceil((peopleAhead * AVG_SERVICE_MINUTES) / activeBarbers)

    return {
      customer: entry.customer || entry.customer_name || entry.name || "Customer",
      position,
      estimated_wait_minutes: estimatedWait,
      likely_barber: entry.likely_barber || entry.barber || entry.barber_name || null
    }
  })

  return {
    queue
  }
}

export async function addToQueue(customerName) {
  ensureSupabase()

  const { data, error } = await supabase
    .from("queue")
    .insert([{ customer: customerName }])

  if (error) throw error
  return data
}

export const runShopTool = async (toolName, args = {}) => {
  switch (toolName) {
    case "checkAvailability":
      return checkAvailability(args.date, args.barber)
    case "createAppointment":
      return createAppointment(args.customer, args.barber, args.date, args.time)
    case "getQueueStatus":
      return getQueueStatus()
    case "addToQueue":
      return addToQueue(args.customerName)
    default:
      throw new Error(`Unknown shop tool: ${toolName}`)
  }
}
