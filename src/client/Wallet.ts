import BN from "bn.js";
import { keyPairFromSecretKey } from "ton-crypto";
import { Address, Cell, TonClient } from "..";
import { WalletV1R2Source } from "../contracts/sources/WalletV1R2Source";
import { WalletV1R3Source } from "../contracts/sources/WalletV1R3Source";
import { WalletV2R1Source } from "../contracts/sources/WalletV2R1Source";
import { WalletV2R2Source } from "../contracts/sources/WalletV2R2Source";
import { WalletV3R1Source } from "../contracts/sources/WalletV3R1Source";
import { WalletV3R2Source } from "../contracts/sources/WalletV3R2Source";
import { WalletContract } from "../contracts/WalletContract";
import { CommonMessageInfo } from "../messages/CommonMessageInfo";
import { InternalMessage } from "../messages/InternalMessage";

export type WalletContractType =
    | 'org.ton.wallets.simple'
    | 'org.ton.wallets.simple.r2'
    | 'org.ton.wallets.simple.r3'
    | 'org.ton.wallets.v2'
    | 'org.ton.wallets.v2.r2'
    | 'org.ton.wallets.v3'
    | 'org.ton.wallets.v3.r2';

// Wallet Contract Priority
const allTypes: WalletContractType[] = [
    'org.ton.wallets.simple.r2',
    'org.ton.wallets.simple.r3',
    'org.ton.wallets.v2',
    'org.ton.wallets.v2.r2',
    'org.ton.wallets.v3.r2', // We prefer r1 instead of r2
    'org.ton.wallets.v3'
];

async function createContract(client: TonClient, type: WalletContractType, publicKey: Buffer, workchain: number) {
    if (type === 'org.ton.wallets.simple') {
        throw Error('Unsupported wallet');
    } else if (type === 'org.ton.wallets.simple.r2') {
        return await WalletContract.create(client, WalletV1R2Source.create({ publicKey, workchain }));
    } else if (type === 'org.ton.wallets.simple.r3') {
        return await WalletContract.create(client, WalletV1R3Source.create({ publicKey, workchain }));
    } else if (type === 'org.ton.wallets.v2') {
        return await WalletContract.create(client, WalletV2R1Source.create({ publicKey, workchain }));
    } else if (type === 'org.ton.wallets.v2.r2') {
        return await WalletContract.create(client, WalletV2R2Source.create({ publicKey, workchain }));
    } else if (type === 'org.ton.wallets.v3') {
        return await WalletContract.create(client, WalletV3R1Source.create({ publicKey, workchain }));
    } else if (type === 'org.ton.wallets.v3.r2') {
        return await WalletContract.create(client, WalletV3R2Source.create({ publicKey, workchain }));
    } else {
        throw Error('Unknown wallet type: ' + type);
    }
}

export class Wallet {

    static open(client: TonClient, address: Address) {
        return new Wallet(client, address);
    }

    static async findActiveBySecretKey(client: TonClient, workchain: number, secretKey: Buffer): Promise<{ address: Address, type: WalletContractType, deployed: boolean, balance: number }[]> {
        const publicKey = keyPairFromSecretKey(secretKey).publicKey;
        let types: { address: Address, type: WalletContractType, deployed: boolean, balance: number }[] = [];
        for (let type of allTypes) {
            let contra = await createContract(client, type, publicKey, workchain);
            let deployed = await client.isContractDeployed(contra.address);
            let balance = await client.getBalance(contra.address);
            if (deployed || balance > 0) {
                types.push({ address: contra.address, type, balance, deployed });
            }
        }
        return types;
    }

