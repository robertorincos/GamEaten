import './App.scss'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api/auth';
import SignInSide from './pages/Login/Sign-In/SignInSide';
import SignUp from './pages/Login/Sign-Up/SignUp';
import HomePage from './pages/Home/Home-Page/HomePage';
import Game from './pages/Game/Game';
import ProfilePage from './pages/Home/Profile/profile';
import GameGiveaways from './pages/GameGiveaways/GameGiveaways';

// Define props interface for ProtectedRoute
interface ProtectedRouteProps {
  children: React.ReactNode;
}

// ProtectedRoute component
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignInSide />} />
        <Route path="/signup" element={<SignUp />} />
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/giveaways" 
          element={
            <ProtectedRoute>
              <GameGiveaways />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/game/:id" 
          element={
            <ProtectedRoute>
              <Game />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/user/:username" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
