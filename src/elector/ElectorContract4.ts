import { Address, ADNLAddress, BitBuilder, Cell, Contract, TupleReader, Dictionary, DictionaryValue, Slice, Builder } from "ton-core";
import { TonClient4 } from '../client/TonClient4';


class FrozenDictValue implements DictionaryValue<{ address: Address, weight: bigint, stake: bigint }> {
    public serialize(src: any, builder: Builder): void {
        throw Error("not implemented")
    }
    parse(src: Slice): { address: Address, weight: bigint, stake: bigint } {
        const address = new Address(-1, src.loadBuffer(32));
        const weight = src.loadUintBig(64);
        const stake = src.loadCoins();
        return { address, weight, stake}
    }
}

class EntitiesDictValue implements DictionaryValue<{ stake: bigint, address: Address, adnl: Buffer }> {
    public serialize(src: any, builder: Builder): void {
        throw Error("not implemented")
    }
    parse(src: Slice): { stake: bigint, address: Address, adnl: Buffer } {
        const stake = src.loadCoins();
        // skip time and maxFactor
        src.skip(64);
        const address = new Address(-1, src.loadBuffer(32));
        const adnl = src.loadBuffer(32);
        return { stake, address, adnl}
    }
}


export class ElectorContract4 implements Contract {


    /**
     * Create election request message to be signed
     */
    static createElectionRequest(args: {
        validator: Address,
        electionTime: number,
        maxFactor: number,
        adnlAddress: ADNLAddress
    }) {
        if (args.validator.workChain !== -1) {
            throw Error('Only masterchain could participate in elections');
        }

        const res = new BitBuilder(1024);
        // const res = BitString.alloc(1024);
        res.writeBuffer(Buffer.from('654c5074', 'hex'));
        res.writeUint(args.electionTime, 32);
        res.writeUint(Math.floor(args.maxFactor * 65536), 32);
        res.writeBuffer(args.validator.hash);
        res.writeBuffer(args.adnlAddress.address);
        return res.build();
    }

    // This method seems to be obsolete

    // /**
    //  * Signing election request
    //  */
    // static signElectionRequest(args: {
    //     request: Buffer,
    //     key: Buffer
    // }) {
    //     return sign(args.request, args.key);
    // }



    // This method seems to be obsolete

    // /**
    //  * Create election request message
    //  */
    // static createElectionRequestSigned(args: {
    //     validator: Address,
    //     electionTime: number,
    //     maxFactor: number,
    //     adnlAddress: ADNLAddress,
    //     publicKey: Buffer,
    //     signature: Buffer,
    //     queryId: BN
    // }): Message {
    //     const request = ElectorContract4.createElectionRequest({ validator: args.validator, electionTime: args.electionTime, maxFactor: args.maxFactor, adnlAddress: args.adnlAddress });
    //     if (!signVerify((request.subbuffer(0, request.length) as Buffer), args.signature, args.publicKey)) {
    //         throw Error('Invalid signature');
    //     }

    //     const cell = beginCell()
    //     .storeBuffer(Buffer.from('4e73744b', 'hex'))
    //     .storeUint(args.queryId, 64)
    //     .storeBuffer(args.publicKey)
    //     .storeUint(args.electionTime, 32)
    //     .storeUint(Math.floor(args.maxFactor * 65536), 32)
    //     .storeBuffer(args.adnlAddress.address)
    //     .endCell();
    //     const sig = beginCell().storeBuffer(args.signature).endCell();
    //     cell.refs.push(sig);

    //     // const cell = new Cell();
    //     // cell.bits.writeBuffer(Buffer.from('4e73744b', 'hex'));
    //     // cell.bits.writeUint(args.queryId, 64);
    //     // cell.bits.writeBuffer(args.publicKey);
    //     // cell.bits.writeUint(args.electionTime, 32);
    //     // cell.bits.writeUint(Math.floor(args.maxFactor * 65536), 32);
    //     // cell.bits.writeBuffer(args.adnlAddress.address);
    //     // const sig = new Cell();
    //     // sig.bits.writeBuffer(args.signature);
    //     // cell.refs.push(sig);
    //     return new CellMessage(cell);
    // }

