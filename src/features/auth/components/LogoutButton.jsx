'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="btn-pro btn-dark"
      style={{
        padding: '8px 18px',
        fontSize: '0.8rem',
        borderRadius: '8px',
        opacity: isLoggingOut ? 0.7 : 1,
      }}
    >
      {isLoggingOut ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
