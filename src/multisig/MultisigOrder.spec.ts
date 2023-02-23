import { beginCell, Cell } from 'ton-core';
import { getSecureRandomBytes, keyPairFromSeed, sign } from 'ton-crypto';
import { testAddress } from 'ton-emulator';
import { createInternalMessage } from './testUtils';
import { MultisigOrderBuilder } from './MultisigOrderBuilder';
import { MultisigWallet } from './MultisigWallet';

describe('Order', () => {
    var publicKeys: Buffer[];
    var secretKeys: Buffer[];

    beforeAll(async () => {
        publicKeys = [];
        secretKeys = [];
        for (let i = 0; i < 10; i += 1) {
            let kp = keyPairFromSeed(await getSecureRandomBytes(32));
            publicKeys.push(kp.publicKey);
            secretKeys.push(kp.secretKey);
        }
    });

    it('should add messages', () => {
        let order = new MultisigOrderBuilder(123);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        expect(order.messages.endCell().refs.length).toEqual(3);
    });

    it('should add signatures', () => {
        let orderBuilder = new MultisigOrderBuilder(123);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        let order = orderBuilder.finishOrder();
        order.sign(0, secretKeys[0]);
        order.sign(1, secretKeys[1]);
        order.sign(2, secretKeys[2]);
        expect(Object.keys(order.signatures)).toHaveLength(3);
    });

    it('should union signatures', () => {
        let order1Builder = new MultisigOrderBuilder(123);
        order1Builder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order1Builder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order1Builder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        let order1 = order1Builder.finishOrder();
        order1.sign(0, secretKeys[0]);
        order1.sign(1, secretKeys[1]);
        order1.sign(2, secretKeys[2]);
        let order2Builder = new MultisigOrderBuilder(123);
        order2Builder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order2Builder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order2Builder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        let order2 = order2Builder.finishOrder();
        order2.sign(3, secretKeys[3]);
        order2.sign(2, secretKeys[2]);
        order2.sign(5, secretKeys[5]);
        order1.unionSignatures(order2);
        expect(Object.keys(order1.signatures)).toHaveLength(5);
    });

    it('should clear signatures', () => {
        let orderBuilder = new MultisigOrderBuilder(123);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        let order = orderBuilder.finishOrder();
        order.sign(0, secretKeys[0]);
        order.sign(1, secretKeys[1]);
        order.sign(2, secretKeys[2]);
        order.clearSignatures();
        expect(order.signatures).toBeNull;
    });

    it('should clear messages', () => {
        let orderBuilder = new MultisigOrderBuilder(123);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        orderBuilder.clearMessages();
        expect(orderBuilder.messages).toEqual(beginCell());
    })

    it('should add signatures without secret key', () => {
        let orderBuilder = new MultisigOrderBuilder(123);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        orderBuilder.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        let order = orderBuilder.finishOrder();
        order.sign(0, secretKeys[0]);
        order.addSignature(1, sign(order.messagesCell.hash(), secretKeys[1]), new MultisigWallet(publicKeys, 0, 123, 2));
        expect(Object.keys(order.signatures)).toHaveLength(2);
    });
});
