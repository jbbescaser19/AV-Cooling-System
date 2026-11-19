import { useEffect, useState } from "react";

import { Wrench } from "lucide-react";

import api from "../../api/api.js";

import { services as originalServices } from "../data/services.js";

import useRealtimeRefresh from "./useRealtimeRefresh.js";

// Local data is used only for visual presentation.
// Names, descriptions and prices always come from MySQL.

const presentation = new Map(
  originalServices.map((service) => [service.id, service]),
);

const displayOrder = new Map(
  originalServices.map((service, index) => [service.id, index]),
);

export default function useServiceCatalog() {
  const [services, setServices] = useState([]);
  const [status, setStatus] = useState("loading");
  const [revision, setRevision] = useState(0);

  useRealtimeRefresh(["catalog", "services"], setRevision);

  useEffect(() => {
    const controller = new AbortController();

    async function loadServices() {
      try {
        const { data } = await api.get("/api/customer/services/types", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!data.success || !Array.isArray(data.services)) {
          throw new Error("Invalid service catalog.");
        }

        const items = data.services.map((row) => {
          const code = String(row.serviceType || "")
            .trim()
            .toLowerCase();

          const design = presentation.get(code);

          return {
            id: String(row.serviceTypeId),
            serviceType: code,

            // Use exactly the information from Management.
            name: row.serviceName,
            desc: row.description ?? "",

            basePrice: row.basePrice == null ? null : Number(row.basePrice),

            // Preserve existing icons and tags.
            icon: design?.icon || Wrench,
            tags: design?.tags || [],

            bookable: /^[a-z][a-z0-9-]{1,39}$/.test(code),
          };
        });

        // Preserve the original Ecommerce display order.
        // Newly added services appear after existing ones.
        items.sort(
          (a, b) =>
            (displayOrder.get(a.serviceType) ?? Number.MAX_SAFE_INTEGER) -
            (displayOrder.get(b.serviceType) ?? Number.MAX_SAFE_INTEGER),
        );

        setServices(items);
        setStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus("error");

          console.error("Unable to load service catalog:", error);
        }
      }
    }

    loadServices();

    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") {
        setRevision((number) => number + 1);
      }
    };

    const timer = window.setInterval(refresh, 10000);

    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);

    window.addEventListener("av-management-updated", refresh);

    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(timer);

      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);

      window.removeEventListener("av-management-updated", refresh);

      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return {
    services,
    status,
  };
}
