import { Route, Routes } from "react-router-dom";
import PlatformPayment from "./pages/PlatformPayment";
import LandingPage from "./landing/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreateWebsite from "./pages/CreateWebsite";
import Templates from "./pages/Templates";
import WebsiteEditor from "./pages/WebsiteEditor";
import PublicStore from "./PublicStore";
import ProductPage from "./pages/ProductPage";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import OrderSuccess from "./pages/OrderSuccess";
import Terms from "./pages/Terms";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Customers from "./pages/Customers";
import StoreSetup from "./pages/StoreSetup";
import StoreDesigner from "./pages/StoreDesigner";
import Shipping from "./pages/Shipping";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      {/* Main public pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/create-website" element={<CreateWebsite />} />
      <Route path="/templates" element={<Templates />} />
      <Route path="/editor" element={<WebsiteEditor />} />

      {/* Customer store */}
      <Route path="/store/:storeUrl" element={<PublicStore />} />
      <Route path="/store/:storeUrl/cart" element={<Cart />} />
      <Route path="/product/:productId" element={<ProductPage />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/platform-payment" element={<PlatformPayment />} />
      <Route path="/order-success" element={<OrderSuccess />} />

      {/* Business dashboard */}
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
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

export default App;