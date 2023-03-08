/**
 * Copyright (c) Whales Corp. 
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beginCell, Builder, MessageRelaxed, storeMessageRelaxed } from "ton-core";
import { sign } from "ton-crypto";
import { Maybe } from "../../utils/maybe";

export function createSigningMessageV1(args: { seqno: number, sendMode: number, message: Maybe<MessageRelaxed> }) {

    // Create message
    let signingMessage = beginCell()
        .storeUint(args.seqno, 32);
    if (args.message) {
        signingMessage.storeUint(args.sendMode, 8);
        signingMessage.storeRef(beginCell().store(storeMessageRelaxed(args.message)));
    }

    return signingMessage;
}

export function createSigningMessageV2(args: { seqno: number, sendMode: number, messages: MessageRelaxed[], timeout?: Maybe<number> }) {

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

    return signingMessage;

}

export function createSigningMessageV3(args: {
    seqno: number,
    sendMode: number,
    walletId: number,
    messages: MessageRelaxed[],
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

    return signingMessage;
}

export function createSigningMessageV4(args: {
    seqno: number,
    sendMode: number,
    walletId: number,
    messages: MessageRelaxed[],
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

    return signingMessage;
}

export function createSigningTransferMessage(args: { signingMessage: Builder, secretKey: Buffer }) {
    // Sign message
    let signature: Buffer = sign(args.signingMessage.endCell().hash(), args.secretKey);

    // Body
    const body = beginCell()
        .storeBuffer(signature)
        .storeBuilder(args.signingMessage)
        .endCell();

    return body;
}

export function createUnSigningTransferMessage(args: { signingMessage: Builder }) {
    // Empty signature for transaction estimation
    let signature = Buffer.alloc(64);

    // Body
    const body = beginCell()
        .storeBuffer(signature) 
        .storeBuilder(args.signingMessage)
        .endCell();

    return body;
}