    static async findBestBySecretKey(client: TonClient, workchain: number, secretKey: Buffer): Promise<Wallet> {
        const publicKey = keyPairFromSecretKey(secretKey).publicKey;
        let allActive = await this.findActiveBySecretKey(client, workchain, secretKey);

        // Create default one if no wallet exists
        if (allActive.length === 0) {
            let c = await createContract(client, 'org.ton.wallets.v3', publicKey, workchain);
            let w = new Wallet(client, c.address);
            await w.prepare(workchain, publicKey, 'org.ton.wallets.v3');
            return w;
        }

        // Try to match with biggest balance
        let maxBalance = allActive[0].balance;
        let bestContract = allActive[0].type;
        for (let i = 1; i < allActive.length; i++) {
            let ac = allActive[i];
            // Contracts are sorted by priority
            if (ac.balance >= maxBalance) {
                maxBalance = ac.balance;
                bestContract = ac.type;
            }
        }
        if (maxBalance > 0) {
            let c = await createContract(client, bestContract, publicKey, workchain);;
            let w = new Wallet(client, c.address);
            await w.prepare(workchain, publicKey, bestContract);
            return w;
        }

        // Return last (as most recent)
        let c = await createContract(client, allActive[allActive.length - 1].type, publicKey, workchain);
        let w = new Wallet(client, c.address);
        await w.prepare(workchain, publicKey, allActive[allActive.length - 1].type);
        return w;
    }

    readonly #client: TonClient;
    readonly address: Address;

    #contract: WalletContract | null = null;
    get prepared() {
        return !!this.#contract;
    }

    private constructor(client: TonClient, address: Address) {
        this.#client = client;
        this.address = address;
    }

    async getSeqNo() {
        if (await this.#client.isContractDeployed(this.address)) {
            let res = await this.#client.callGetMethod(this.address, 'seqno');
            return parseInt(res.stack[0][1], 16);
        } else {
            return 0;
        }
    }

    async prepare(workchain: number, publicKey: Buffer, type: WalletContractType = 'org.ton.wallets.v3') {
        let contra = await createContract(this.#client, type, publicKey, workchain);
        if (!contra.address.equals(this.address)) {
            throw Error('Contract have different address');
        }
        this.#contract = contra;
    }

    /**
     * Transfers value to specified address
     */
    async transfer(args: { seqno: number, to: Address, value: BN, secretKey: Buffer }) {
        const contract = this.#contract;
        if (!contract) {
            throw Error('Please, prepare wallet first');
        }

        // Check if deployed
        let deployed = await this.#client.isContractDeployed(args.to);

        // Check transfer
        const transfer = await contract.createTransfer({
            secretKey: args.secretKey,
            seqno: args.seqno,
            sendMode: 3,
            order: new InternalMessage({
                to: args.to,
                value: args.value,
                bounce: deployed,
                body: new CommonMessageInfo()
            })
        });

        // Send
        await this.#client.sendExternalMessage(contract, transfer);
    }

    /**
     * Fetching required information for transfer
     * @param to address to transfer values to
     * @returns required bounce and seqno values
     */
    async transferPrepare(to: Address) {
        let bounce = this.#client.isContractDeployed(to);
        let seqno = this.getSeqNo();
        return {
            bounce: await bounce,
            seqno: await seqno
        };
    }

    /**
     * Signing transfer request. Could be done offline.
     * @param args sign
     * @returns 
     */
    async transferSign(args: {
        to: Address,
        bounce: boolean,
        seqno: number,
        value: BN,
        type: WalletContractType,
        secretKey: Buffer
    }) {
        const contract = this.#contract;
        if (!contract) {
            throw Error('Please, prepare wallet first');
        }

        const transfer = await contract.createTransfer({
            secretKey: args.secretKey,
            seqno: args.seqno,
            sendMode: 3,
            order: new InternalMessage({
                to: args.to,
                value: args.value,
                bounce: args.bounce,
                body: new CommonMessageInfo()
            })
        });

        return transfer;
    }

    /**
     * Commit prepared transfer
     * @param transfer signed transfer for commit
     */
    async transferCommit(transfer: Cell) {
        const contract = this.#contract;
        if (!contract) {
            throw Error('Please, prepare wallet first');
        }
        await this.#client.sendExternalMessage(contract, transfer);
    }
}