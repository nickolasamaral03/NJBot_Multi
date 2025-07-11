import { useState } from 'react';
import { login } from '../services/loginService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, senha);
      window.location.href = '/painel';
    } catch (errMsg) {
      setErro(errMsg);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha" required />
      <button type="submit">Entrar</button>
      {erro && <p>{erro}</p>}
    </form>
  );
}
