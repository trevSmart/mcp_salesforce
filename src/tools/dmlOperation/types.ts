export interface DmlOperationResult {
  outcome: 'success' | 'partial' | 'error' | 'cancelled';
  statistics: {
    total: number;
    succeeded: number;
    failed: number;
  };
  successes?: Array<{
    id?: string;
    index: number;
    [key: string]: unknown;
  }>;
  errors?: Array<{
    index: number;
    message: string;
    type?: string;
    id?: string;
    fields?: string[];
  }>;
  cancellationReason?: string;
}
