/** SQL for checking AV Cooling aircon purchases usable in service bookings. */
export function airconPurchaseModel(db) {
  return {
    findCustomerPurchasedUnits(customerId, orderItemId = null) {
      const byItem = orderItemId == null ? "" : "AND oi.order_item_id = ?";
      const args =
        orderItemId == null ? [customerId] : [customerId, orderItemId];

      return db.execute(
        `SELECT
           oi.order_item_id AS orderItemId,
           o.order_number AS orderNumber,
           o.order_status AS orderStatus,
           o.fulfillment_method AS fulfillmentMethod,
           p.brand,
           oi.product_name_snapshot AS productName,
           oi.model_snapshot AS model,
           CAST(v.horsepower AS DOUBLE) AS horsepower,
           oi.quantity,
           oi.installation_included AS installationIncluded,
           EXISTS (
             SELECT 1 FROM fulfillment_events fe
             WHERE fe.event_kind = 'ORDER'
               AND fe.record_id = o.order_id
               AND fe.event_code = 'ORDER_DELIVERED'
           ) OR EXISTS (
             SELECT 1 FROM work_orders wo
             WHERE wo.order_id = o.order_id
               AND wo.work_type = 'DELIVERY'
               AND wo.status = 'COMPLETED'
           ) AS deliveryConfirmed,
           (
             SELECT COUNT(*) FROM service_requests sr
             JOIN service_types st ON st.service_type_id = sr.service_type_id
             WHERE sr.aircon_order_item_id = oi.order_item_id
               AND st.service_code = 'installation'
               AND sr.status <> 'CANCELLED'
           ) AS installationBookedCount
         FROM order_items oi
         INNER JOIN orders o ON o.order_id = oi.order_id
         INNER JOIN product_variants v ON v.variant_id = oi.variant_id
         INNER JOIN products p ON p.product_id = v.product_id
         WHERE o.customer_id = ?
           AND o.order_status <> 'CANCELLED'
           ${byItem}
         ORDER BY o.order_id DESC, oi.order_item_id DESC
         LIMIT 100`,
        args,
      );
    },
  };
}
