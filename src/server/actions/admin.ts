/**
 * Server Actions — admin mutations.
 * Re-exports from /src/lib/ for backward compatibility.
 * New mutations should be added directly here.
 */

export {
  uploadProof,
  changeOrderStatus,
  addInternalNote,
  replyToRevision,
  refundOrder,
  generateInvoice,
  refreshInvoiceUrl,
  updateProduct,
  getSendCloudShippingMethods,
  createShipment,
} from "@/lib/admin-actions";
