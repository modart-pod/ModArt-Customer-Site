import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { CurrencyProvider } from './context/CurrencyContext';

// Layouts
import CustomerLayout from './layouts/CustomerLayout';

// Pages
import Home        from './pages/Home';
import Shop        from './pages/Shop';
import Product     from './pages/Product';
import Customize   from './pages/Customize';
import Bag         from './pages/Bag';
import Checkout    from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import Orders      from './pages/Orders';
import Account     from './pages/Account';
import Wishlist    from './pages/Wishlist';
import Community   from './pages/Community';
import Login       from './pages/Login';
import Register    from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Contact     from './pages/Contact';
import About       from './pages/About';
import FAQ         from './pages/FAQ';
import Privacy     from './pages/Privacy';
import Terms       from './pages/Terms';
import NotFound    from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <CartProvider>
            <Routes>
              <Route element={<CustomerLayout />}>
                <Route path="/"            element={<Home />} />
                <Route path="/shop"        element={<Shop />} />
                <Route path="/product/:id" element={<Product />} />
                <Route path="/customize"   element={<Customize />} />
                <Route path="/bag"         element={<Bag />} />
                <Route path="/checkout"    element={<Checkout />} />
                <Route path="/confirmation" element={<Confirmation />} />
                <Route path="/orders"      element={<Orders />} />
                <Route path="/account"     element={<Account />} />
                <Route path="/wishlist"    element={<Wishlist />} />
                <Route path="/community"   element={<Community />} />
                <Route path="/login"       element={<Login />} />
                <Route path="/register"    element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/contact"     element={<Contact />} />
                <Route path="/about"       element={<About />} />
                <Route path="/faq"         element={<FAQ />} />
                <Route path="/privacy"     element={<Privacy />} />
                <Route path="/terms"       element={<Terms />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
