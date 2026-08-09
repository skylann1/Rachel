import { getVendorMyTasks } from './actions';
import MyTaskClient from './MyTaskClient';

export default async function VendorMyTaskPage() {
  const tasks = await getVendorMyTasks();
  return <MyTaskClient tasks={tasks} />;
}
