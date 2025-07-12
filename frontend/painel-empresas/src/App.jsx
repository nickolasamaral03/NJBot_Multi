// import styled, { createGlobalStyle } from "styled-components"
// import NovaEmpresa from "./components/EmpresaForm"
// import EmpresasList from "./components/EmpresaList"
// import Header from '../src/components/Header'

// const GlobalStyle = createGlobalStyle`
//   html, body, #root {
//     margin: 0;
//     padding: 0;
//     min-height: 100%;
//     background-color:rgba(13, 27, 42, 0.77); /* azul escuro */
//     font-family: sans-serif;
//   }

//   body {
//     background-color: #0d1b2a;
//   }
// `
// const Container = styled.div`
//    min-height: 100%;
//   padding: 20px;
//   display: flex;
//   flex-direction: column;
//   align-items: center;
// `

// const BotaoAtualizar = styled.button`
//   margin-bottom: 1rem;
//   padding: 0.5rem 1rem;
//   background-color: royalblue;
//   color: white;
//   border: none;
//   border-radius: 5px;
//   cursor: pointer;
//   font-weight: bold;
  
//   &:hover {
//     background-color: darkblue;
//   }
// `

// const Image = styled.img`
//   width: 60px;
//   height: 60px;
//   border-radius: 50%;
// `

// function App() {

//   return (
//     <>
//       <GlobalStyle />
//       <Container>
//         <Header/>
//         <NovaEmpresa />
//         <EmpresasList />
//       </Container>
//     </>
//   )
// }

// export default App

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        {/* Adicione outras rotas protegidas aqui, dentro de <PrivateRoute> */}
      </Routes>
    </Router>
  );
}

export default App;

// Rota de login está criada: Agora é conseguir registrar login e depois conseguir fazer a verificação para poder
// entrar no painel da dash
