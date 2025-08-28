'use client';

import { Button } from '../ui/button';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Button 
      variant="ghost" 
      className="w-full justify-start px-2" 
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  );
}
