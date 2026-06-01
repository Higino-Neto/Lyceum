declare module "jsdom" {
  export class JSDOM {
    constructor(markup?: string | Buffer, options?: Record<string, unknown>);
    window: Window & typeof globalThis;
    serialize(): string;
  }
}