    /**
     * Create recover stake message
     */
    static createRecoverStakeMessage(args: { queryId: bigint }) {
        // const res = BitString.alloc(1024);
        const res = new BitBuilder(1024);
        res.writeBuffer(Buffer.from('47657424', 'hex'));
        res.writeUint(args.queryId, 64);
        return res.build();
    }

    // /**
    //  * Parsing complaints
    //  * @param src source object
    //  */
    // static parseComplaints(src: any[]) {
    //     const data = src[0][1].elements;
    //     const results: {
    //         id: bigint,
    //         publicKey: Buffer,
    //         createdAt: number,
    //         severity: number,
    //         paid: bigint,
    //         suggestedFine: bigint,
    //         suggestedFinePart: bigint,
    //         rewardAddress: Address,
    //         votes: number[],
    //         remainingWeight: bigint,
    //         vsetId: bigint
    //     }[] = [];
    //     for (let record of data) {
    //         const elements = record.tuple.elements;
    //         const id = BigInt(elements[0].number.number as string);
    //         const complaint = elements[1].tuple.elements[0].tuple.elements;
    //         const votersList = elements[1].tuple.elements[1].list.elements;
    //         const vsetIdRaw = elements[1].tuple.elements[2];
    //         const weightRemaining = elements[1].tuple.elements[3];

    //         let publicKeyRaw = new BN(complaint[0].number.number, 10).toString('hex');
    //         while (publicKeyRaw.length < 64) {
    //             publicKeyRaw = '0' + publicKeyRaw;
    //         }
    //         const publicKey = Buffer.from(publicKeyRaw, 'hex');
    //         const description = Cell.fromBoc(Buffer.from(complaint[1].cell.bytes, 'base64'))[0];
    //         const createdAt = parseInt(complaint[2].number.number, 10);
    //         const severity = parseInt(complaint[3].number.number, 10);
    //         let rewardAddressRaw = new BN(complaint[4].number.number, 10).toString('hex');
    //         while (rewardAddressRaw.length < 64) {
    //             rewardAddressRaw = '0' + rewardAddressRaw;
    //         }
    //         const rewardAddress = new Address(-1, Buffer.from(rewardAddressRaw, 'hex'));
    //         const paid = BigInt(complaint[5].number.number);
    //         const suggestedFine = BigInt(complaint[6].number.number);
    //         const suggestedFinePart = BigInt(complaint[7].number.number);

    //         const votes: number[] = [];
    //         for (let v of votersList) {
    //             votes.push(parseInt(v.number.number, 10));
    //         }

    //         const remainingWeight = BigInt(weightRemaining.number.number);
    //         const vsetId = BigInt(vsetIdRaw.number.number);

    //         results.push({
    //             id,
    //             publicKey,
    //             createdAt,
    //             severity,
    //             paid,
    //             suggestedFine,
    //             suggestedFinePart,
    //             rewardAddress,
    //             votes,
    //             remainingWeight,
    //             vsetId
    //         });
    //     }
    //     return results;
    // }

    // Please note that we are NOT loading address from config to avoid mistake and send validator money to a wrong contract
    readonly address: Address = Address.parseRaw('-1:3333333333333333333333333333333333333333333333333333333333333333');
    //readonly source: ContractSource = new UnknownContractSource('org.ton.elector', -1, 'Elector Contract');
    private readonly client: TonClient4;

    constructor(client: TonClient4) {
        this.client = client;
    }

    async getReturnedStake(block: number, address: Address): Promise<bigint> {
        if (address.workChain !== -1) {
            throw Error('Only masterchain addresses could have stake');
        }
        let res = await this.client.runMethod(block, this.address, 'compute_returned_stake', [{ type: 'int', value: BigInt('0x' + address.hash.toString('hex')) }]);
        if (res.exitCode !== 0 && res.exitCode !== 1) {
            throw Error('Exit code: ' + res.exitCode);
        }
        let tuple = new TupleReader(res.result);
        return tuple.readBigNumber();
    }

