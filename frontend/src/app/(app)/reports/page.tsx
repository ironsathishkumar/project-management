'use client';

import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { useMembers, useReports } from '@/hooks/useApi';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ReportsContent() {
  const reports = useReports();
  const members = useMembers();
  const data = reports.data;
  const workload = (data?.workload ?? []).map((item) => {
    const member = members.data?.find((entry) => entry.userId === item.assigneeId);
    return {
      name: item.assigneeId === 'unassigned' ? 'Unassigned' : member?.user ? member.user.firstName : 'Member',
      count: item.count,
    };
  });

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Reports</Typography>
        <Typography color="text.secondary">Admin-only · progress, workload, and distribution.</Typography>
      </div>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        {[
          ['Projects', data?.totals.projects],
          ['Tasks', data?.totals.tasks],
          ['Completed', data?.totals.completed],
          ['Overdue', data?.totals.overdue],
        ].map(([label, value]) => (
          <Card key={String(label)} sx={{ flex: 1 }}>
            <CardContent>
              <Typography color="text.secondary">{label}</Typography>
              <Typography variant="h3">{value ?? 0}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Card sx={{ flex: 1, minHeight: 320 }}>
          <CardContent>
            <Typography variant="h6">Status distribution</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data?.statusDistribution ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                  {(data?.statusDistribution ?? []).map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={['#1F4E79', '#0F766E', '#C2410C', '#7C3AED', '#15803D', '#64748B'][index % 6]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, minHeight: 320 }}>
          <CardContent>
            <Typography variant="h6">Team workload</Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1F4E79" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}

export default function ReportsPage() {
  return (
    <RequireAdmin>
      <ReportsContent />
    </RequireAdmin>
  );
}
