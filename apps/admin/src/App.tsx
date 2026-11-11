import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { RequireAccess, RequireRole } from './auth/guards'
import Loader from './components/Loader'
import AppLayout from './layout/AppLayout'
import { NAV } from './layout/nav'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SettingsLayout from './features/catalog/SettingsLayout'
import ProductsPage from './features/catalog/ProductsPage'
import CategoriesPage from './features/catalog/CategoriesPage'
import SuppliersPage from './features/catalog/SuppliersPage'
import StockPage from './features/stock/StockPage'
import StockCountPage from './features/stock/StockCountPage'
import PurchasesPage from './features/purchases/PurchasesPage'
import SalesPage from './features/sales/SalesPage'
import SaleFormPage from './features/sales/SaleFormPage'
import DebtorsPage from './features/debtors/DebtorsPage'
import CustomersPage from './features/customers/CustomersPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

const ownerOnly = NAV.filter((n) => n.roles.length === 1 && n.to !== '/settings')
const built = new Set(['/', '/stock', '/purchases', '/sales', '/debtors', '/customers'])
const everyone = NAV.filter((n) => n.roles.length > 1 && !built.has(n.to))

export default function App() {
  const { loading } = useAuth()

  return (
    <>
      <Loader ready={!loading} />
      {!loading && (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAccess />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/stock/count" element={<StockCountPage />} />
              <Route path="/purchases" element={<PurchasesPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales/new" element={<SaleFormPage />} />
              <Route path="/debtors" element={<DebtorsPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              {everyone.map((n) => (
                <Route key={n.to} path={n.to} element={<PlaceholderPage title={n.label} description={n.description} />} />
              ))}
              <Route element={<RequireRole roles={['owner']} />}>
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="products" replace />} />
                  <Route path="products" element={<ProductsPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="suppliers" element={<SuppliersPage />} />
                </Route>
                {ownerOnly.map((n) => (
                  <Route key={n.to} path={n.to} element={<PlaceholderPage title={n.label} description={n.description} />} />
                ))}
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      )}
    </>
  )
}
