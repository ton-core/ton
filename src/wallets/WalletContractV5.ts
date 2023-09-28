/**
 * Copyright (c) Whales Corp.
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    Address,
    beginCell, BitBuilder, BitReader, BitString,
    Cell,
    Contract,
    contractAddress,
    ContractProvider, Dictionary,
    internal,
    MessageRelaxed,
    OutAction,
    OutList,
    Sender,
    SendMode
} from "ton-core";
import { Maybe } from "../utils/maybe";
import { createWalletTransferV5 } from "./signing/createWalletTransfer";


export class ActionSetData {
    public static readonly tag = 0x1ff8ea0b;

    public readonly tag = ActionSetData.tag;

    public serialized: Cell

    constructor(public readonly data: Cell) {
        this.serialized = beginCell().storeUint(this.tag, 32).storeRef(this.data).endCell();
    }
}

export class ActionAddExtension {
    public static readonly tag = 0x1c40db9f;

    public readonly tag = ActionAddExtension.tag;

    public serialized: Cell;

    constructor(public readonly address: Address) {
        this.serialized = beginCell().storeUint(this.tag, 32).storeAddress(this.address).endCell();
    }
}

export class ActionRemoveExtension {
    public static readonly tag = 0x5eaef4a4;

    public readonly tag = ActionRemoveExtension.tag;

    public serialized: Cell

    constructor(public readonly address: Address) {
        this.serialized = beginCell().storeUint(this.tag, 32).storeAddress(this.address).endCell();
    }
}

export type OutActionExtended = ActionSetData | ActionAddExtension | ActionRemoveExtension;
export const OutActionExtended = {
    addExtension(...args: ConstructorParameters<typeof ActionAddExtension>) {
        return new ActionAddExtension(...args);
    },
    removeExtension(...args: ConstructorParameters<typeof ActionRemoveExtension>) {
        return new ActionRemoveExtension(...args);
    },
    setData(...args: ConstructorParameters<typeof ActionSetData>) {
        return new ActionSetData(...args);
    }
}

export function isOutActionExtended(action: OutAction | OutActionExtended): action is OutActionExtended {
    return (
        action.tag === ActionSetData.tag ||
        action.tag === ActionAddExtension.tag ||
        action.tag === ActionRemoveExtension.tag
    );
}

export class OutListExtended {
    public readonly cell: Cell;

    public _outActions: OutAction[] = [];

    public get outActions(): OutAction[] {
        return this._outActions;
    }

    constructor(public readonly actions: (OutAction | OutActionExtended)[]) {
        this.cell = this.packActionsListExtended(actions);
    }

    private packActionsListExtended(actions: (OutAction | OutActionExtended)[]): Cell {
        const [action, ...rest] = actions;

        if (!action || !isOutActionExtended(action)) {
            if (actions.some(isOutActionExtended)) {
                throw new Error("Can't serialize actions list: all extended actions must be placed before out actions");
            }

            const outActionsList = new OutList(actions as OutAction[]);
            this._outActions = outActionsList.actions;

            return beginCell()
                .storeUint(0, 1)
                .storeRef(outActionsList.cell)
                .endCell();
        }

        return beginCell()
            .storeUint(1, 1)
            .storeSlice(action.serialized.beginParse())
            .storeRef(this.packActionsListExtended(rest))
            .endCell();
    }
}

export class WalletId {
    static readonly versionsSerialisation: Record<WalletId['walletVersion'], number> = {
        v5: 0
    };

    static deserialize(walletId: bigint | Buffer): WalletId {
        const bitReader = new BitReader(
            new BitString(
                typeof walletId === 'bigint' ? Buffer.from(walletId.toString(16), 'hex') : walletId,
                0,
                80
            )
        );
        const networkGlobalId = bitReader.loadInt(32);
        const workChain = bitReader.loadInt(8);
        const walletVersionRaw = bitReader.loadUint(8);
        const subwalletNumber = bitReader.loadUint(32);

        const walletVersion = Object.entries(this.versionsSerialisation).find(
            ([_, value]) => value === walletVersionRaw
        )?.[0] as WalletId['walletVersion'] | undefined;

        if (walletVersion === undefined) {
            throw new Error(
                `Can't deserialize walletId: unknown wallet version ${walletVersionRaw}`
            );
        }

        return new WalletId({ networkGlobalId, workChain, walletVersion, subwalletNumber });
    }

    readonly walletVersion: 'v5';

    /**
     * -239 is mainnet, -3 is testnet
     */
    readonly networkGlobalId: number;

    readonly workChain: number;

    readonly subwalletNumber: number;

    readonly serialized: bigint;

    constructor(args?: {
        networkGlobalId?: number;
        workChain?: number;
        subwalletNumber?: number;
        walletVersion?: 'v5';
    }) {
        this.networkGlobalId = args?.networkGlobalId ?? -239;
        this.workChain = args?.workChain ?? 0;
        this.subwalletNumber = args?.subwalletNumber ?? 0;
        this.walletVersion = args?.walletVersion ?? 'v5';

        const bitBuilder = new BitBuilder(80);
        bitBuilder.writeInt(this.networkGlobalId, 32);
        bitBuilder.writeInt(this.workChain, 8);
        bitBuilder.writeUint(WalletId.versionsSerialisation[this.walletVersion], 8);
        bitBuilder.writeUint(this.subwalletNumber, 32);

        this.serialized = BigInt('0x' + bitBuilder.buffer().toString('hex'));
    }
}


export type Wallet5BasicSendArgs = {
    seqno: number;
    sendMode?: Maybe<SendMode>;
    timeout?: Maybe<number>;
}

