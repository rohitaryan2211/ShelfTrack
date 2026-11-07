import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthProvider'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './routes/HomePage'

// Every route except the landing page is split into its own chunk.
const LoginPage = lazy(() => import('./routes/auth/LoginPage'))
const SettingsPage = lazy(() => import('./routes/auth/SettingsPage'))
const DiscoverPage = lazy(() => import('./routes/catalog/DiscoverPage'))
const PublishersPage = lazy(() => import('./routes/catalog/PublishersPage'))
const PublisherDetailPage = lazy(() => import('./routes/catalog/PublisherDetailPage'))
const SearchPage = lazy(() => import('./routes/catalog/SearchPage'))
const CatalogStatusPage = lazy(() => import('./routes/catalog/CatalogStatusPage'))
const SeriesDetailPage = lazy(() => import('./routes/series/SeriesDetailPage'))
const VolumeDetailPage = lazy(() => import('./routes/volume/VolumeDetailPage'))
const LibraryPage = lazy(() => import('./routes/library/LibraryPage'))
const ProfilePage = lazy(() => import('./routes/profile/ProfilePage'))
const NotFoundPage = lazy(() => import('./routes/NotFoundPage'))

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" aria-label="Loading" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/"                    element={<HomePage />} />
              <Route path="/login"               element={<LoginPage />} />
              <Route path="/discover"            element={<DiscoverPage />} />
              <Route path="/publishers"          element={<PublishersPage />} />
              <Route path="/publishers/:id"      element={<PublisherDetailPage />} />
              <Route path="/series/:id"          element={<SeriesDetailPage />} />
              <Route path="/volumes/:id"         element={<VolumeDetailPage />} />
              <Route path="/search"              element={<SearchPage />} />
              <Route path="/profile/:username"   element={<ProfilePage />} />
              <Route path="/catalog-status"      element={<CatalogStatusPage />} />
              <Route path="/admin/ingest"        element={<Navigate to="/catalog-status" replace />} />

              {/* Auth-required routes */}
              <Route path="/library"             element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
              <Route path="/profile"             element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/settings"            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="*"                    element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
