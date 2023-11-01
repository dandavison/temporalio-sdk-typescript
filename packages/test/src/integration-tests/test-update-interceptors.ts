import { Next, UpdateInput, WorkflowInboundCallsInterceptor, WorkflowInterceptors } from '@temporalio/workflow';
import { WorkflowUpdateInput, WorkflowUpdateOutput } from '@temporalio/client';
import { helpers, makeTestFunction } from './helpers';
import { update, workflowWithUpdates, workflowsPath } from './workflows';

const test = makeTestFunction({
  workflowsPath,
  workflowInterceptorModules: [require.resolve(__filename)],
  workflowEnvironmentOpts: {
    client: {
      interceptors: {
        workflow: [
          {
            async update(input: WorkflowUpdateInput, next): Promise<WorkflowUpdateOutput> {
              return next({ ...input, args: [input.args[0] + '-clientIntercepted', ...input.args.slice(1)] });
            },
          },
        ],
      },
    },
    server: {
      executable: {
        type: 'cached-download',
        version: 'latest',
      },
    },
  },
});

export class UpdateInboundCallsInterceptor implements WorkflowInboundCallsInterceptor {
  async handleUpdate(input: UpdateInput, next: Next<UpdateInboundCallsInterceptor, 'handleUpdate'>): Promise<unknown> {
    return await next({ ...input, args: [input.args[0] + '-inboundIntercepted', ...input.args.slice(1)] });
  }
}

export const interceptors = (): WorkflowInterceptors => ({
  inbound: [new UpdateInboundCallsInterceptor()],
});

test('Update client and inbound interceptors work for executeUpdate', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);

    const updateResult = await wfHandle.executeUpdate(update, { args: ['1'] });
    t.deepEqual(updateResult, ['1-clientIntercepted-inboundIntercepted']);
  });
});

test('Update client and inbound interceptors work for startUpdate', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);

    const updateHandle = await wfHandle.startUpdate(update, { args: ['1'] });
    const updateResult = await updateHandle.result();
    t.deepEqual(updateResult, ['1-clientIntercepted-inboundIntercepted']);
  });
});
