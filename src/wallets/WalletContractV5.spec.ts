/**
 * Copyright (c) Whales Corp.
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomTestKey } from "../utils/randomTestKey";
import { Address, internal, OpenedContract } from "ton-core";
import { WalletContractV5 } from "./WalletContractV5";
import { KeyPair } from "ton-crypto";
import { createTestClient } from "../utils/createTestClient";
import { TonClient } from "../client/TonClient";

const getExtensionsArray = async (wallet: OpenedContract<WalletContractV5>) => {
    try {
        return await wallet.getExtensionsArray();
    } catch (e) {
        // Handle toncenter bug. Toncenter incorrectly returns 'list' in the stack in case of empty extensions dict
        if (e instanceof Error && e.message === 'Unsupported stack item type: list') {
            return [];
        }
        throw e;
    }
}

describe('WalletContractV5', () => {
    let client: TonClient;
    let walletKey: KeyPair;
    let wallet: OpenedContract<WalletContractV5>;

    beforeEach(() => {
        client = createTestClient();
        walletKey = randomTestKey('v5-treasure');
        wallet = client.open(WalletContractV5.create({ walletId: { networkGlobalId: -3 }, publicKey: walletKey.publicKey }));

    })

    it('should has balance and correct address', async () => {
       const balance = await wallet.getBalance();

        expect(wallet.address.equals(Address.parse('EQDv2B0jPmJZ1j-ne3Ko64eGqfYZRHGQbfSE5pUWVvUdQmDH'))).toBeTruthy();
        expect(balance > 0n).toBe(true);
    });

    it('should perform single transfer', async () => {
        const seqno = await wallet.getSeqno();
        const transfer = wallet.createTransfer({
            seqno,
            secretKey: walletKey.secretKey,
            messages: [internal({
                to: 'EQDQ0PRYSWmW-v6LVHNYq5Uelpr5f7Ct7awG7Lao2HImrCzn',
                value: '0.01',
                body: 'Hello world single transfer!'
            })]
        });

        await wallet.send(transfer);
    });

   it('should perform double transfer', async () => {
        const seqno = await wallet.getSeqno();
        const transfer = wallet.createTransfer({
            seqno,
            secretKey: walletKey.secretKey,
            messages: [internal({
                to: 'EQDQ0PRYSWmW-v6LVHNYq5Uelpr5f7Ct7awG7Lao2HImrCzn',
                value: '0.01',
                body: 'Hello world to extension'
            }), internal({
                to: 'EQAtHiE_vEyAogU1rHcz3uzp64h-yqeFJ2S2ChkKNwygLMk3',
                value: '0.02',
                body: 'Hello world to relayer'
            })]
        });

        await wallet.send(transfer);
    });

    it('should add extension', async () => {
        const extensionKey = randomTestKey('v5-treasure-extension');
        const extensionContract = client.open(WalletContractV5.create({ walletId: { workChain: 0, networkGlobalId: -3 }, publicKey: extensionKey.publicKey }));


        const seqno = await wallet.getSeqno();
        const extensions = await getExtensionsArray(wallet);

        const extensionAlreadyAdded = extensions.some(address => address.equals(extensionContract.address));

        if (!extensionAlreadyAdded) {
            await wallet.sendAddExtension({
                seqno,
                secretKey: walletKey.secretKey,
                extensionAddress: extensionContract.address
            });

            const waitUntilExtensionAdded = async (attempt = 0): Promise<void> => {
                if (attempt >= 10) {
                    throw new Error('Extension was not added in 10 blocks');
                }
                const extensions = await getExtensionsArray(wallet);
                const extensionAdded = extensions.some(address => address.equals(extensionContract.address));
                if (extensionAdded) {
                    return;
                }

                await new Promise(r => setTimeout(r, 1500));
                return waitUntilExtensionAdded(attempt + 1);
            }

            await waitUntilExtensionAdded();
        }

        const extensionsSeqno = await extensionContract.getSeqno();
        await extensionContract.sendTransfer({
            seqno: extensionsSeqno,
            secretKey: extensionKey.secretKey,
            messages: [internal({
                to: wallet.address,
                value: '0.1',
                body: wallet.createTransfer({
                    seqno: seqno + 1,
                    messages: [internal({
                        to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                        value: '0.03',
                        body: 'Hello world from plugin'
                    })]
                })
            })]
        });
    }, 60000);

    it('should remove extension', async () => {
        const extensionKey = randomTestKey('v5-treasure-extension');
        const extensionContract = client.open(WalletContractV5.create({ walletId: { workChain: 0, networkGlobalId: -3 }, publicKey: extensionKey.publicKey }));


        const seqno = await wallet.getSeqno();
        const extensions = await getExtensionsArray(wallet);

        const extensionAlreadyAdded = extensions.some(address => address.equals(extensionContract.address));

        if (extensionAlreadyAdded) {
            await wallet.sendRemoveExtension({
                seqno,
                secretKey: walletKey.secretKey,
                extensionAddress: extensionContract.address
            });
        }
    });

    it('should send internal transfer via relayer', async () => {
        const relaerKey = randomTestKey('v5-treasure-relayer');
        const relayerContract = client.open(WalletContractV5.create({ walletId: { workChain: 0, networkGlobalId: -3 }, publicKey: relaerKey.publicKey }));


        const seqno = await wallet.getSeqno();

        const relayerSeqno = await relayerContract.getSeqno();
        await relayerContract.sendTransfer({
            seqno: relayerSeqno,
            secretKey: relaerKey.secretKey,
            messages: [internal({
                to: wallet.address,
                value: '0.1',
                body: wallet.createTransfer({
                    seqno: seqno,
                    secretKey: walletKey.secretKey,
                    messages: [internal({
                        to: 'kQD6oPnzaaAMRW24R8F0_nlSsJQni0cGHntR027eT9_sgtwt',
                        value: '0.04',
                        body: 'Hello world from relayer'
                    })]
                })
            })]
        });
    });
});
