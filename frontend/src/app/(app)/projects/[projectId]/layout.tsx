'use client';

import { useNavigation, useProject } from '@/hooks/useApi';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ReactNode, useMemo } from 'react';

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const project = useProject(params.projectId);
  const navigation = useNavigation(params.projectId);

  const tabs = useMemo(
    () => [...(navigation.data?.project ?? [])].sort((a, b) => a.order - b.order),
    [navigation.data?.project]
  );

  const active =
    tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))?.key ??
    tabs[0]?.key ??
    'board';
  const isImmersive = active === 'board' || active === 'backlog';

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        px: { xs: 2, md: 3 },
        pt: 2,
        pb: isImmersive ? 0 : 2,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ flexShrink: 0, mb: 1.5 }}
      >
        <Box>
          <Typography variant="overline">{project.data?.key}</Typography>
          <Typography variant="h5">{project.data?.name ?? 'Project'}</Typography>
        </Box>
      </Stack>

      <Tabs
        value={active}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ flexShrink: 0, minHeight: 42, mb: 1.5, borderBottom: '1px solid #E7E0D6' }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            component={Link}
            href={tab.href}
            sx={{ minHeight: 42 }}
          />
        ))}
      </Tabs>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: isImmersive ? 'hidden' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
