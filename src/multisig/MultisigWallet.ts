/* Made by @Gusarich and @Miandic */

import { TonClient } from '../index';
import { keyPairFromSecretKey, sign } from 'ton-crypto';
import {
    Address,
    beginCell,
    Cell,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    Slice,
    StateInit,
} from 'ton-core';
import { MultisigOrder } from './MultisigOrder';

const MULTISIG_CODE = Cell.fromBase64(
    'te6ccgECKwEABBgAART/APSkE/S88sgLAQIBIAIDAgFIBAUE2vIgxwCOgzDbPOCDCNcYIPkBAdMH2zwiwAAToVNxePQOb6Hyn9s8VBq6+RDyoAb0BCD5AQHTH1EYuvKq0z9wUwHwCgHCCAGDCryx8mhTFYBA9A5voSCYDqQgwgryZw7f+COqH1NAufJhVCOjU04gIyEiAgLMBgcCASAMDQIBIAgJAgFmCgsAA9GEAiPymAvHoHN9CYbZ5S7Z4BPHohwhJQAtAKkItdJEqCTItdKlwLUAdAT8ArobBKAATwhbpEx4CBukTDgAdAg10rDAJrUAvALyFjPFszJ4HHXI8gBzxb0AMmACASAODwIBIBQVARW77ZbVA0cFUg2zyCoCAUgQEQIBIBITAXOxHXQgwjXGCD5AQHTB4IB1MTtQ9hTIHj0Dm+h8p/XC/9eMfkQ8qCuAfQEIW6TW3Ey4PkBWNs8AaQBgJwA9rtqA6ADoAPoCAXoCEfyAgPyA3XlP+AXkegAA54tkwAAXrhlXP8EA1WZ2oexAAgEgFhcCASAYGQFRtyVbZ4YmRmpGEAgegc30McJNhFpAADMaYeYuAFrgJhwLb+4cC3d0bhAjAYm1WZtnhqvgb+2xxsoicAgej430pBHEoFpAADHDhBACGuQkuuBk9kUWE5kAOeLKhACQCB6IYFImHFImHFImXEA2YlzNijAjAgEgGhsAF7UGtc4QQDVZnah7EAIBIBwdAgOZOB4fARGsGm2eL4G2CUAjABWt+UEAzJV2oewYQAENqTbPBVfBYCMAFa3f3CCAarM7UPYgAiDbPALyZfgAUENxQxPbPO1UIyoACtP/0wcwBKDbPC+uUyCw8mISsQKkJbNTHLmwJYEA4aojoCi8sPJpggGGoPgBBZcCERACPj4wjo0REB/bPEDXePRDEL0F4lQWW1Rz51YQU9zbPFRxClR6vCQlKCYAIO1E0NMf0wfTB9M/9AT0BNEAXgGOGjDSAAHyo9MH0wdQA9cBIPkBBfkBFbrypFAD4GwhIddKqgIi10m68qtwVCATAAwByMv/ywcE1ts87VT4D3AlblOJvrGYEG4QLVDHXwePGzBUJANQTds8UFWgRlAQSRA6SwlTuds8UFQWf+L4AAeDJaGOLCaAQPSWb6UglDBTA7neII4WODk5CNIAAZfTBzAW8AcFkTDifwgHBZJsMeKz5jAGKicoKQBgcI4pA9CDCNcY0wf0BDBTFnj0Dm+h8qXXC/9URUT5EPKmrlIgsVIDvRShI27mbCIyAH5SML6OIF8D+ACTItdKmALTB9QC+wAC6DJwyMoAQBSAQPRDAvAHjhdxyMsAFMsHEssHWM8BWM8WQBOAQPRDAeIBII6KEEUQNEMA2zztVJJfBuIqABzIyx/LB8sHyz/0APQAyQ=='
);

export class MultisigWallet {
    public owners: Dictionary<number, Buffer>;
    public workchain: number;
    public walletId: number;
    public k: number;
    public address: Address;
    public provider: ContractProvider | null = null;
    public init: StateInit;

