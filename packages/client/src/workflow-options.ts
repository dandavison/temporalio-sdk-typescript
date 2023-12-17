import { CommonWorkflowOptions, SignalDefinition, WithWorkflowArgs, Workflow } from '@temporalio/common';
import { Duration, msOptionalToTs } from '@temporalio/common/lib/time';
import { Replace } from '@temporalio/common/lib/type-helpers';
import { google } from '@temporalio/proto';

export * from '@temporalio/common/lib/workflow-options';

export interface CompiledWorkflowOptions extends WithCompiledWorkflowOptions<WorkflowOptions> {
  args: unknown[];
}

export interface WorkflowOptions extends CommonWorkflowOptions {
  /**
   * Workflow id to use when starting.
   *
   * Assign a meaningful business id.
   * This ID can be used to ensure starting Workflows is idempotent.
   * Workflow IDs are unique, see also {@link WorkflowOptions.workflowIdReusePolicy}
   */
  workflowId: string;

  /**
   * Task queue to use for Workflow tasks. It should match a task queue specified when creating a
   * `Worker` that hosts the Workflow code.
   */
  taskQueue: string;

  /**
   * If set to true, instructs the client to follow the chain of execution before returning a Workflow's result.
   *
   * Workflow execution is chained if the Workflow has a cron schedule or continues-as-new or configured to retry
   * after failure or timeout.
   *
   * @default true
   */
  followRuns?: boolean;

  /**
   * Amount of time to wait before starting the workflow.
   *
   * @experimental
   */
  startDelay?: Duration;
}

export type WithCompiledWorkflowOptions<T extends WorkflowOptions> = Replace<
  T,
  {
    workflowExecutionTimeout?: google.protobuf.IDuration;
    workflowRunTimeout?: google.protobuf.IDuration;
    workflowTaskTimeout?: google.protobuf.IDuration;
    startDelay?: google.protobuf.IDuration;
  }
>;

export function compileWorkflowOptions<T extends WorkflowOptions>(options: T): WithCompiledWorkflowOptions<T> {
  const { workflowExecutionTimeout, workflowRunTimeout, workflowTaskTimeout, startDelay, ...rest } = options;

  return {
    ...rest,
    workflowExecutionTimeout: msOptionalToTs(workflowExecutionTimeout),
    workflowRunTimeout: msOptionalToTs(workflowRunTimeout),
    workflowTaskTimeout: msOptionalToTs(workflowTaskTimeout),
    startDelay: msOptionalToTs(startDelay),
  };
}

export enum WorkflowStartPolicy {
  IF_NOT_RUNNING = 0,
  ALWAYS,
}

export interface WorkflowUpdateWorkflowStartOptions<T extends Workflow> {
  readonly workflowTypeOrFunc: string | T;
  readonly startPolicy: WorkflowStartPolicy;
  readonly startOptions: Omit<WorkflowStartOptions<T>, 'workflowId'>;
}

export interface WorkflowUpdateOptions<T extends Workflow> {
  readonly updateId?: string;
  readonly workflowStartOptions?: WorkflowUpdateWorkflowStartOptions<T>;
}

export type WorkflowSignalWithStartOptions<SignalArgs extends any[] = []> = SignalArgs extends [any, ...any[]]
  ? WorkflowSignalWithStartOptionsWithArgs<SignalArgs>
  : WorkflowSignalWithStartOptionsWithoutArgs<SignalArgs>;

export interface WorkflowSignalWithStartOptionsWithoutArgs<SignalArgs extends any[]> extends WorkflowOptions {
  /**
   * SignalDefinition or name of signal
   */
  signal: SignalDefinition<SignalArgs> | string;

  /**
   * Arguments to invoke the signal handler with
   */
  signalArgs?: SignalArgs;
}

export interface WorkflowSignalWithStartOptionsWithArgs<SignalArgs extends any[]> extends WorkflowOptions {
  /**
   * SignalDefinition or name of signal
   */
  signal: SignalDefinition<SignalArgs> | string;

  /**
   * Arguments to invoke the signal handler with
   */
  signalArgs: SignalArgs;
}

/**
 * Options for starting a Workflow
 */
export type WorkflowStartOptions<T extends Workflow = Workflow> = WithWorkflowArgs<T, WorkflowOptions>;
