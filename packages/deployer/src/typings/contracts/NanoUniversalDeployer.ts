/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type { BaseContract, Signer, utils } from "ethers";
import type { EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "./common";

export interface NanoUniversalDeployerInterface extends utils.Interface {
  functions: {};

  events: {
    "Deploy(address)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "Deploy"): EventFragment;
}

export interface DeployEventObject {
  _addr: string;
}
export type DeployEvent = TypedEvent<[string], DeployEventObject>;

export type DeployEventFilter = TypedEventFilter<DeployEvent>;

export interface NanoUniversalDeployer extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: NanoUniversalDeployerInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {};

  callStatic: {};

  filters: {
    "Deploy(address)"(_addr?: null): DeployEventFilter;
    Deploy(_addr?: null): DeployEventFilter;
  };

  estimateGas: {};

  populateTransaction: {};
}
