import React from "react";
import ReactDOM from "react-dom/client";
import { Surface } from "./core/Surface";
import "./ui/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Surface />
  </React.StrictMode>,
);
