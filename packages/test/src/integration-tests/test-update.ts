import * as wf from '@temporalio/workflow';
import { helpers, makeTestFunction } from './helpers';
import { WorkflowHandle } from '@temporalio/client';
import { logToFile } from '@temporalio/common';
import { temporal } from '@temporalio/proto';

const test = makeTestFunction({
  workflowsPath: __filename,
  workflowEnvironmentOpts: {
    // TODO: remove this server config when default test server supports update
    server: {
      executable: {
        type: 'cached-download',
        version: 'latest',
      },
    },
  },
});

// An update with arguments and return value, with which we associate an async
// handler function and a validator.
export const update = wf.defineUpdate<string[], [string]>('update');
// A update that accepts no arguments and returns nothing, with which we
// associate a sync handler function, but no validator.
export const doneUpdate = wf.defineUpdate<void, []>('done-update');

export async function workflowWithUpdates(): Promise<string[]> {
  const state: string[] = [];
  const updateHandler = async (arg: string): Promise<string[]> => {
    state.push(arg);
    if (arg === 'fail-update') {
      throw new wf.ApplicationFailure(`Deliberate ApplicationFailure in handler`);
    }
    return state;
  };
  const doneUpdateHandler = (): void => {
    state.push('done');
  };
  const validator = (arg: string): void => {
    if (arg === 'bad-arg') {
      throw new Error('Validation failed');
    }
  };
  wf.setHandler(update, updateHandler, { validator });
  wf.setHandler(doneUpdate, doneUpdateHandler);
  await wf.condition(() => state.includes('done'));
  state.push('$');
  return state;
}

export const updateWithMutableArg = wf.defineUpdate<string[], [[string]]>('updateWithMutableArg');

export async function workflowWithMutatingValidator(): Promise<string[]> {
  const state: string[] = [];
  const updateHandler = async (arg: [string]): Promise<string[]> => {
    state.push(arg[0]);
    return state;
  };
  const doneUpdateHandler = (): void => {
    state.push('done');
  };
  const validator = (arg: [string]): void => {
    arg[0] = 'mutated!';
  };
  wf.setHandler(updateWithMutableArg, updateHandler, { validator });
  wf.setHandler(doneUpdate, doneUpdateHandler);
  await wf.condition(() => state.includes('done'));
  state.push('$');
  return state;
}

test('Update can be executed via executeUpdate()', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);

    const updateResult = await wfHandle.executeUpdate(update, { args: ['1'] });
    t.deepEqual(updateResult, ['1']);

    const doneUpdateResult = await wfHandle.executeUpdate(doneUpdate);
    t.is(doneUpdateResult, undefined);

    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['1', 'done', '$']);
  });
});

test('Update can be executed via startUpdate() and handle.result()', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);

    const updateHandle = await wfHandle.startUpdate(update, { args: ['1'] });
    const updateResult = await updateHandle.result();
    t.deepEqual(updateResult, ['1']);

    const doneUpdateHandle = await wfHandle.startUpdate(doneUpdate);
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
    const wfHandle = await startWorkflow(workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(update, { args: ['bad-arg'] }),
      wf.ApplicationFailure,
      'Validation failed'
    );
  });
});

test('Update validator can reject when using handle.result() but handle can be obtained without error', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);
    const updateHandle = await wfHandle.startUpdate(update, { args: ['bad-arg'] });
    await assertWorkflowUpdateFailed(updateHandle.result(), wf.ApplicationFailure, 'Validation failed');
  });
});

test('Update handler does not see mutations to arguments made by validator', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithMutatingValidator);
    const updateResult = await wfHandle.executeUpdate(updateWithMutableArg, { args: [['1']] });
    t.deepEqual(updateResult, ['1']);
  });
});

test('Update: ApplicationFailure in handler rejects the update', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(update, { args: ['fail-update'] }),
      wf.ApplicationFailure,
      'Deliberate ApplicationFailure in handler'
    );
    await wfHandle.executeUpdate(update, { args: ['done'] });
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['fail-update', 'done', '$']);
  });
});

test('Update is rejected if there is no handler', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowUpdateFailed } = helpers(t);
  const worker = await createWorker();
  const updateWithoutHandler = wf.defineUpdate<string[], [string]>('updateWithoutHandler');
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);
    await assertWorkflowUpdateFailed(
      wfHandle.executeUpdate(updateWithoutHandler, { args: [''] }),
      wf.ApplicationFailure,
      'Update has no handler: updateWithoutHandler'
    );
  });
});

