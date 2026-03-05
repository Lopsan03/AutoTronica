import React, { useState } from 'react';
import Button from './Button';

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const expectedUsername = import.meta.env.VITE_ADMIN_USERNAME;
  const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isConfigMissing = !expectedUsername || !expectedPassword;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isConfigMissing) {
      setError('Falta configuración de administrador en variables de entorno.');
      return;
    }

    const normalizedUsername = username.trim().toUpperCase();
    if (normalizedUsername === expectedUsername.trim().toUpperCase() && password === expectedPassword) {
      setError('');
      onLogin();
      return;
    }

    setError('Usuario o contraseña incorrectos.');
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Acceso Administrador</h1>
        <p className="mt-1 text-sm text-gray-600">Inicia sesión para gestionar el catálogo de servicios.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Usuario
            <input
              required
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="LOPSAN"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Contraseña
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {isConfigMissing && (
            <p className="text-sm text-red-700">
              Define `VITE_ADMIN_USERNAME` y `VITE_ADMIN_PASSWORD` en tu entorno.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={() => (window.location.href = '/')}>
              Volver
            </Button>
            <Button type="submit" fullWidth>
              Ingresar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
