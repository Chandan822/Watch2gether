import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Lobby from '../pages/Lobby.jsx';
import Room from '../pages/Room.jsx';
import Login from '../pages/Login.jsx';
import Signup from '../pages/Signup.jsx';
import Profile from '../pages/Profile.jsx';

/**
 * Protected Route Wrapper
 * Checks user state from AuthContext. If loading, renders a spinner.
 * If user is not authenticated, redirects them to /login while maintaining
 * the original path history in router state.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-xs font-semibold">Verifying your session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * App Router Component
 */
export const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Forms */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Lobby />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        }
      />

      {/* 404 Fallback */}
      <Route
        path="*"
        element={
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
            <h1 className="text-4xl font-extrabold font-display text-indigo-400 mb-2">404</h1>
            <p className="text-slate-400 text-sm">We couldn&apos;t find the page you are looking for.</p>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
