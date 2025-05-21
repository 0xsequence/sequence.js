import { Arguments } from 'yargs';
export declare function readStdin(): Promise<string>;
export declare function fromPosOrStdin<T>(argv: Arguments<T>, arg: keyof T): Promise<string>;
export declare function requireString(arg: string | undefined, name: string): asserts arg is string;
//# sourceMappingURL=utils.d.ts.map