// import axios from 'axios';

// export default axios.create({
//   baseURL: 'http://localhost:3000/api'
// });


import axios from 'axios';

// Cria uma instância customizada do axios
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000, // 10 segundos de timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor para adicionar token de autenticação (se necessário)
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Interceptor para tratamento global de erros
api.interceptors.response.use(response => {
  return response;
}, error => {
  // Tratamento personalizado para diferentes códigos de status
  if (error.response) {
    switch (error.response.status) {
      case 401:
        console.error('Não autorizado - redirecionar para login');
        break;
      case 404:
        console.error('Endpoint não encontrado');
        break;
      case 500:
        console.error('Erro interno do servidor');
        break;
      default:
        console.error('Erro na requisição:', error.message);
    }
  } else if (error.request) {
    console.error('Sem resposta do servidor');
  } else {
    console.error('Erro ao configurar a requisição:', error.message);
  }
  
  return Promise.reject(error);
});

export default api;