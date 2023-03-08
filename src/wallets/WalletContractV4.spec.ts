/**
 * Copyright (c) Whales Corp. 
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomTestKey } from "../utils/randomTestKey";
import { WalletContractV4 } from "./WalletContractV4";
import { createTestClient4 } from "../utils/createTestClient4";
import { Address, internal } from "ton-core";
import { createTestClient } from "../utils/createTestClient";

describe('WalletContractV4', () => {
    
    it('should has balance and correct address', async () => {

        // Create contract
        let client = createTestClient4();
        let key = randomTestKey('v4-treasure');
        let contract = client.open(WalletContractV4.create({ workchain: 0, publicKey: key.publicKey }));
        let balance = await contract.getBalance();

        // Check parameters
        expect(contract.address.equals(Address.parse('EQDnBF4JTFKHTYjulEJyNd4dstLGH1m51UrLdu01_tw4z2Au'))).toBe(true);
        expect(balance > 0n).toBe(true);
    });

    it('should perform transfer', async () => {
        // Create contract
        let client = createTestClient4();
        let key = randomTestKey('v4-treasure');
        let contract = client.open(WalletContractV4.create({ workchain: 0, publicKey: key.publicKey }));

        // Prepare transfer
        let seqno = await contract.getSeqno();
        let transfer = contract.createTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello world: 1'
            }), internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello world: 2'
            })]
        });

        // Perform transfer
        await contract.send(transfer);
    });

    it('should perform estimation', async () => {
        // Create contract
        let client = createTestClient();
        let contract = client.open(WalletContractV4.create({ workchain: 0, publicKey: randomTestKey('v4-treasure').publicKey }));

        // Prepare transfer
        let seqno = await contract.getSeqno();
        let transfer = contract.createTransfer({
            seqno,
            messages: [internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello world: 1'
            }), internal({
                to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                value: '0.1',
                body: 'Hello world: 2'
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