    constructor(
        publicKeys: Buffer[],
        workchain: number,
        walletId: number,
        k: number,
        opts?: {
            address?: Address;
            provider?: ContractProvider;
            client?: TonClient;
        }
    ) {
        this.owners = Dictionary.empty();
        this.workchain = workchain;
        this.walletId = walletId;
        this.k = k;
        for (let i = 0; i < publicKeys.length; i += 1) {
            this.owners.set(i, Buffer.concat([publicKeys[i], Buffer.alloc(1)]));
        }
        this.init = {
            code: MULTISIG_CODE,
            data: beginCell()
                .storeUint(this.walletId, 32)
                .storeUint(this.owners.size, 8)
                .storeUint(this.k, 8)
                .storeUint(0, 64)
                .storeDict(
                    this.owners,
                    Dictionary.Keys.Uint(8),
                    Dictionary.Values.Buffer(33)
                )
                .storeBit(0)
                .endCell(),
        };
        this.address = opts?.address || contractAddress(workchain, this.init);
        if (opts?.provider) {
            this.provider = opts.provider;
        } else if (opts?.client) {
            this.provider = opts.client.provider(this.address, {
                code: this.init.code!,
                data: this.init.data!,
            });
        }
    }

    static async fromAddress(
        address: Address,
        opts: { provider?: ContractProvider; client?: TonClient }
    ): Promise<MultisigWallet> {
        let provider: ContractProvider;
        if (opts.provider) {
            provider = opts.provider;
        } else {
            if (!opts.client) {
                throw Error('Either provider or client must be specified');
            }
            provider = opts.client.provider(address, {
                code: null,
                data: null,
            });
        }

        const contractState = (await provider.getState()).state;
        if (contractState.type !== 'active') {
            throw Error('Contract must be active');
        }

        const data: Slice = Cell.fromBoc(contractState.data!)[0].beginParse();
        const walletId: number = data.loadUint(32);
        data.skip(8);
        const k: number = data.loadUint(8);
        data.skip(64);
        const owners = data.loadDict(
            Dictionary.Keys.Uint(8),
            Dictionary.Values.Buffer(33)
        );
        let publicKeys: Buffer[] = [];
        for (const [key, value] of owners) {
            const publicKey = value.subarray(0, 32);
            publicKeys.push(publicKey);
        }

        return new MultisigWallet(publicKeys, address.workChain, walletId, k, {
            address,
            provider,
            client: opts.client,
        });
    }

    public async deployExternal(provider?: ContractProvider) {
        if (!provider && !this.provider) {
            throw Error('you must specify provider if there is no such property in MultisigWallet instance');
        }
        if (!provider) {
            provider = this.provider!;
        }
        await provider.external(Cell.EMPTY);
    }

    public async deployInternal(sender: Sender, value: bigint = 1000000000n) {
        await sender.send({
            sendMode: 3,
            to: this.address,
            value: value,
            init: this.init,
            body: Cell.EMPTY,
            bounce: true,
        });
    }

    public async sendOrder(
        order: MultisigOrder,
        secretKey: Buffer,
        provider?: ContractProvider
    ) {
        if (!provider && !this.provider) {
            throw Error('you must specify provider if there is no such property in MultisigWallet instance');
        }
        if (!provider) {
            provider = this.provider!;
        }

        let publicKey: Buffer = keyPairFromSecretKey(secretKey).publicKey;
        let ownerId: number = this.getOwnerIdByPubkey(publicKey);
        let cell = order.toCell(ownerId);

        let signature = sign(cell.hash(), secretKey);
        cell = beginCell()
            .storeBuffer(signature)
            .storeSlice(cell.asSlice())
            .endCell();

        await provider.external(cell);
    }

    public async sendOrderWithoutSecretKey(
        order: MultisigOrder,
        signature: Buffer,
        ownerId: number,
        provider?: ContractProvider
    ) {
        if (!provider && !this.provider) {
            throw Error(
                'you must specify provider if there is no such property in MultisigWallet instance'
            );
        }
        if (!provider) {
            provider = this.provider!;
        }

        let cell = order.toCell(ownerId);

        cell = beginCell()
            .storeBuffer(signature)
            .storeSlice(cell.asSlice())
            .endCell();

        await provider.external(cell);
    }

    public getOwnerIdByPubkey(publicKey: Buffer) {
        for (const [key, value] of this.owners) {
            if (value.subarray(0, 32).equals(publicKey)) {
                return key;
            }
        }
        throw Error('public key is not an owner');
    }
}
