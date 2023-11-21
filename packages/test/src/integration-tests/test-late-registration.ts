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

const update = wf.defineUpdate<string[], [string]>('update1');

if (false) {
  test('Signal: late registration works', async (t) => {
    const { createWorker, startWorkflow } = helpers(t);
    const worker = await createWorker();
    await worker.runUntil(async () => {
      const wfHandle = await startWorkflow(workflowWithLateRegistrationOfSignalHandler);
      // worker.shutdown();
      await wfHandle.signal(signalWithLateRegisteredHandler, 'late');
      await wfHandle.signal(signal, 'register-handler');
      // await createWorker();
      await wfHandle.signal(signal, 'done');
      const wfResult = await wfHandle.result();
      t.deepEqual(wfResult, ['register-handler', 'late', 'done', '$']);
    });
  });
  const updateWithLateRegisteredHandler = wf.defineUpdate<string[], [string]>('update2');

  async function workflowWithLateRegistrationOfUpdateHandler() {
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
  test('Update: late registration works', async (t) => {
    const { createWorker, startWorkflow } = helpers(t);
    // Note: there is no worker running
    const wfHandle = await startWorkflow(workflowWithLateRegistrationOfUpdateHandler);
    wfHandle.executeUpdate(updateWithLateRegisteredHandler, { args: ['late'] });
    wfHandle.executeUpdate(update, { args: ['register-handler'] });
    const worker = await createWorker();
    // The worker now receives [startWorkflow, doUpdate] in a single activation
    await worker.runUntil(async () => {
      await wfHandle.executeUpdate(update, { args: ['done'] });
      const wfResult = await wfHandle.result();
      t.deepEqual(wfResult, ['register-handler', 'late', 'done', '$']);
      await new Promise((f) => setTimeout(f, 5000));
    });
  });
}

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

if (true) {
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
}
