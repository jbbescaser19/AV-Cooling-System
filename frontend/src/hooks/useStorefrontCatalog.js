import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import api from "../../api/api.js";

import { readCatalogProducts } from "../utils/catalogStore.js";

function mergeAvailability(products, stockRows, status) {
  const availableByVariant = new Map(
    stockRows.map((row) => [`${row.productId}:${row.hp}`, row]),
  );

  return products.map((product) => ({
    ...product,
    stockStatus: status,

    variants: (product.variants || []).map((variant) => {
      const row = availableByVariant.get(`${product.id}:${variant.hp}`);

      return {
        ...variant,

        variantId: row?.variantId ?? null,

        // Never assume stock is available when
        // the server cannot verify it.
        stock: status === "ready" ? (row?.available ?? 0) : null,

        price: row?.price ?? variant.price,

        srp: row?.srp ?? variant.srp,
      };
    }),
  }));
}

/**
 * Shared product availability hook.
 *
 * Used by:
 * Home, Shop, Product Details, Cart, Checkout.
 *
 * Background refreshes should not make
 * an already loaded page flash or disappear.
 */
export default function useStorefrontCatalog() {
  const [revision, setRevision] = useState(0);

  const [rows, setRows] = useState([]);

  const [status, setStatus] = useState("loading");

  const [catalogRevision, setCatalogRevision] = useState(0);

  const refreshTimer = useRef(null);

  const refresh = useCallback(() => {
    if (refreshTimer.current !== null) {
      return;
    }

    // Combine requests triggered close together
    // by SSE, focus, and visibility changes.
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;

      setRevision((number) => number + 1);
    }, 200);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Do not switch back to "loading" here.
    // Keep existing products visible.

    api
      .get("/api/catalog/availability", {
        signal: controller.signal,
        params: {
          _: revision,
        },
      })
      .then(({ data }) => {
        if (controller.signal.aborted) {
          return;
        }

        if (!data?.success || !Array.isArray(data.variants)) {
          throw new Error("Invalid availability response.");
        }

        setRows(data.variants);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        // Do not erase the previous product list.
        // However, block purchasing until stock
        // can be verified again.
        setStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [revision]);

  useEffect(() => {
    const whenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const onManagementChange = () => {
      setCatalogRevision((number) => number + 1);

      refresh();
    };

    const onRealtimeChange = (event) => {
      const topics = event?.detail?.topics;

      if (
        Array.isArray(topics) &&
        (topics.includes("inventory") || topics.includes("catalog"))
      ) {
        setCatalogRevision((number) => number + 1);

        refresh();
      }
    };

    window.addEventListener("focus", refresh);

    document.addEventListener("visibilitychange", whenVisible);

    window.addEventListener("av-management-updated", onManagementChange);

    window.addEventListener("av-realtime-change", onRealtimeChange);

    const interval = window.setInterval(whenVisible, 60000);

    return () => {
      window.removeEventListener("focus", refresh);

      document.removeEventListener("visibilitychange", whenVisible);

      window.removeEventListener("av-management-updated", onManagementChange);

      window.removeEventListener("av-realtime-change", onRealtimeChange);

      window.clearInterval(interval);

      if (refreshTimer.current !== null) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [refresh]);

  const products = useMemo(
    () => mergeAvailability(readCatalogProducts(), rows, status),
    [rows, status, catalogRevision],
  );

  return {
    products,
    status,
    refresh,
  };
}
