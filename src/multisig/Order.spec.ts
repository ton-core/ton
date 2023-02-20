import { beginCell, Cell } from 'ton-core';
import { getSecureRandomBytes, keyPairFromSeed } from 'ton-crypto';
import { testAddress } from 'ton-emulator';
import { createInternalMessage } from './testUtils';
import { Order } from './Order';

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
        let order = new Order(123);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        expect(order.messages.endCell().refs.length).toEqual(3);
    });

    it('should add signatures', () => {
        let order = new Order(123);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        order.addSignature(0, secretKeys[0]);
        order.addSignature(1, secretKeys[1]);
        order.addSignature(2, secretKeys[2])
        expect(Object.keys(order.signatures)).toHaveLength(3);
    });

    it('should union signatures', () => {
        let order1 = new Order(123)
        order1.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order1.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order1.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        order1.addSignature(0, secretKeys[0]);
        order1.addSignature(1, secretKeys[1]);
        order1.addSignature(2, secretKeys[2]);
        let order2 = new Order(123);
        order2.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order2.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order2.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        order2.addSignature(3, secretKeys[3]);
        order2.addSignature(2, secretKeys[2]);
        order2.addSignature(5, secretKeys[5]);
        order1.unionSignatures(order2);
        expect(Object.keys(order1.signatures)).toHaveLength(5);
    });

    it('should clear signatures', () => {
        let order = new Order(123);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        order.addSignature(0, secretKeys[0]);
        order.addSignature(1, secretKeys[1]);
        order.addSignature(2, secretKeys[2]);
        order.clearSignatures();
        expect(order.signatures).toBeNull;
    });

    it('should clear messages', () => {
        let order = new Order(123);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 1000000000n, Cell.EMPTY), 3);
        order.addMessage(createInternalMessage(true, testAddress('address2'), 0n, beginCell().storeUint(3, 123).endCell()), 3);
        order.addMessage(createInternalMessage(true, testAddress('address1'), 2000000000n, Cell.EMPTY), 3);
        order.addSignature(0, secretKeys[0]);
        order.addSignature(1, secretKeys[1]);
        order.addSignature(2, secretKeys[2]);
        order.clearMessages();
        expect(order.messages).toEqual(beginCell());
        expect(order.signatures).toBeNull;
    });
});
