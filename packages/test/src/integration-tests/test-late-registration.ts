import * as wf from '@temporalio/workflow';
import { helpers, makeTestFunction } from './helpers';
import { logToFile } from '@temporalio/common';
import { WorkflowHandle } from '@temporalio/client';
import { temporal } from '@temporalio/proto';

const test = makeTestFunction({
  workflowsPath: __filename,
  workflowEnvironmentOpts: {
    // TODO: remove this server config when default test server supports update
    server: {
      executable: {
        type: 'existing-path',
        path: '/Users/dan/src/temporalio/cli/temporal',
      },
    },
  },
});

const update = wf.defineUpdate<string[], [string]>('update1');
const update2 = wf.defineUpdate<string[], [string]>('update2');

export async function setHandlerInFirstWFT() {
  let state: string[] = [];
  const updateHandler = async (arg: string) => {
    wf.logToFileFromSandbox(`In Update handler: arg=${arg}`, 'worker', 'green');
    state.push(arg);
    return state;
  };
  wf.setHandler(update, updateHandler);
  await wf.condition(() => state.includes('done'));
  return state;
}

export async function setTwoHandlersInFirstWFT() {
  let state: string[] = [];
  const updateHandler = async (arg: string) => {
    wf.logToFileFromSandbox(`In Update handler: arg=${arg}`, 'worker', 'green');
    state.push(arg);
    return state;
  };
  wf.setHandler(update, updateHandler);
  wf.setHandler(update2, updateHandler);
  await wf.condition(() => {
    wf.logToFileFromSandbox(`Evaluating wait condition: state=${state}`, 'worker', 'green');
    return state.includes('done') && state.includes('done-2');
  });
  return state;
}

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

test('Update in first WFT', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const wfHandle = await startWorkflow(setHandlerInFirstWFT);
  wfHandle.executeUpdate(update, { args: ['done'] });
  await new Promise((res) => setTimeout(res, 1000));
  const worker = await createWorker();
  await worker.runUntil(async () => {
    // Worker receives activation: [doUpdate, startWorkflow]
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done']);
    await logHistory(wfHandle);
  });
});

test('Two Updates in first WFT', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const wfHandle = await startWorkflow(setTwoHandlersInFirstWFT);
  wfHandle.executeUpdate(update, { args: ['done'] });
  wfHandle.executeUpdate(update2, { args: ['done-2'] });
  await new Promise((res) => setTimeout(res, 1000));
  const worker = await createWorker();
  await worker.runUntil(async () => {
    // Worker receives activation: [doUpdate, doUpdate, startWorkflow]
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done', 'done-2']);
    await logHistory(wfHandle);
  });
});

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
