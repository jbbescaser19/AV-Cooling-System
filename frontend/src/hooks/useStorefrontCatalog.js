import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";
import { readCatalogProducts } from "../utils/catalogStore.js";

function mergeAvailability(products, stockRows, status) {
  const variants = new Map(
    stockRows.map((row) => [`${row.productId}:${row.hp}`, row]),
  );

  return products.map((product) => ({
    ...product,
    stockStatus: status,
    variants: (product.variants || []).map((variant) => {
      const row = variants.get(`${product.id}:${variant.hp}`);
      return {
        ...variant,
        variantId: row?.variantId ?? null,
        // Unknown stock is NOT treated as in-stock.
        stock: status === "ready" ? (row?.available ?? 0) : null,
        price: row ? row.price : variant.price,
        srp: row ? row.srp : variant.srp,
      };
    }),
  }));
}

/** Shared live-availability hook for Home, Shop, Details, Cart and Checkout. */
export default function useStorefrontCatalog() {
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [catalogRevision, setCatalogRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    api
      .get("/api/catalog/availability", {
        signal: controller.signal,
        params: { _: revision },
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data?.success || !Array.isArray(data.variants)) {
          throw new Error("Invalid availability response.");
        }
        setRows(data.variants);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRows([]);
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    const managementChange = () => {
      setCatalogRevision((n) => n + 1);
      refresh();
    };
    const whenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", whenVisible);
    window.addEventListener("av-management-updated", managementChange);
    const interval = window.setInterval(whenVisible, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", whenVisible);
      window.removeEventListener("av-management-updated", managementChange);
      window.clearInterval(interval);
    };
  }, []);

  const products = useMemo(
    () => mergeAvailability(readCatalogProducts(), rows, status),
    [rows, status, catalogRevision],
  );

  return {
    products,
    status,
    refresh: () => setRevision((n) => n + 1),
  };
}
