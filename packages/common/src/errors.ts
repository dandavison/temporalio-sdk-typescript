import { TemporalFailure } from './failure';

/**
 * Thrown from code that receives a value that is unexpected or that it's unable to handle.
 */
export class ValueError extends Error {
  public readonly name: string = 'ValueError';

  constructor(message: string | undefined, public readonly cause?: unknown) {
    super(message ?? undefined);
  }
}

/**
 * Thrown when a Payload Converter is misconfigured.
 */
export class PayloadConverterError extends ValueError {
  public readonly name: string = 'PayloadConverterError';
}

/**
 * Used in different parts of the SDK to note that something unexpected has happened.
 */
export class IllegalStateError extends Error {
  public readonly name: string = 'IllegalStateError';
}

const isWorkflowExecutionAlreadyStartedError = Symbol.for('__temporal_isWorkflowExecutionAlreadyStartedError');

/**
 * This exception is thrown in the following cases:
 *  - Workflow with the same Workflow Id is currently running
 *  - There is a closed Workflow with the same Workflow Id and the {@link WorkflowOptions.workflowIdReusePolicy}
 *    is `WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE`
 *  - There is closed Workflow in the `Completed` state with the same Workflow Id and the {@link WorkflowOptions.workflowIdReusePolicy}
 *    is `WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE_FAILED_ONLY`
 */
export class WorkflowExecutionAlreadyStartedError extends TemporalFailure {
  public readonly name: string = 'WorkflowExecutionAlreadyStartedError';

  constructor(message: string, public readonly workflowId: string, public readonly workflowType: string) {
    super(message);
  }

  /**
   * Marker to determine whether an error is an instance of WorkflowExecutionAlreadyStartedError.
   */
  protected readonly [isWorkflowExecutionAlreadyStartedError] = true;

  /**
   * Instanceof check that works when multiple versions of @temporalio/common are installed.
   */
  static is(error: unknown): error is WorkflowExecutionAlreadyStartedError {
    return (
      error instanceof WorkflowExecutionAlreadyStartedError ||
      (error instanceof Error && (error as any)[isWorkflowExecutionAlreadyStartedError])
    );
  }
}

/**
 * Thrown when a Workflow with the given Id is not known to Temporal Server.
 * It could be because:
 * - Id passed is incorrect
 * - Workflow is closed (for some calls, e.g. `terminate`)
 * - Workflow was deleted from the Server after reaching its retention limit
 */
export class WorkflowNotFoundError extends Error {
  public readonly name: string = 'WorkflowNotFoundError';

  constructor(message: string, public readonly workflowId: string, public readonly runId: string | undefined) {
    super(message);
  }
}

/**
 * Thrown when the specified namespace is not known to Temporal Server.
 */
export class NamespaceNotFoundError extends Error {
  public readonly name: string = 'NamespaceNotFoundError';

  constructor(public readonly namespace: string) {
    super(`Namespace not found: '${namespace}'`);
  }
}
