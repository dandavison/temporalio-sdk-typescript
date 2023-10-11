import * as wf from '@temporalio/workflow';
import { Next, UpdateInput, WorkflowInboundCallsInterceptor } from '@temporalio/workflow';
import { helpers, makeTestFunction } from './helpers';
import * as workflows from './workflows';

const test = makeTestFunction({
  workflowsPath: workflows.workflowsPath,
  workflowInterceptorModules: [require.resolve(__filename)],
  workflowEnvironmentOpts: {
    server: {
      executable: {
        type: 'cached-download',
        version: 'latest',
      },
    },
  },
});

export class UpdateInboundCallsInterceptor implements WorkflowInboundCallsInterceptor {
  validateUpdate(input: UpdateInput, next: Next<UpdateInboundCallsInterceptor, 'validateUpdate'>): void {
    next({ ...input, args: ['bad-arg'] });
  }
}

export const interceptors = () => ({
  inbound: [new UpdateInboundCallsInterceptor()],
});

test('Update validation interceptor works', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);

    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(workflows.update, { args: ['1'] }),
      wf.ApplicationFailure,
      'Validation failed'
    );

    const doneUpdateResult = await wfHandle.executeUpdate(workflows.doneUpdate);
    t.is(doneUpdateResult, undefined);

    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done', '$']);
  });
});
