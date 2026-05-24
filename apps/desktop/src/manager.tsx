import React from "react";
import ReactDOM from "react-dom/client";
import { ManagerApp } from "./manager/ManagerApp";
import "./ui/manager.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ManagerApp />
  </React.StrictMode>,
);
