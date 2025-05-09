import './App.scss'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignUp from './pages/Login/Sign-Up/SignUp';
import SignInSide from './pages/Login/Sign-In/SignInSide';
import HomePage from './pages/Home/Home-Page/HomePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<SignInSide />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/" element={<SignInSide />} />
      </Routes>
    </Router>
  );
}

export default App;