export type SingedAuthWallet5SendArgs = Wallet5BasicSendArgs & {
    secretKey: Buffer;
}

export type ExtensionAuthWallet5SendArgs = Wallet5BasicSendArgs & { }

export type Wallet5SendArgs =
    | SingedAuthWallet5SendArgs
    | ExtensionAuthWallet5SendArgs


export class WalletContractV5 implements Contract {

    static opCodes = {
        auth_extension: 0x6578746e,
        auth_signed: 0x7369676e
    }

    static create(args: {
        walletId?: WalletId,
        publicKey: Buffer
    }) {
        return new WalletContractV5(args.walletId ?? new WalletId(), args.publicKey);
    }

    readonly address: Address;
    readonly init: { data: Cell, code: Cell };

    private constructor(
        readonly walletId: WalletId,
        readonly publicKey: Buffer
    ) {
        this.walletId = walletId;

        // Build initial code and data
        let code = Cell.fromBoc(Buffer.from('te6cckEBAQEAIwAIQgLND3fEdsoVqej99mmdJbaOAOcmH9K3vkNG64R7FPAsl9kimVw=', 'base64'))[0];
        let data = beginCell()
            .storeUint(0, 32) // Seqno
            .storeUint(this.walletId.serialized, 80)
            .storeBuffer(this.publicKey)
            .storeBit(0) // Empty plugins dict
            .endCell();
        this.init = { code, data };
        this.address = contractAddress(this.walletId.workChain, { code, data });
    }

    /**
     * Get Wallet Balance
     */
    async getBalance(provider: ContractProvider) {
        let state = await provider.getState();
        return state.balance;
    }

    /**
     * Get Wallet Seqno
     */
    async getSeqno(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type === 'active') {
            let res = await provider.get('seqno', []);
            return res.stack.readNumber();
        } else {
            return 0;
        }
    }

    /**
     * Get Wallet Extensions
     */
    async getExtensions(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type === 'active') {
            const result = await provider.get('get_extensions', []);
            return result.stack.readCellOpt();
        } else {
            return null;
        }
    }

    /**
     * Get Wallet Extensions
     */
    async getExtensionsArray(provider: ContractProvider) {
        const extensions = await this.getExtensions(provider);
        if (!extensions) {
            return [];
        }

        const dict:  Dictionary<bigint, bigint> = Dictionary.loadDirect(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.BigInt(8),
            extensions
        );

        return dict.keys().map(key => {
            const wc = dict.get(key)!;
            const addressHex = key ^ (wc + 1n);
            return Address.parseRaw(`${wc}:${addressHex.toString(16)}`);
        })
    }

    /**
     * Send signed transfer
     */
    async send(provider: ContractProvider, message: Cell) {
        await provider.external(message);
    }

    /**
     * Sign and send transfer
     */
    async sendTransfer(provider: ContractProvider,   args: Wallet5SendArgs & { messages: MessageRelaxed[] }) {
        const transfer = this.createTransfer(args);
        await this.send(provider, transfer);
    }

    /**
     * Sign and send add extension request
     */
    async sendAddExtension(provider: ContractProvider, args: Wallet5SendArgs & { extensionAddress: Address }) {
        const request = this.createAddExtension(args);
        await this.send(provider, request);
    }

    /**
     * Sign and send remove extension request
     */
    async sendRemoveExtension(provider: ContractProvider, args: Wallet5SendArgs & { extensionAddress: Address, }) {
        const request = this.createRemoveExtension(args);
        await this.send(provider, request);
    }

    /**
     * Sign and send request
     */
    async sendRequest(provider: ContractProvider, args: Wallet5SendArgs & { actions: OutListExtended, }) {
        const request = this.createRequest(args);
        await this.send(provider, request);
    }

    /**
     * Create signed transfer
     */
    createTransfer(args: Wallet5SendArgs & { messages: MessageRelaxed[] }) {
        const { messages, ...rest } = args;

        const sendMode = args.sendMode ?? SendMode.PAY_GAS_SEPARATELY;
        const actions = new OutListExtended(messages.map(message => OutAction.sendMsg(sendMode, message)));

        return this.createRequest({
            ...rest,
            actions
        })
    }

    /**
     * Create signed add extension request
     */
    createAddExtension(args: Wallet5SendArgs & { extensionAddress: Address, }) {
        const { extensionAddress, ...rest } = args;
        return this.createRequest({
            actions: new OutListExtended([OutActionExtended.addExtension(extensionAddress)]),
            ...rest
        })
    }

    /**
     * Create signed remove extension request
     */
    createRemoveExtension(args: Wallet5SendArgs & { extensionAddress: Address, }) {
        const { extensionAddress, ...rest } = args;
        return this.createRequest({
            actions: new OutListExtended([OutActionExtended.removeExtension(extensionAddress)]),
            ...rest
        })
    }

    /**
     * Create signed request
     */
    createRequest(args: Wallet5SendArgs & { actions: OutListExtended, }) {
        return createWalletTransferV5({
            ...args,
            sendMode: args.sendMode ?? SendMode.PAY_GAS_SEPARATELY,
            walletId: this.walletId.serialized
        })
    }

    /**
     * Create sender
     */
    sender(provider: ContractProvider, secretKey: Buffer): Sender {
        return {
            send: async (args) => {
                let seqno = await this.getSeqno(provider);
                let transfer = this.createTransfer({
                    seqno,
                    secretKey,
                    sendMode: args.sendMode,
                    messages: [internal({
                        to: args.to,
                        value: args.value,
                        init: args.init,
                        body: args.body,
                        bounce: args.bounce
                    })]
                });
                await this.send(provider, transfer);
            }
        };
    }
}
