
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from '../types';

interface RegisterPageProps {
  onLogin: (user: User) => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ username, email });
    navigate('/');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 theme-bg-main">
      <div className="w-full max-w-md theme-bg-surface border theme-border rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 theme-accent-bg text-white rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl mb-4 shadow-xl">API</div>
          <h2 className="text-3xl font-bold">Create account</h2>
          <p className="theme-text-secondary mt-2">Start automating your API tests today</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">Username</label>
            <input 
              type="text" 
              required
              className="w-full theme-bg-main border theme-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all theme-text-primary"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">Email address</label>
            <input 
              type="email" 
              required
              className="w-full theme-bg-main border theme-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all theme-text-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full theme-bg-main border theme-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all theme-text-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full theme-accent-bg hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 mt-4">
            Create Free Account
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm theme-text-secondary">
          Already have an account? <Link to="/login" className="theme-accent-text font-medium hover:underline">Log in</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
