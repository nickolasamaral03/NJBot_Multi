import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import  { createGlobalStyle } from 'styled-components';

 const GlobalStyle = createGlobalStyle`
      html, body, #root {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background-color:rgba(13, 27, 42, 0.77); /* azul escuro */
        font-family: sans-serif;
      }
    
      body {
        background-color: #0d1b2a;
      }
    `

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <><GlobalStyle /><Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute>
          <Dashboard />
        </PrivateRoute>} />
      </Routes>
    </Router></>
  );
}

export default App;
