'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Sprint planning lives on the Backlog (Jira-style). Keep this route as a redirect. */
export default function SprintsRedirectPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${params.projectId}/backlog`);
  }, [params.projectId, router]);

  return null;
}