test('Update sent after workflow completed', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);
    await wfHandle.executeUpdate(doneUpdate);
    await wfHandle.result();
    try {
      await wfHandle.executeUpdate(update, { args: ['1'] });
    } catch (err) {
      t.true(err instanceof wf.WorkflowNotFoundError);
      t.is((err as wf.WorkflowNotFoundError).message, 'workflow execution already completed');
    }
  });
});

test('Update id can be assigned and is present on returned handle', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithUpdates);
    const updateHandle = await wfHandle.startUpdate(doneUpdate, { updateId: 'my-update-id' });
    t.is(updateHandle.updateId, 'my-update-id');
  });
});

// The tests below construct scenarios in which doUpdate jobs are packaged
// together with startWorkflow in the first Activation. We test this because it
// provides test coverage for Update buffering: were it not for the buffering,
// we would attempt to start performing the Update (validate and handle) before
// its handler is set. (Note that sdk-core sorts Update jobs with Signal jobs,
// i.e. ahead of jobs such as startWorkflow and completeActivity that might
// result in a setHandler call.)

// TODO: we currently lack a way to ensure, without race conditions, via SDK
// APIs, that Updates are packaged together with startWorkflow in the first
// Activation. In lieu of a non-racy implementation, the tests below we do the
// following:
// 1. Client sends and awaits startWorkflow.
// 2. Client sends but does not await executeUpdate.
// 3. Wait for long enough to be confident that the server handled the
//    executeUpdate and is now waiting for the Update to advance to Completed.
// 4. Start the Worker.

test('Two Updates in first WFT', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const wfHandle = await startWorkflow(workflowWithUpdates);
  wfHandle.executeUpdate(update, { args: ['1'] });
  wfHandle.executeUpdate(doneUpdate);
  await new Promise((res) => setTimeout(res, 1000));
  const worker = await createWorker();
  await worker.runUntil(async () => {
    // Worker receives activation: [doUpdate, doUpdate, startWorkflow]
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done', 'done-2']);
    await logHistory(wfHandle);
  });
});

/* BEGIN: Test example from WorkflowHandle docstring */
export const incrementSignal = wf.defineSignal<[number]>('increment');
export const getValueQuery = wf.defineQuery<number>('getValue');
export const incrementAndGetValueUpdate = wf.defineUpdate<number, [number]>('incrementAndGetValue');

export async function counterWorkflow(initialValue: number): Promise<void> {
  let count = initialValue;
  wf.setHandler(incrementSignal, (arg: number) => {
    count += arg;
  });
  wf.setHandler(getValueQuery, () => count);
  wf.setHandler(incrementAndGetValueUpdate, (arg: number): number => {
    count += arg;
    return count;
  });
  await wf.condition(() => false);
}

test('Update/Signal/Query example in WorkflowHandle docstrings works', async (t) => {
  const { createWorker, startWorkflow, assertWorkflowFailedError } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(counterWorkflow, { args: [2] });
    await wfHandle.signal(incrementSignal, 2);
    const queryResult = await wfHandle.query(getValueQuery);
    t.is(queryResult, 4);
    const updateResult = await wfHandle.executeUpdate(incrementAndGetValueUpdate, { args: [2] });
    t.is(updateResult, 6);
    const secondUpdateHandle = await wfHandle.startUpdate(incrementAndGetValueUpdate, { args: [2] });
    const secondUpdateResult = await secondUpdateHandle.result();
    t.is(secondUpdateResult, 8);
    await wfHandle.cancel();
    await assertWorkflowFailedError(wfHandle.result(), wf.CancelledFailure);
  });
});
/* END: Test example from WorkflowHandle docstring */

async function logHistory(wfHandle: WorkflowHandle) {
  const events = (await wfHandle.fetchHistory()).events ?? [];
  const eventsString = events.map(formatEvent).join('\n');
  logToFile('\n\n' + eventsString, 'test', 'black');
}

function formatEvent(event: temporal.api.history.v1.IHistoryEvent): string {
  const ev = temporal.api.history.v1.HistoryEvent.create(event);
  const eventType = JSON.parse(JSON.stringify(event)).eventType;
  return `${ev.eventId} ${eventType}`;
}
