import { lazy } from "react"
import { createBrowserRouter } from "react-router"

import { StoreLayout } from "@/components/store/StoreLayout"
import Account from "@/pages/store/Account"
import Checkout from "@/pages/store/Checkout"
import Home from "@/pages/store/Home"
import NotFound from "@/pages/store/NotFound"
import OrderPage from "@/pages/store/OrderPage"
import ProductPage from "@/pages/store/ProductPage"
import Shop from "@/pages/store/Shop"
import Story from "@/pages/store/Story"
import Wishlist from "@/pages/store/Wishlist"

// The admin panel is a separate bundle so shoppers never download it.
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })))
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"))
const AdminOrders = lazy(() => import("@/pages/admin/Orders"))
const AdminDispatch = lazy(() => import("@/pages/admin/Dispatch"))
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"))
const AdminProducts = lazy(() => import("@/pages/admin/Products"))
const AdminCategories = lazy(() => import("@/pages/admin/Categories"))
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"))
const AdminSettings = lazy(() => import("@/pages/admin/Settings"))

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/shop", element: <Shop /> },
      { path: "/shop/:cat", element: <Shop /> },
      { path: "/p/:slug", element: <ProductPage /> },
      { path: "/checkout", element: <Checkout /> },
      { path: "/account", element: <Account /> },
      { path: "/orders/:orderNo", element: <OrderPage /> },
      { path: "/wishlist", element: <Wishlist /> },
      { path: "/story", element: <Story /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "orders", element: <AdminOrders /> },
      { path: "dispatch", element: <AdminDispatch /> },
      { path: "reviews", element: <AdminReviews /> },
      { path: "products", element: <AdminProducts /> },
      { path: "categories", element: <AdminCategories /> },
      { path: "customers", element: <AdminCustomers /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },
])
