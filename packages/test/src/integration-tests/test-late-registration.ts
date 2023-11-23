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

// test('Update in first WFT', async (t) => {
//   const { createWorker, startWorkflow } = helpers(t);
//   const wfHandle = await startWorkflow(setHandlerInFirstWFT);
//   wfHandle.executeUpdate(update, { args: ['done'] });
//   await new Promise((res) => setTimeout(res, 1000));
//   const worker = await createWorker();
//   await worker.runUntil(async () => {
//     // Worker receives activation: [doUpdate, startWorkflow]
//     const wfResult = await wfHandle.result();
//     t.deepEqual(wfResult, ['done']);
//     await logHistory(wfHandle);
//   });
// });
