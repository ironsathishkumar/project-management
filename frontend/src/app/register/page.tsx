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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState('');
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Typography variant="h4">Create your workspace start</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          Register first, then create a workspace from Home.
        </Typography>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError('');
            try {
              await registerUser(values);
            } catch (err) {
              setError(err instanceof ApiClientError ? err.message : 'Unable to register');
            }
          })}
        >
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" fullWidth {...form.register('firstName')} />
              <TextField label="Last name" fullWidth {...form.register('lastName')} />
            </Stack>
            <TextField label="Email" {...form.register('email')} />
            <TextField label="Password" type="password" {...form.register('password')} />
            <Button type="submit" variant="contained" size="large" disabled={form.formState.isSubmitting}>
              Create account
            </Button>
            <Typography variant="body2">
              Already have an account? <Link href="/login">Sign in</Link>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
