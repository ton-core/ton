/**
 * Copyright (c) Whales Corp.
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beginCell, Builder, MessageRelaxed, OutAction, storeMessageRelaxed } from "ton-core";
import { sign } from "ton-crypto";
import { Maybe } from "../../utils/maybe";
import {
    Wallet5SendArgs,
    WalletContractV5
} from "../WalletContractV5";
import {
    OutActionExtended,
    storeOutListExtended
} from "../WalletV5Utils";

export function createWalletTransferV1(args: { seqno: number, sendMode: number, message: Maybe<MessageRelaxed>, secretKey: Buffer }) {

    // Create message
    let signingMessage = beginCell()
        .storeUint(args.seqno, 32);
    if (args.message) {
        signingMessage.storeUint(args.sendMode, 8);
        signingMessage.storeRef(beginCell().store(storeMessageRelaxed(args.message)));
    }

    // Sign message
    let signature = sign(signingMessage.endCell().hash(), args.secretKey);

    // Body
    const body = beginCell()
        .storeBuffer(signature)
        .storeBuilder(signingMessage)
        .endCell();

    return body;
}

export function createWalletTransferV2(args: { seqno: number, sendMode: number, messages: MessageRelaxed[], secretKey: Buffer, timeout?: Maybe<number> }) {

    // Check number of messages
    if (args.messages.length > 4) {
        throw Error("Maximum number of messages in a single transfer is 4");
    }

    // Create message
    let signingMessage = beginCell()
        .storeUint(args.seqno, 32);
    if (args.seqno === 0) {
        for (let i = 0; i < 32; i++) {
            signingMessage.storeBit(1);
        }
    } else {
        signingMessage.storeUint(args.timeout || Math.floor(Date.now() / 1e3) + 60, 32); // Default timeout: 60 seconds
    }
    for (let m of args.messages) {
        signingMessage.storeUint(args.sendMode, 8);
        signingMessage.storeRef(beginCell().store(storeMessageRelaxed(m)));
    }

    // Sign message
    let signature = sign(signingMessage.endCell().hash(), args.secretKey);

    // Body
    const body = beginCell()
        .storeBuffer(signature)
        .storeBuilder(signingMessage)
        .endCell();

    return body;
}

export function createWalletTransferV3(args: {
    seqno: number,
    sendMode: number,
    walletId: number,
    messages: MessageRelaxed[],
    secretKey: Buffer,
    timeout?: Maybe<number>
}) {

    // Check number of messages
    if (args.messages.length > 4) {
        throw Error("Maximum number of messages in a single transfer is 4");
    }

    // Create message to sign
    let signingMessage = beginCell()
        .storeUint(args.walletId, 32);
    if (args.seqno === 0) {
        for (let i = 0; i < 32; i++) {
            signingMessage.storeBit(1);
        }
    } else {
        signingMessage.storeUint(args.timeout || Math.floor(Date.now() / 1e3) + 60, 32); // Default timeout: 60 seconds
    }
    signingMessage.storeUint(args.seqno, 32);
    for (let m of args.messages) {
        signingMessage.storeUint(args.sendMode, 8);
        signingMessage.storeRef(beginCell().store(storeMessageRelaxed(m)));
    }

    // Sign message
    let signature = sign(signingMessage.endCell().hash(), args.secretKey);

    // Body
    const body = beginCell()
        .storeBuffer(signature)
        .storeBuilder(signingMessage)
        .endCell();

    return body;
}

export function createWalletTransferV4(args: {
    seqno: number,
    sendMode: number,
    walletId: number,
    messages: MessageRelaxed[],
    secretKey: Buffer,
    timeout?: Maybe<number>
}) {

    // Check number of messages
    if (args.messages.length > 4) {
        throw Error("Maximum number of messages in a single transfer is 4");
    }

    let signingMessage = beginCell()
        .storeUint(args.walletId, 32);
    if (args.seqno === 0) {
        for (let i = 0; i < 32; i++) {
            signingMessage.storeBit(1);
        }
    } else {
        signingMessage.storeUint(args.timeout || Math.floor(Date.now() / 1e3) + 60, 32); // Default timeout: 60 seconds
    }
    signingMessage.storeUint(args.seqno, 32);
    signingMessage.storeUint(0, 8); // Simple order
    for (let m of args.messages) {
        signingMessage.storeUint(args.sendMode, 8);
        signingMessage.storeRef(beginCell().store(storeMessageRelaxed(m)));
    }

    // Sign message
    let signature: Buffer = sign(signingMessage.endCell().hash(), args.secretKey);

    // Body
    const body = beginCell()
        .storeBuffer(signature)
        .storeBuilder(signingMessage)
        .endCell();

    return body;
}

export function createWalletTransferV5(args: Wallet5SendArgs & { actions: (OutAction | OutActionExtended)[], walletId: (builder: Builder) => void }) {
    // Check number of actions
    if (args.actions.length > 255) {
        throw Error("Maximum number of OutActions in a single request is 255");
    }

    if (!('secretKey' in args) || !args.secretKey) {
        return beginCell()
            .storeUint(WalletContractV5.opCodes.auth_extension, 32)
            .store(storeOutListExtended(args.actions))
            .endCell();
    }

    const message = beginCell().store(args.walletId);
    if (args.seqno === 0) {
        for (let i = 0; i < 32; i++) {
            message.storeBit(1);
        }
    } else {
        message.storeUint(args.timeout || Math.floor(Date.now() / 1e3) + 60, 32); // Default timeout: 60 seconds
    }

     message.storeUint(args.seqno, 32).store(storeOutListExtended(args.actions));

    // Sign message
    const signature = sign(message.endCell().hash(), args.secretKey);

    return beginCell()
        .storeUint(WalletContractV5.opCodes.auth_signed, 32)
        .storeBuffer(signature)
        .storeBuilder(message)
        .endCell();
}
