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

export async function workflowWithRegistrationOfUpdateHandler() {
  let state: string[] = [];
  const updateHandler = async (arg: string) => {
    wf.logToFileFromSandbox('In Update handler', 'worker', 'green');
    state.push(arg);
    return state;
  };
  wf.setHandler(update, updateHandler);
  await wf.condition(() => state.includes('done'));
  return state;
}

test('Update: update in first WFT works', async (t) => {
  const { createWorker, startWorkflow } = helpers(t);
  const wfHandle = await startWorkflow(workflowWithRegistrationOfUpdateHandler);
  const worker = await createWorker();
  await worker.runUntil(async () => {
    // Worker receives activation: [startWorkflow]
    await new Promise((res) => setTimeout(res, 1000));
    // Worker receives activation: [doUpdate]
    await wfHandle.executeUpdate(update, { args: ['done'] });
    const wfResult = await wfHandle.result();
    t.deepEqual(wfResult, ['done']);
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
