import './App.scss'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api/auth';
import SignInSide from './pages/Login/Sign-In/SignInSide';
import SignUp from './pages/Login/Sign-Up/SignUp';
import HomePage from './pages/Home/Home-Page/HomePage';

// Define props interface for ProtectedRoute
interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Protected route component with proper typing
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  return isAuthenticated() ? children : <Navigate to="/" />;
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
