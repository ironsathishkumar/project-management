'use client';

import { isWorkspaceAdmin } from '@/lib/permissions';
import { useAuth } from '@/providers/AuthProvider';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

/** Blocks non-admin users from admin-only pages. */
export function RequireAdmin({
  children,
  fallbackHref = '/projects',
}: {
  children: ReactNode;
  fallbackHref?: string;
}) {
  const { user, workspace, loading } = useAuth();
  const router = useRouter();
  const isAdmin = isWorkspaceAdmin(user, workspace?.id);

  useEffect(() => {
    if (loading || !user) return;
    if (!isAdmin) router.replace(fallbackHref);
  }, [loading, user, isAdmin, router, fallbackHref]);

  if (loading || !user) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
        <Typography color="text.secondary">Redirecting…</Typography>
      </Box>
    );
  }

  return <>{children}</>;
}
