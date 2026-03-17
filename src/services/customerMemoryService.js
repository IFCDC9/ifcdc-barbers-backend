import {
  getCustomerMemory as _getCustomerMemory,
  updateCustomerMemory as _updateCustomerMemory,
  upsertCustomerProfile as _upsertCustomerProfile
} from "./customerMemory.js"

export async function getCustomerMemory(customerId) {
  return _getCustomerMemory(customerId)
}

export async function updateCustomerMemory(customerId, service, barber, options = {}) {
  return _updateCustomerMemory(customerId, service, barber, options)
}

export async function upsertCustomerProfile(customerId, profile = {}) {
  return _upsertCustomerProfile(customerId, profile)
}
