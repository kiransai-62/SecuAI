export interface ScannerAdapter {
  name: string;
  version: string;
  run(target: string): Promise<any>;
}

export const defaultAdapter: ScannerAdapter = {
  name: 'isitsecure-subprocess',
  version: '2.4.0',
  async run(target: string) {
    return { target, findings: [] };
  },
};
