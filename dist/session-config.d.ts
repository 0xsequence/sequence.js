import { Address, Bytes, Hex } from 'ox';
import * as GenericTree from './generic-tree.js';
import { SessionPermissions } from './permission.js';
export declare const SESSIONS_FLAG_PERMISSIONS = 0;
export declare const SESSIONS_FLAG_NODE = 1;
export declare const SESSIONS_FLAG_BRANCH = 2;
export declare const SESSIONS_FLAG_BLACKLIST = 3;
export declare const SESSIONS_FLAG_IDENTITY_SIGNER = 4;
export type ImplicitBlacklistLeaf = {
    type: 'implicit-blacklist';
    blacklist: Address.Address[];
};
export type IdentitySignerLeaf = {
    type: 'identity-signer';
    identitySigner: Address.Address;
};
export type SessionPermissionsLeaf = SessionPermissions & {
    type: 'session-permissions';
};
export type SessionNode = Hex.Hex;
export type SessionLeaf = SessionPermissionsLeaf | ImplicitBlacklistLeaf | IdentitySignerLeaf;
export type SessionBranch = [SessionsTopology, SessionsTopology, ...SessionsTopology[]];
export type SessionsTopology = SessionBranch | SessionLeaf | SessionNode;
export declare function isSessionsTopology(topology: any): topology is SessionsTopology;
/**
 * Checks if the topology is complete.
 * A complete topology has at least one identity signer and one blacklist.
 * When performing encoding, exactly one identity signer is required. Others must be hashed into nodes.
 * @param topology The topology to check
 * @returns True if the topology is complete
 */
export declare function isCompleteSessionsTopology(topology: any): topology is SessionsTopology;
/**
 * Gets the identity signers from the topology.
 * @param topology The topology to get the identity signer from
 * @returns The identity signers
 */
export declare function getIdentitySigners(topology: SessionsTopology): Address.Address[];
/**
 * Gets the implicit blacklist from the topology.
 * @param topology The topology to get the implicit blacklist from
 * @returns The implicit blacklist or null if it's not present
 */
export declare function getImplicitBlacklist(topology: SessionsTopology): Address.Address[] | null;
/**
 * Gets the implicit blacklist leaf from the topology.
 * @param topology The topology to get the implicit blacklist leaf from
 * @returns The implicit blacklist leaf or null if it's not present
 */
export declare function getImplicitBlacklistLeaf(topology: SessionsTopology): ImplicitBlacklistLeaf | null;
export declare function getSessionPermissions(topology: SessionsTopology, address: Address.Address): SessionPermissionsLeaf | null;
export declare function getExplicitSigners(topology: SessionsTopology): Address.Address[];
/**
 * Encodes a leaf to bytes.
 * This can be Hash.keccak256'd to convert to a node..
 * @param leaf The leaf to encode
 * @returns The encoded leaf
 */
export declare function encodeLeafToGeneric(leaf: SessionLeaf): GenericTree.Leaf;
export declare function decodeLeafFromBytes(bytes: Bytes.Bytes): SessionLeaf;
export declare function sessionsTopologyToConfigurationTree(topology: SessionsTopology): GenericTree.Tree;
export declare function configurationTreeToSessionsTopology(tree: GenericTree.Tree): SessionsTopology;
/**
 * Encodes a topology into bytes for contract validation.
 * @param topology The topology to encode
 * @returns The encoded topology
 */
export declare function encodeSessionsTopology(topology: SessionsTopology): Bytes.Bytes;
export declare function decodeSessionsTopology(bytes: Bytes.Bytes): SessionsTopology;
export declare function sessionsTopologyToJson(topology: SessionsTopology): string;
export declare function sessionsTopologyFromJson(json: string): SessionsTopology;
/**
 * Removes all explicit sessions (permissions leaf nodes) that match the given signer from the topology.
 * Returns the updated topology or null if it becomes empty (for nesting).
 * If the signer is not found, the topology is returned unchanged.
 */
export declare function removeExplicitSession(topology: SessionsTopology, signerAddress: `0x${string}`): SessionsTopology | null;
export declare function addExplicitSession(topology: SessionsTopology, sessionPermissions: SessionPermissions): SessionsTopology;
export declare function removeIdentitySigner(topology: SessionsTopology, identitySigner: Address.Address): SessionsTopology | null;
export declare function addIdentitySigner(topology: SessionsTopology, identitySigner: Address.Address): SessionsTopology;
/**
 * Merges two topologies into a new branch of [a, b].
 */
export declare function mergeSessionsTopologies(a: SessionsTopology, b: SessionsTopology): SessionsTopology;
/**
 * Balances the topology by flattening and rebuilding as a balanced binary tree.
 */
export declare function balanceSessionsTopology(topology: SessionsTopology): SessionsTopology;
/**
 * Cleans a topology by removing leaves (SessionPermissions) whose deadline has expired.
 *    - currentTime is compared against `session.deadline`.
 *    - If a branch ends up with zero valid leaves, return `null`.
 *    - If it has one child, collapse that child upward.
 */
export declare function cleanSessionsTopology(topology: SessionsTopology, currentTime?: bigint): SessionsTopology | null;
/**
 * Minimise the topology by rolling unused signers into nodes.
 * @param topology The topology to minimise
 * @param signers The list of signers to consider
 * @returns The minimised topology
 */
export declare function minimiseSessionsTopology(topology: SessionsTopology, explicitSigners?: Address.Address[], implicitSigners?: Address.Address[], identitySigner?: Address.Address): SessionsTopology;
/**
 * Adds an address to the implicit session's blacklist.
 * If the address is not already in the blacklist, it is added and the list is sorted.
 */
export declare function addToImplicitBlacklist(topology: SessionsTopology, address: Address.Address): SessionsTopology;
/**
 * Removes an address from the implicit session's blacklist.
 */
export declare function removeFromImplicitBlacklist(topology: SessionsTopology, address: Address.Address): SessionsTopology;
/**
 *  Generate an empty sessions topology with the given identity signer. No session permission and an empty blacklist
 */
export declare function emptySessionsTopology(identitySigner: Address.Address | [Address.Address, ...Address.Address[]]): SessionsTopology;
//# sourceMappingURL=session-config.d.ts.map