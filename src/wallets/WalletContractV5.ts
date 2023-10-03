/**
 * Copyright (c) Whales Corp.
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider, Dictionary,
    internal,
    MessageRelaxed,
    OutAction,
    Sender,
    SendMode
} from "ton-core";
import { Maybe } from "../utils/maybe";
import { createWalletTransferV5 } from "./signing/createWalletTransfer";
import {OutActionExtended, storeWalletId, WalletId} from "./WalletV5Utils";



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
        walletId?: Partial<WalletId>,
        publicKey: Buffer
    }) {
        const walletId = {
            networkGlobalId: args.walletId?.networkGlobalId ?? -239,
            workChain: args?.walletId?.workChain ?? 0,
            subwalletNumber: args?.walletId?.subwalletNumber ?? 0,
            walletVersion: args?.walletId?.walletVersion ?? 'v5'
        }
        return new WalletContractV5(walletId, args.publicKey);
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
            .store(storeWalletId(this.walletId))
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
    async sendRequest(provider: ContractProvider, args: Wallet5SendArgs & { actions: (OutAction | OutActionExtended)[], }) {
        const request = this.createRequest(args);
        await this.send(provider, request);
    }

    /**
     * Create signed transfer
     */
    createTransfer(args: Wallet5SendArgs & { messages: MessageRelaxed[] }) {
        const { messages, ...rest } = args;

        const sendMode = args.sendMode ?? SendMode.PAY_GAS_SEPARATELY;
        const actions: OutAction[] = messages.map(message => ({ type: 'sendMsg', mode: sendMode, outMsg: message}));

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
            actions: [{
                type: 'addExtension',
                address: extensionAddress
            }],
            ...rest
        })
    }

    /**
     * Create signed remove extension request
     */
    createRemoveExtension(args: Wallet5SendArgs & { extensionAddress: Address, }) {
        const { extensionAddress, ...rest } = args;
        return this.createRequest({
            actions: [{
                type: 'removeExtension',
                address: extensionAddress
            }],
            ...rest
        })
    }

    /**
     * Create signed request
     */
    createRequest(args: Wallet5SendArgs & { actions: (OutAction | OutActionExtended)[], }) {
        return createWalletTransferV5({
            ...args,
            sendMode: args.sendMode ?? SendMode.PAY_GAS_SEPARATELY,
            walletId: storeWalletId(this.walletId)
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
