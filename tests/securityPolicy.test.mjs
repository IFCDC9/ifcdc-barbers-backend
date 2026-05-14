import assert from "node:assert/strict";
import { isPlatformOperatorJwt, isShopScopedStaffJwt, tenantMatches } from "../securityPolicy.js";

assert.equal(isPlatformOperatorJwt({ role: "admin", isSuperAdmin: true, isOwner: true }), true);
assert.equal(isPlatformOperatorJwt({ role: "admin" }), true);
assert.equal(isPlatformOperatorJwt({ role: "super_admin" }), true);
assert.equal(isPlatformOperatorJwt({ role: "super_admin", isSuperAdmin: true }), true);
assert.equal(isPlatformOperatorJwt({ role: "shop_owner" }), false);
assert.equal(isPlatformOperatorJwt({ role: "barber" }), false);
assert.equal(isPlatformOperatorJwt({ role: "user" }), false);

assert.equal(isShopScopedStaffJwt({ role: "shop_owner" }), true);
assert.equal(isShopScopedStaffJwt({ role: "barber" }), false);

assert.equal(tenantMatches(5, 5), true);
assert.equal(tenantMatches(5, 6), false);
assert.equal(tenantMatches(null, 5), false);

console.log("securityPolicy tests: OK");
