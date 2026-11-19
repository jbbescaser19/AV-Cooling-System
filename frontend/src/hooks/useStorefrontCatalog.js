import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import api from "../../api/api.js";

import { products as seedProducts } from "../data/products.js";

const presentations = new Map(
  seedProducts.map((product) => [product.id, product]),
);

// Keep the most recent verified catalog while navigating.
let lastCatalog = null;

function buildCatalog(snapshot, status) {
  // Preserve the original store display when the
  // API has not returned a verified catalog yet.
  if (!snapshot) {
    return seedProducts.map((product) => ({
      ...product,

      stockStatus: status,

      variants: product.variants.map((variant) => ({
        ...variant,
        variantId: null,
        stock: null,
      })),
    }));
  }

  const byProduct = new Map();

  for (const row of snapshot.variants) {
    const id = String(row.productId);

    if (!byProduct.has(id)) {
      byProduct.set(id, []);
    }

    byProduct.get(id).push({
      variantId: Number(row.variantId),

      hp: row.hp,

      srp: Number(row.srp),

      price: Number(row.price),

      stock:
        status === "ready" ? Math.max(0, Number(row.available) || 0) : null,
    });
  }

  return snapshot.products.map((record) => {
    const id = String(record.id);

    const original = presentations.get(id) || {};

    const variants = byProduct.get(id) || [];

    return {
      // Preserve original presentation information.
      ...original,

      // Management remains authoritative for product
      // names, brands, models, and categories.
      ...record,

      id,

      tagline: original.tagline || `${record.brand} · ${record.category}`,

      warranty: original.warranty || [],

      inclusions: original.inclusions || [],

      additionalCharges: original.additionalCharges || [],

      quotationOnly: Boolean(original.quotationOnly) || !variants.length,

      stockStatus: status,

      variants,
    };
  });
}

/**
 * Shared live catalog for Home, Shop, Product Details,
 * Cart and Checkout.
 */
export default function useStorefrontCatalog() {
  const [snapshot, setSnapshot] = useState(lastCatalog);

  const [status, setStatus] = useState("loading");

  const [revision, setRevision] = useState(0);

  const refreshTimer = useRef(null);

  const refresh = useCallback(() => {
    if (refreshTimer.current !== null) {
      return;
    }

    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;

      setRevision((number) => number + 1);
    }, 200);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/catalog/availability", {
        signal: controller.signal,

        params: {
          _: revision,
        },
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;

        if (
          !data?.success ||
          !Array.isArray(data.products) ||
          !Array.isArray(data.variants)
        ) {
          throw new Error("Invalid catalog availability response.");
        }

        const next = {
          products: data.products,
          variants: data.variants,
        };

        lastCatalog = next;

        setSnapshot(next);
        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        // Do not remove existing products when
        // the server is temporarily unavailable.
        setStatus("error");

        console.error("Unable to verify storefront catalog:", error);
      });

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const whenVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const onRealtimeChange = (event) => {
      const topics = event?.detail?.topics;

      if (
        Array.isArray(topics) &&
        (topics.includes("catalog") ||
          topics.includes("inventory") ||
          topics.includes("archive"))
      ) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);

    window.addEventListener("online", refresh);

    window.addEventListener("av-management-updated", refresh);

    window.addEventListener("av-realtime-change", onRealtimeChange);

    document.addEventListener("visibilitychange", whenVisible);

    const interval = window.setInterval(whenVisible, 10000);

    return () => {
      window.removeEventListener("focus", refresh);

      window.removeEventListener("online", refresh);

      window.removeEventListener("av-management-updated", refresh);

      window.removeEventListener("av-realtime-change", onRealtimeChange);

      document.removeEventListener("visibilitychange", whenVisible);

      window.clearInterval(interval);

      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);

        refreshTimer.current = null;
      }
    };
  }, [refresh]);

  const products = useMemo(
    () => buildCatalog(snapshot, status),
    [snapshot, status],
  );

  return {
    products,
    status,
    refresh,
  };
}
