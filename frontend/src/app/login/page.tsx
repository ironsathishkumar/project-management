'use client';

import { useAuth } from '@/providers/AuthProvider';
import { ApiClientError } from '@/lib/api';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: 'owner@tracker.local', password: 'ChangeMe123!' } });

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 440 }}>
        <Typography variant="h4">Welcome back</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Sign in to continue planning and tracking work.
        </Typography>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError('');
            try {
              await login(values.email, values.password);
            } catch (err) {
              setError(err instanceof ApiClientError ? err.message : 'Unable to sign in');
            }
          })}
        >
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" {...form.register('email')} />
            <TextField label="Password" type="password" {...form.register('password')} />
            <Button type="submit" variant="contained" size="large" disabled={form.formState.isSubmitting}>
              Sign in
            </Button>
            <Typography variant="body2">
              New here? <Link href="/register">Create an account</Link>
            </Typography>
            <Alert severity="info">Demo owner: owner@tracker.local / ChangeMe123!</Alert>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
