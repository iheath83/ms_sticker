import { getMyOrders } from "@/lib/customer-actions";
import OrdersListClient from "./orders-list-client";

export default async function MyOrdersPage() {
  const orders = await getMyOrders();
  return <OrdersListClient orders={orders} />;
}
