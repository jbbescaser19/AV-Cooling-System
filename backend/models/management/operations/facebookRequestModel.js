/** Dedicated Facebook agreement database queries. */

export function facebookRequestModel(db) {
  const select = async (sql, values = []) => (await db.execute(sql, values))[0];

  const execute = async (sql, values = []) =>
    (await db.execute(sql, values))[0];

  return {
    async convertedReference(kind, id) {
      const sql =
        kind === "ORDER"
          ? `SELECT CONCAT(
               'AV-',YEAR(ordered_at),'-',
               LPAD(
                 CAST(order_id AS CHAR),
                 GREATEST(6,CHAR_LENGTH(CAST(order_id AS CHAR))),
                 '0'
               )
             ) AS reference
             FROM orders
             WHERE order_id=?`
          : `SELECT CONCAT(
               'AV-S-',YEAR(created_at),'-',
               LPAD(
                 CAST(service_request_id AS CHAR),
                 GREATEST(6,CHAR_LENGTH(CAST(service_request_id AS CHAR))),
                 '0'
               )
             ) AS reference
             FROM service_requests
             WHERE service_request_id=?`;

      return (await select(sql, [id]))[0]?.reference || null;
    },

    async listFacebookRequests(staffId) {
      return select(`
        SELECT
          f.facebook_request_id AS id,
          f.request_number AS reference,

          CONCAT(
            'AV-F-',YEAR(f.created_at),'-',
            CASE
              WHEN f.facebook_request_id<1000000
              THEN LPAD(f.facebook_request_id,6,'0')
              ELSE CAST(f.facebook_request_id AS CHAR)
            END
          ) AS displayReference,

          f.request_kind AS requestKind,
          f.customer_name AS customer,
          f.contact_number AS phone,
          f.delivery_address AS address,

          f.delivery_area_code AS deliveryArea,
          f.quoted_delivery_fee AS deliveryFee,
          f.delivery_fee_reason AS deliveryFeeReason,

          f.destination_address AS destinationAddress,
          f.facebook_account AS facebookAccount,
          f.preferred_schedule AS scheduledStart,
          f.status,
          f.customer_notes AS notes,
          f.staff_notes AS staffNotes,
          f.conversation_url AS conversationUrl,
          f.service_type_id AS serviceTypeId,
          f.aircon_brand AS airconBrand,

          CASE
            WHEN f.request_kind='AIRCON'
            THEN CONCAT(
              p.brand,' ',p.model,' · ',v.horsepower,' HP'
            )
            ELSE f.aircon_model
          END AS airconModel,

          f.aircon_horsepower AS airconHp,
          f.converted_order_id AS convertedOrderId,
          f.converted_work_order_id AS convertedWorkOrderId,

          (
            SELECT w.service_request_id
            FROM work_orders w
            WHERE w.work_order_id=f.converted_work_order_id
            LIMIT 1
          ) AS convertedServiceRequestId,

          fi.variant_id AS variantId,
          fi.quantity,
          st.service_name AS serviceName

        FROM facebook_order_requests f

        LEFT JOIN facebook_order_items fi
          ON fi.facebook_request_id=f.facebook_request_id

        LEFT JOIN service_types st
          ON st.service_type_id=f.service_type_id

        LEFT JOIN product_variants v
          ON v.variant_id=fi.variant_id

        LEFT JOIN products p
          ON p.product_id=v.product_id

        ORDER BY f.facebook_request_id DESC
        LIMIT 200
      `);
    },

    createFb(data, staffId, reference) {
      return execute(
        `INSERT INTO facebook_order_requests (
           request_number,
           created_by,
           customer_name,
           contact_number,
           facebook_account,
           delivery_address,
           destination_address,
           preferred_schedule,
           status,
           customer_notes,
           request_kind,
           service_type_id,
           conversation_url,
           aircon_brand,
           aircon_model,
           aircon_horsepower
         )
         VALUES (?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?,?,?)`,
        [
          reference,
          staffId,
          data.customerName,
          data.contactNumber,
          data.facebookAccount,
          data.address,
          data.destinationAddress || null,
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

    saveFbDeliveryQuote(id, quote) {
      return execute(
        `UPDATE facebook_order_requests
         SET delivery_address=?,
             delivery_area_code=?,
             quoted_delivery_fee=?,
             delivery_fee_reason=?
         WHERE facebook_request_id=?
           AND request_kind='AIRCON'`,
        [quote.address, quote.area, quote.fee.toFixed(2), quote.reason, id],
      );
    },

    async lockSellableVariant(id) {
      const [rows] = await db.execute(
        `SELECT
           v.variant_id AS id,

           GREATEST(
             0,
             COALESCE(i.on_hand_quantity,0) -
             COALESCE(i.reserved_quantity,0)
           ) AS available

         FROM product_variants v

         JOIN products p
           ON p.product_id=v.product_id

         LEFT JOIN inventory i
           ON i.variant_id=v.variant_id

         WHERE v.variant_id=?
           AND v.status='ACTIVE'
           AND p.status='ACTIVE'

         FOR UPDATE`,
        [id],
      );

      return rows[0] || null;
    },

    async lockFbServiceType(serviceTypeId) {
      return select(
        `SELECT
           service_type_id,
           service_code,
           service_name,
           base_price,
           status

         FROM service_types
         WHERE service_type_id=?
         FOR UPDATE`,
        [serviceTypeId],
      );
    },

    fbCreateServiceRequest(fb, serviceType, schedule) {
      return execute(
        `INSERT INTO service_requests (
           customer_id,
           service_type_id,
           service_price,
           preferred_start,
           contact_number,
           service_address,
           destination_address,
           status,
           facebook_request_id,
           aircon_source,
           aircon_brand,
           aircon_model,
           aircon_horsepower,
           walk_in_customer_name,
           customer_notes
         )
         VALUES (
           ?,?,?,?,?,?,?,
           'CONFIRMED',?,
           'CUSTOMER_OWNED',
           ?,?,?,?,?
         )`,
        [
          fb.customer_id || null,
          serviceType.service_type_id,
          serviceType.base_price,
          schedule,
          fb.contact_number,
          fb.delivery_address,
          fb.destination_address || null,
          fb.facebook_request_id,
          fb.aircon_brand,
          fb.aircon_model,
          fb.aircon_horsepower,
          fb.customer_name,
          fb.customer_notes || null,
        ],
      );
    },

    createFbItem(fbId, variantId, quantity) {
      return execute(
        `INSERT INTO facebook_order_items (
           facebook_request_id,
           variant_id,
           quantity
         )
         VALUES (?,?,?)`,
        [fbId, variantId, quantity],
      );
    },

    lockFb(id) {
      return select(
        `SELECT
           f.*,
           fi.variant_id AS variantId,
           fi.quantity,
           st.base_price AS servicePrice

         FROM facebook_order_requests f

         LEFT JOIN facebook_order_items fi
           ON fi.facebook_request_id=f.facebook_request_id

         LEFT JOIN service_types st
           ON st.service_type_id=f.service_type_id

         WHERE f.facebook_request_id=?
         FOR UPDATE`,
        [id],
      );
    },

    updateFb(id, status, note) {
      return execute(
        `UPDATE facebook_order_requests
         SET status=?,
             staff_notes=CONCAT_WS('\\n',staff_notes,?),
             confirmed_at=IF(
               ?='CONFIRMED',
               CURRENT_TIMESTAMP,
               confirmed_at
             )
         WHERE facebook_request_id=?`,
        [status, note, status, id],
      );
    },

    setFbConverted(id, orderId, workOrderId) {
      return execute(
        `UPDATE facebook_order_requests
         SET status='CONVERTED',
             converted_order_id=?,
             converted_work_order_id=?
         WHERE facebook_request_id=?
           AND status='CONFIRMED'`,
        [orderId, workOrderId, id],
      );
    },
  };
}
