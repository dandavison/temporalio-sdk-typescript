import test from 'ava';
import { reachabilityResponseFromProto, UnversionedBuildId } from '@temporalio/client/lib/task-queue-client';
import { temporal } from '@temporalio/proto';

const TaskReachability = temporal.api.enums.v1.TaskReachability;
const GetWorkerTaskReachabilityResponse = temporal.api.workflowservice.v1.GetWorkerTaskReachabilityResponse;

test('Worker versioning workers get appropriate tasks', async (t) => {
  const res = reachabilityResponseFromProto(
    GetWorkerTaskReachabilityResponse.create({
      buildIdReachability: [
        {
          buildId: '2.0',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [TaskReachability.TASK_REACHABILITY_NEW_WORKFLOWS],
            },
          ],
        },
        {
          buildId: '1.0',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [TaskReachability.TASK_REACHABILITY_OPEN_WORKFLOWS],
            },
          ],
        },
        {
          buildId: '1.1',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [
                TaskReachability.TASK_REACHABILITY_EXISTING_WORKFLOWS,
                TaskReachability.TASK_REACHABILITY_NEW_WORKFLOWS,
              ],
            },
          ],
        },
        {
          buildId: '0.1',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [TaskReachability.TASK_REACHABILITY_CLOSED_WORKFLOWS],
            },
          ],
        },
        {
          buildId: 'unreachable',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [],
            },
          ],
        },
        {
          buildId: 'badboi',
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [TaskReachability.TASK_REACHABILITY_UNSPECIFIED],
            },
          ],
        },
        {
          buildId: '', // Unversioned
          taskQueueReachability: [
            {
              taskQueue: 'foo',
              reachability: [],
            },
          ],
        },
      ],
    })
  );

  console.warn(res.buildIdReachability);
  t.deepEqual(res.buildIdReachability['2.0'].taskQueueReachability.foo, ['NEW_WORKFLOWS']);
  t.deepEqual(res.buildIdReachability['1.0'].taskQueueReachability.foo, ['OPEN_WORKFLOWS']);
  t.deepEqual(res.buildIdReachability['1.1'].taskQueueReachability.foo, ['EXISTING_WORKFLOWS', 'NEW_WORKFLOWS']);
  t.deepEqual(res.buildIdReachability['0.1'].taskQueueReachability.foo, ['CLOSED_WORKFLOWS']);
  t.deepEqual(res.buildIdReachability['unreachable'].taskQueueReachability.foo, []);
  t.deepEqual(res.buildIdReachability['badboi'].taskQueueReachability.foo, ['NOT_FETCHED']);
  t.deepEqual(res.buildIdReachability[UnversionedBuildId].taskQueueReachability.foo, []);

  t.pass();
});
