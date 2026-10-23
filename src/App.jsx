const DesignPreview = lazy(() => import("./pages/DesignPreview"));
import AppErrorBoundary from "./components/AppErrorBoundary";
import { lazy, Suspense } from "react";
const BusinessWorkspace = lazy(() => import("./business/BusinessWorkspace"));
import { Route, Routes } from "react-router-dom";
const PlatformPayment = lazy(() => import("./pages/PlatformPayment"));
const LandingPage = lazy(() => import("./landing/LandingPage"));
import ProtectedRoute from "./components/ProtectedRoute";
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const CreateWebsite = lazy(() => import("./pages/CreateWebsite"));
const Templates = lazy(() => import("./pages/Templates"));
const WebsiteEditor = lazy(() => import("./pages/WebsiteEditor"));
const PublicStore = lazy(() => import("./PublicStore"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const Terms = lazy(() => import("./pages/Terms"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Customers = lazy(() => import("./pages/Customers"));
const StoreSetup = lazy(() => import("./pages/StoreSetup"));
const StoreDesigner = lazy(() => import("./pages/StoreDesigner"));
const Shipping = lazy(() => import("./pages/Shipping"));
const Settings = lazy(() => import("./pages/Settings"));
const TemplatePreview = lazy(() => import("./pages/TemplatePreview"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
function App() {
  return (
    <AppErrorBoundary><Suspense fallback={<main role="status" style={{ padding: 40 }}>Loading GETCYB…</main>}>
    <Routes>
      {/* Main public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/design-preview" element={<DesignPreview />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/create-website" element={<ProtectedRoute><CreateWebsite /></ProtectedRoute>} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/template-preview/:id" element={<TemplatePreview />} />
      <Route path="/editor" element={<ProtectedRoute><WebsiteEditor /></ProtectedRoute>} />

      {/* Customer store */}
      <Route path="/store/:storeUrl/*" element={<PublicStore />} />
      <Route path="/store/:storeUrl/cart" element={<Cart />} />
      <Route path="/product/:productId" element={<ProductPage />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/platform-payment" element={<PlatformPayment />} />
      <Route path="/order-success" element={<OrderSuccess />} />
      <Route path="/business" element={<ProtectedRoute><BusinessWorkspace /></ProtectedRoute>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      

      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders/:orderId"
        element={
          <ProtectedRoute>
            <OrderDetails />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store-setup"
        element={
          <ProtectedRoute>
            <StoreSetup />
          </ProtectedRoute>
        }
      />

      <Route
        path="/store-designer"
        element={
          <ProtectedRoute>
            <StoreDesigner />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipping"
        element={
          <ProtectedRoute>
            <Shipping />
          </ProtectedRoute>
        }
      />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* Unknown pages return home */}
<Route path="*" element={<h1>Page Not Found</h1>} />
    </Routes>
    </Suspense></AppErrorBoundary>

  );
}

export default App;