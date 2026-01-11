import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layout/AppLayout";
import { AdminDesignsPage } from "@/pages/admin/AdminDesignsPage";
import { AdminTemplatesPage } from "@/pages/admin/AdminTemplatesPage";
import { PageNotFound } from "@/pages/common/PageNotFound";
import { SimLandingPage } from "@/pages/sim/SimLandingPage";
import { SimPage } from "@/pages/sim/SimPage";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <PageNotFound />,
    children: [
      {
        index: true,
        element: <Navigate to="/top" replace />
      },
      {
        path: "top",
        element: <SimLandingPage />
      },
      {
        path: "sim/:templateKey",
        element: <SimPage />
      },
      {
        path: "admin/templates",
        element: <AdminTemplatesPage />
      },
      {
        path: "admin/designs",
        element: <AdminDesignsPage />
      }
    ]
  }
]);
