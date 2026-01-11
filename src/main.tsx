import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { appRouter } from "./app/router";
import { seedIfEmpty } from "./domain/seed/seedData";
import { migrateLegacyText } from "./storage/local";
import { saveAutoBackup } from "./storage/backup";
import "./styles/global.css";

migrateLegacyText();
seedIfEmpty("ifEmpty");
saveAutoBackup();

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={appRouter} />
  </React.StrictMode>
);
