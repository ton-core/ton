/**
 * Copyright (c) Whales Corp. 
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomTestKey } from "../utils/randomTestKey";
import { createTestClient4 } from "../utils/createTestClient4";
import { Address, internal } from "ton-core";
import { WalletContractV3R2 } from "./WalletContractV3R2";
import { createTestClient } from "../utils/createTestClient";

describe('WalletContractV3R1', () => {

    it('should has balance and correct address', async () => {

        // Create contract
        let client = createTestClient4();
        let key = randomTestKey('v4-treasure');
        let contract = client.open(WalletContractV3R2.create({ workchain: 0, publicKey: key.publicKey }));
        let balance = await contract.getBalance();

        // Check parameters
        expect(contract.address.equals(Address.parse('EQA0D_5WdusaCB-SpnoE6l5TzdBmgOkzTcXrdh0px6g3zJSk'))).toBe(true);
        expect(balance > 0n).toBe(true);
    });
    
    it('should perform transfer', async () => {
        // Create contract
        let client = createTestClient4();
        let key = randomTestKey('v4-treasure');
        let contract = client.open(WalletContractV3R2.create({ workchain: 0, publicKey: key.publicKey }));

        // Prepare transfer
        let seqno = await contract.getSeqno();
        let transfer = contract.createTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello, world!'
            })]
        });

        // Perform transfer
        await contract.send(transfer);
    });

    it('should perform estimation', async () => {
        // Create contract
        let client = createTestClient();
        let contract = client.open(WalletContractV3R2.create({ workchain: 0, publicKey: randomTestKey('v4-treasure').publicKey }));

        // Prepare transfer
        let seqno = await contract.getSeqno();
        let transfer = contract.createTransfer({
            seqno,
            messages: [internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello, world!'
            })]
        });

        // Perform estimation
        await client.estimateExternalMessageFee(contract.address, {
            body: transfer,
            initCode: contract.init.code,
            initData: contract.init.data,
            ignoreSignature: true
        });
    });
});