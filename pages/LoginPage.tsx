
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ username: email.split('@')[0], email });
    navigate('/');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 theme-bg-main">
      <div className="w-full max-w-md theme-bg-surface border theme-border rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 theme-accent-bg text-white rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl mb-4 shadow-xl">API</div>
          <h2 className="text-3xl font-bold">Welcome back</h2>
          <p className="theme-text-secondary mt-2">Sign in to your APITest Pro account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">Email address</label>
            <input 
              type="email" 
              required
              placeholder="admin@example.com"
              className="w-full theme-bg-main border theme-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all theme-text-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">Password</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full theme-bg-main border theme-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all theme-text-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full theme-accent-bg hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
            Sign In
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm theme-text-secondary">
          Don't have an account? <Link to="/register" className="theme-accent-text font-medium hover:underline">Sign up for free</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
