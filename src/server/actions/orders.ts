/**
 * Server Actions — order mutations.
 * Re-exports from /src/lib/ for backward compatibility.
 * New mutations should be added directly here.
 */

export {
  submitOrder,
  validateVatAction,
  type ShippingInput,
} from "@/lib/order-actions";

export {
  approveProof,
  requestProofRevision,
  reorderFromOrder,
} from "@/lib/customer-actions";
