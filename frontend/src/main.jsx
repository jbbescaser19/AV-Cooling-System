import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import "./styles/variables.css";
import "./styles/global.css";
import "./styles/ecommerce/pages.css";

/*
  Vite automatically gives us:

  Development:
  /

  Production:
  /AV-Cooling-System/
*/
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
