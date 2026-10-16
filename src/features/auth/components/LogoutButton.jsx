'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPortal } from '@/features/auth/portals';

/**
 * @param {{ portalKey: 'admin' | 'consultant' }} props
 */
export default function LogoutButton({ portalKey }) {
  const router = useRouter();
  const portal = getPortal(portalKey);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch(`/api/auth/${portal.portalKey}/logout`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push(portal.loginPath);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="btn-pro btn-dark"
      suppressHydrationWarning
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
