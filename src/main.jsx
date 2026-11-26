import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { registerHit } from "./hits.js";
import "./index.css";

registerHit();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);