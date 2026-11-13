import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import GlobalConfirmDialog from "./components/common/GlobalConfirmDialog.jsx";

import "./styles/variables.css";
import "./styles/global.css";
import "./styles/ecommerce/pages.css";
import "./styles/shared/action-buttons.css";
import "./styles/management/notification-technician-compact.css";
import "./styles/management/mobile-density.css";
import "./styles/management/desktop-layout-on-mobile.css";
import "./styles/management/all-columns-mobile.css";
import "./styles/shared/management-control-consistency.css";

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <App />
      <GlobalConfirmDialog />
    </BrowserRouter>
  </React.StrictMode>,
);
