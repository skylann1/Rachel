import React from 'react';
import { getMyTasks } from './actions';
import { getVendorsAndProjects } from '../inspection/actions';
import { getCurrentUserProfile } from '../approval/actions';
import MyTaskClient from './MyTaskClient';

export default async function MyTaskPage() {
  const profile = await getCurrentUserProfile();
  const tasks = await getMyTasks();
  const { internalUsers } = await getVendorsAndProjects();
  
  const userRole = profile?.role || 'vendor';

  return (
    <MyTaskClient tasks={tasks} userRole={userRole} internalUsers={internalUsers} />
  );
}
