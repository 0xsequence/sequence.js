import type { CommandModule } from 'yargs';
export declare function doAddSession(sessionInput: string, topologyInput: string): Promise<string>;
export declare function doRemoveSession(explicitSessionAddress: string, topologyInput: string): Promise<string>;
declare const sessionExplicitCommand: CommandModule;
export default sessionExplicitCommand;
//# sourceMappingURL=sessionExplicit.d.ts.map