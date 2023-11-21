import * as wf from '@temporalio/workflow';
import { helpers, makeTestFunction } from './helpers';

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

const update = wf.defineUpdate<string[], [string]>('update1');

export async function workflowWithRegistrationOfUpdateHandler() {
  const updateHandler = async (arg: string) => {
    state.push(arg);
    return state;
  };
  wf.setHandler(update, updateHandler);
  let state: string[] = [];
  await wf.condition(() => state.includes('done'));
  state.push('$');
  return state;
}

test('Update: update in first WFT works', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  // Note: there is no worker running
  const wfHandle = await startWorkflow(workflowWithRegistrationOfUpdateHandler);
  wfHandle.executeUpdate(update, { args: ['done'] });
  const worker = await createWorker();
  // The worker now receives [startWorkflow, doUpdate] in a single activation
  await worker.runUntil(async () => {
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done', '$']);
  });
});
