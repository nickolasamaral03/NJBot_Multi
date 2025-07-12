import api from './api';

export async function login(email, senha) {
  try {
    const res = await api.post('/login', { email, senha });
    localStorage.setItem('token', res.data.token);
    return res.data;
  } catch (err) {
    throw err.response?.data?.erro || 'Erro desconhecido';
  }
}
