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

const signal = wf.defineSignal<[string]>('signal1');
const signalWithLateRegisteredHandler = wf.defineSignal<[string]>('signal2');

export async function workflowWithLateRegistrationOfSignalHandler() {
  let state: string[] = [];
  const signalHandler = async (arg: string) => {
    state.push(arg);
    if (arg == 'register-handler') {
      wf.setHandler(signalWithLateRegisteredHandler, signalHandler);
    }
  };
  wf.setHandler(signal, signalHandler);
  await wf.condition(() => state.includes('done'));
  state.push('$');
  return state;
}

test('Signal: late registration works', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithLateRegistrationOfSignalHandler);
    await wfHandle.signal(signalWithLateRegisteredHandler, 'late');
    await wfHandle.signal(signal, 'register-handler');
    await wfHandle.signal(signal, 'done');
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['register-handler', 'late', 'done', '$']);
  });
});
const update = wf.defineUpdate<string[], [string]>('update1');
const updateWithLateRegisteredHandler = wf.defineUpdate<string[], [string]>('update2');

export async function workflowWithLateRegistrationOfUpdateHandler() {
  let state: string[] = [];
  const updateHandler = async (arg: string) => {
    state.push(arg);
    if (arg == 'register-handler') {
      wf.setHandler(updateWithLateRegisteredHandler, updateHandler);
    }
    return state;
  };
  wf.setHandler(update, updateHandler);
  await wf.condition(() => state.includes('done'));
  state.push('$');
  return state;
}

// Times out
test('Update: late registration works', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    const wfHandle = await startWorkflow(workflowWithLateRegistrationOfUpdateHandler);
    await wfHandle.executeUpdate(updateWithLateRegisteredHandler, { args: ['late'] });
    await wfHandle.executeUpdate(update, { args: ['register-handler'] });
    await wfHandle.executeUpdate(update, { args: ['done'] });
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['register-handler', 'late', 'done', '$']);
  });
});
