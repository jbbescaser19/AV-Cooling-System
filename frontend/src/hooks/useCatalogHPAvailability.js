import { useEffect, useMemo, useState } from "react";
import api from "../../api/api.js";
import useRealtimeRefresh from "./useRealtimeRefresh.js";
import { catalogHPOptionsFromVariants } from "../utils/heatLoadEstimate.js";

/**
 * Shared, read-only product-capacity source for Shop, My Account and Management.
 * The existing public endpoint returns ACTIVE catalog variants with live stock.
 * No local hard-coded product-size list or new backend route is needed.
 */
export default function useCatalogHPAvailability() {
  const [variants, setVariants] = useState([]);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);

  useRealtimeRefresh(["catalog", "inventory"], setRevision);

  useEffect(() => {
    const controller = new AbortController();
    // Keep existing options while silently revalidating.
    api
      .get("/api/catalog/availability", {
        signal: controller.signal,
        params: { _: revision },
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!data?.success || !Array.isArray(data.variants)) {
          throw new Error("Invalid catalog availability response.");
        }
        setVariants(data.variants);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        // Keep the last options visible, but report failed verification.
        setStatus("error");
      });

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const refresh = () => setRevision((old) => old + 1);
    window.addEventListener("av-management-updated", refresh);
    return () => {
      window.removeEventListener("av-management-updated", refresh);
    };
  }, []);

  const options = useMemo(
    () => catalogHPOptionsFromVariants(variants),
    [variants],
  );

  return {
    options,
    status,
    refresh: () => setRevision((old) => old + 1),
  };
}
