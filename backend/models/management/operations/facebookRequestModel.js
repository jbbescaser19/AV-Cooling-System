/** Dedicated facebookRequest database queries. */
export function facebookRequestModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];
  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];
  return {
    async listFacebookRequests(staffId) {
      return select(
        `SELECT f.facebook_request_id AS id,f.request_number AS reference,f.request_kind AS requestKind,f.customer_name AS customer,f.contact_number AS phone,f.delivery_address AS address,f.preferred_schedule AS scheduledStart,f.status,f.customer_notes AS notes,f.conversation_url AS conversationUrl,f.service_type_id AS serviceTypeId,f.aircon_brand AS airconBrand,f.aircon_model AS airconModel,f.aircon_horsepower AS airconHp,f.converted_order_id AS convertedOrderId,f.converted_work_order_id AS convertedWorkOrderId,(SELECT w.service_request_id FROM work_orders w WHERE w.work_order_id=f.converted_work_order_id LIMIT 1) AS convertedServiceRequestId,fi.variant_id AS variantId,fi.quantity,st.service_name AS serviceName FROM facebook_order_requests f LEFT JOIN facebook_order_items fi ON fi.facebook_request_id=f.facebook_request_id LEFT JOIN service_types st ON st.service_type_id=f.service_type_id ORDER BY f.facebook_request_id DESC LIMIT 200`,
      );
    },
    createFb(data, staffId, reference) {
      return execute(
        `INSERT INTO facebook_order_requests(request_number,created_by,customer_name,contact_number,delivery_address,preferred_schedule,status,customer_notes,request_kind,service_type_id,conversation_url,aircon_brand,aircon_model,aircon_horsepower) VALUES (?,?,?,?,?,?,'PENDING',?,?,?,?,?,?,?)`,
        [
          reference,
          staffId,
          data.customerName,
          data.contactNumber,
          data.address,
          data.scheduledStart,
          data.notes,
          data.requestKind,
          data.serviceTypeId,
          data.conversationUrl,
          data.requestKind === "SERVICE" ? data.airconBrand || null : null,
          data.requestKind === "SERVICE" ? data.airconModel || null : null,
          data.requestKind === "SERVICE" ? data.airconHp : null,
        ],
      );
    },
    createFbItem(fbId, variantId, quantity) {
      return execute(
        `INSERT INTO facebook_order_items(facebook_request_id,variant_id,quantity) VALUES (?,?,?)`,
        [fbId, variantId, quantity],
      );
    },
    lockFb(id) {
      return select(
        `SELECT f.*,fi.variant_id AS variantId,fi.quantity,st.base_price AS servicePrice FROM facebook_order_requests f LEFT JOIN facebook_order_items fi ON fi.facebook_request_id=f.facebook_request_id LEFT JOIN service_types st ON st.service_type_id=f.service_type_id WHERE f.facebook_request_id=? FOR UPDATE`,
        [id],
      );
    },
    updateFb(id, status, note) {
      return execute(
        `UPDATE facebook_order_requests SET status=?,staff_notes=CONCAT_WS('\n',staff_notes,?),confirmed_at=IF(?='CONFIRMED',CURRENT_TIMESTAMP,confirmed_at) WHERE facebook_request_id=?`,
        [status, note, status, id],
      );
    },
    setFbConverted(id, orderId, workOrderId) {
      return execute(
        `UPDATE facebook_order_requests SET status='CONVERTED',converted_order_id=?,converted_work_order_id=? WHERE facebook_request_id=? AND status='CONFIRMED'`,
        [orderId, workOrderId, id],
      );
    },
  };
}
