import * as wf from '@temporalio/workflow';
import { helpers, makeTestFunction } from './helpers';
import * as workflows from './workflows';

const test = makeTestFunction({
  workflowsPath: workflows.workflowsPath,
  workflowEnvironmentOpts: {
    server: {
      executable: {
        type: 'cached-download',
        version: 'latest',
      },
    },
  },
});

test('Update can be executed via executeUpdate()', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);

    const updateResult = await wfHandle.executeUpdate(workflows.update, { args: ['1'] });
    t.deepEqual(updateResult, ['1']);

    const doneUpdateResult = await wfHandle.executeUpdate(workflows.doneUpdate);
    t.is(doneUpdateResult, undefined);

    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['1', 'done', '$']);
  });
});

test('Update can be executed via startUpdate() and handle.result()', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);

    const updateHandle = await wfHandle.startUpdate(workflows.update, { args: ['1'] });
    const updateResult = await updateHandle.result();
    t.deepEqual(updateResult, ['1']);

    const doneUpdateHandle = await wfHandle.startUpdate(workflows.doneUpdate);
    const doneUpdateResult = await doneUpdateHandle.result();
    t.is(doneUpdateResult, undefined);

    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['1', 'done', '$']);
  });
});

test('Update validator can reject when using executeUpdate()', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(workflows.update, { args: ['bad-arg'] }),
      wf.ApplicationFailure,
      'Validation failed'
    );
  });
});

test('Update validator can reject when using handle.result() but handle can be obtained without error', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);
    const updateHandle = await wfHandle.startUpdate(workflows.update, { args: ['bad-arg'] });
    await assertWorkflowUpdateFailed(updateHandle.result(), wf.ApplicationFailure, 'Validation failed');
  });
});

test('Update handler does not see mutations to arguments made by validator', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithMutatingValidator);
    const updateResult = await wfHandle.executeUpdate(workflows.updateWithMutableArg, { args: [['1']] });
    t.deepEqual(updateResult, ['1']);
  });
});

test('Update: ApplicationFailure in handler rejects the update', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(workflows.update, { args: ['fail-update'] }),
      wf.ApplicationFailure,
      'Deliberate ApplicationFailure in handler'
    );
    await wfHandle.executeUpdate(workflows.update, { args: ['done'] });
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['fail-update', 'done', '$']);
  });
});

test('Update is rejected if there is no handler', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  const updateWithoutHandler = wf.defineUpdate<string[], [string]>('updateWithoutHandler');
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(updateWithoutHandler),
      wf.ApplicationFailure,
      'Update has no handler: updateWithoutHandler'
    );
  });
});

test('Update sent after workflow completed', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.workflowWithUpdates);
    await wfHandle.executeUpdate(workflows.doneUpdate);
    await wfHandle.result();
    try {
      await wfHandle.executeUpdate(workflows.update, { args: ['1'] });
    } catch (err) {
      t.true(err instanceof wf.WorkflowNotFoundError);
      t.is((err as wf.WorkflowNotFoundError).message, 'workflow execution already completed');
    }
  });
});

test('Update/Signal/Query example in WorkflowHandle docstrings works', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowFailedError } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflows.counterWorkflow, { args: [2] });
    await wfHandle.signal(workflows.incrementSignal, 2);
    const queryResult = await wfHandle.query(workflows.getValueQuery);
    t.is(queryResult, 4);
    const updateResult = await wfHandle.executeUpdate(workflows.incrementAndGetValueUpdate, { args: [2] });
    t.is(updateResult, 6);
    await wfHandle.cancel();
    await assertWorkflowFailedError(wfHandle.result(), wf.CancelledFailure);
  });
});