    async getPastElectionsList(block: number) {
        let res = await this.client.runMethod(block, this.address, 'past_elections_list');
        if (res.exitCode !== 0 && res.exitCode !== 1) {
            throw Error('Exit code: ' + res.exitCode);
        }
        let tuple = new TupleReader(res.result);
        tuple = tuple.readTuple();
        let count = tuple.remaining - 1;

        const elections: { id: number, unfreezeAt: number, stakeHeld: number }[] = [];
        for (let i = 0; i < count; i++) {
            const v = tuple.readTuple();
            const id = v.readNumber();
            const unfreezeAt = v.readNumber();
            v.pop(); // Ignore
            const stakeHeld = v.readNumber();
            elections.push({ id, unfreezeAt, stakeHeld });
        }
        return elections;
    }

    async getPastElections(block: number) {
        const res = await this.client.runMethod(block, this.address, 'past_elections');
        if (res.exitCode !== 0 && res.exitCode !== 1) {
            throw Error('Exit code: ' + res.exitCode);
        }
        let tuple = new TupleReader(res.result);
        tuple = tuple.readTuple();
        let count = tuple.remaining - 1;
        const elections: { id: number, unfreezeAt: number, stakeHeld: number, totalStake: bigint, bonuses: bigint, frozen: Map<string, { address: Address, weight: bigint, stake: bigint }> }[] = [];
        for (let i = 0; i < count; i++) {
            const v = tuple.readTuple();
            const id = v.readNumber();
            const unfreezeAt = v.readNumber();
            const stakeHeld = v.readNumber();
            v.pop(); // Ignore vset_hash
            const frozenDict = v.readCell();
            const totalStake = v.readBigNumber();
            const bonuses = v.readBigNumber();
            let frozen: Map<string, { address: Address, weight: bigint, stake: bigint }> = new Map();
            const frozenData = frozenDict.beginParse().loadDictDirect(
                Dictionary.Keys.Buffer(32),
                new FrozenDictValue
            );
            for (const [key, value] of frozenData) {
                frozen.set(
                    BigInt("0x" + key.toString("hex")).toString(10),
                    { address: value["address"], weight: value["weight"], stake: value["stake"]}
                )
            }
            elections.push({ id, unfreezeAt, stakeHeld, totalStake, bonuses, frozen });
        }
        return elections;
    }

    async getElectionEntities(block: number) {

        //
        // NOTE: this method doesn't call get method since for some reason it doesn't work
        //

        const account = await this.client.getAccount(block, this.address);
        if (account.account.state.type !== 'active') {
            throw Error('Unexpected error');
        }

        const cell = Cell.fromBoc(Buffer.from(account.account.state.data!, 'base64'))[0];
        const cs = cell.beginParse();
        if (!cs.loadBit()) {
            return null;
        }
        // (es~load_uint(32), es~load_uint(32), es~load_grams(), es~load_grams(), es~load_dict(), es~load_int(1), es~load_int(1));
        const sc = cs.loadRef().beginParse();
        const startWorkTime = sc.loadUint(32);
        const endElectionsTime = sc.loadUint(32);
        const minStake = sc.loadCoins();
        const allStakes = sc.loadCoins();
        // var (stake, time, max_factor, addr, adnl_addr) = (cs~load_grams(), cs~load_uint(32), cs~load_uint(32), cs~load_uint(256), cs~load_uint(256));
        const entitiesData = sc.loadDict(Dictionary.Keys.Buffer(32), new EntitiesDictValue);
        let entities: { pubkey: Buffer, stake: bigint, address: Address, adnl: Buffer }[] = [];
        // const failed = sc.loadBit();
        // const finished = sc.loadBit();

        if (entitiesData) {
            for (const [key, value] of entitiesData) {
                entities.push({ pubkey: key, stake: value["stake"], address: value["address"], adnl: value["adnl"] });
            }
        }
        return { minStake, allStakes, endElectionsTime, startWorkTime, entities };
    }

    async getActiveElectionId(block: number) {
        const res = await this.client.runMethod(block, this.address, 'active_election_id');
        if (res.exitCode !== 0 && res.exitCode !== 1) {
            throw Error('Exit code: ' + res.exitCode);
        }
        const tuple = new TupleReader(res.result);
        const electionId = tuple.readNumber();
        return electionId > 0 ? electionId : null;
    }

    // async getComplaints(block: number, electionId: number) {
    //     let res = await this.client.callGetMethod(this.address, 'list_complaints', [['num', electionId]]);
    //     return ElectorContract4.parseComplaints(res.stack);
    // }
}