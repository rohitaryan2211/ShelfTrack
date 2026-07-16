import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './routes/HomePage'
import LoginPage from './routes/LoginPage'
import DiscoverPage from './routes/DiscoverPage'
import PublishersPage from './routes/PublishersPage'
import PublisherDetailPage from './routes/PublisherDetailPage'
import SeriesDetailPage from './routes/SeriesDetailPage'
import VolumeDetailPage from './routes/VolumeDetailPage'
import SearchPage from './routes/SearchPage'
import LibraryPage from './routes/LibraryPage'
import ProfilePage from './routes/ProfilePage'
import SettingsPage from './routes/SettingsPage'
import AdminIngestPage from './routes/AdminIngestPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout>
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

            {/* Auth-required routes */}
            <Route path="/library"             element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
            <Route path="/profile"             element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings"            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/admin/ingest"        element={<ProtectedRoute><AdminIngestPage /></ProtectedRoute>} />
          </Routes>
        </AppLayout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
