/**
 * Copyright (c) Whales Corp. 
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createTestClient4 } from "../utils/createTestClient4";
import { Address } from "ton-core";
import { configParse5, configParse13, configParse17, configParse18, configParseValidatorSet, configParseBridge, configParse12, parseFullConfig, loadConfigParamById, loadConfigParamsAsSlice } from "./ConfigParser";

const client = createTestClient4("mainnet");
const KNOWN_BLOCK = 31091335;

describe('ElectorContract4', () => {

    // for some reason api returns 500 for this reques
    // it('should return correct burning config', async () => {
    //     const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [13])).config.cell;
    //     const config13 = configParse13(loadConfigParamById(srializedConfigsCell, 13).beginParse());

    //     console.log(config13);

    // });

    it('should return correct complaint pricing', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [5])).config.cell;
        const config5 = configParse5(loadConfigParamById(srializedConfigsCell, 5).beginParse());

        expect(config5!.blackholeAddr!.equals(Address.parse('Ef___________________________________________7Sg'))).toBe(true);
        expect(config5!.feeBurnNominator).toEqual(1);
        expect(config5!.feeBurnDenominator).toEqual(2);
    });

    it('should return correct workckain description', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [12])).config.cell;
        const config12 = configParse12(loadConfigParamById(srializedConfigsCell, 12).beginParse());

        expect(config12!.get(0)).toEqual({
            enabledSince: 1573821854,
            actialMinSplit: 0,
            min_split: 0,
            max_split: 4,
            basic: true,
            active: true,
            accept_msgs: true,
            flags: 0,
            zerostateRootHash: Buffer.from('55b13f6d0e1d0c34c9c2160f6f918e92d82bf9ddcf8de2e4c94a3fdf39d15446', 'hex'),
            zerostateFileHash: Buffer.from('ee0bedfe4b32761fb35e9e1d8818ea720cad1a0e7b4d2ed673c488e72e910342', 'hex'),
            version: 0,
            format: {
                vmMode: 16140901064495857664n,
                vmVersion: 1073741823,
            },
            
        });
    });
    
    it('should return correct config17', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [17])).config.cell;
        const config17 = configParse17(loadConfigParamById(srializedConfigsCell, 17).beginParse());

        expect(config17).toEqual({
            minStake: 300000000000000n,
            maxStake: 10000000000000000n,
            minTotalStake: 75000000000000000n,
            maxStakeFactor: 196608
        });
    });

    it('should return correct config18', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [18])).config.cell;
        const config18 = configParse18(loadConfigParamById(srializedConfigsCell, 18).beginParse());

        expect(config18[0]).toEqual({
            utime_since: 0,
            bit_price_ps: 1n,
            cell_price_ps: 500n,
            mc_bit_price_ps: 1000n,
            mc_cell_price_ps: 500000n
        });
    });

    it('should return correct prevValidators', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [32])).config.cell;
        const config32 = configParseValidatorSet(loadConfigParamById(srializedConfigsCell, 32).beginParse());

        expect(config32!.timeSince).toEqual(1689145096);
        expect(config32!.timeUntil).toEqual(1689210632);
        expect(config32!.total).toEqual(331);
        expect(config32!.main).toEqual(100);
        expect(config32!.totalWeight).toEqual(1152921504606846812n);
        expect(config32!.list.get(0)).toEqual({
            publicKey: Buffer.from('9828e815ea69180cac1ae2b02f15f285a9cef71ec11c7709acc31128a303448c', 'hex'),
            weight: 5077814413300977n,
            adnlAddress: Buffer.from('e2e5cadaa61c6d84f86a3618d496ea0bd98c79edc796af9895b82fb83cb666b9', 'hex')
        });
    });

    it('should return correct ethereum bridge', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK, [71])).config.cell;
        const config71 = configParseBridge(loadConfigParamById(srializedConfigsCell, 71).beginParse());

        expect(config71!.bridgeAddress.equals(Address.parse('Ef_dJMSh8riPi3BTUTtcxsWjG8RLKnLctNjAM4rw8NN-xWdr'))).toBe(true);
        expect(config71!.oracleMultisigAddress.equals(Address.parse('Ef87m7_QrVM4uXAPCDM4DuF9Rj5Rwa5nHubwiQG96JmyAjQY'))).toBe(true);
        expect(config71!.oracles.get('Ef8DfObDUrNqz66pr_7xMbUYckUFbIIvRh1FSNeVSLWrvo1M')).toEqual(Buffer.from('000000000000000000000000cf4a7c26186aa41390e246fa04115a0495085ab9', 'hex'));
        expect(config71!.externalChainAddress).toEqual(Buffer.from('000000000000000000000000582d872a1b094fc48f5de31d3b73f2d9be47def1', 'hex'));

    });

    it('should not reise error when loading full config', async () => {
        const srializedConfigsCell = (await client.getConfig(KNOWN_BLOCK)).config.cell;
        parseFullConfig(loadConfigParamsAsSlice(srializedConfigsCell));
    });
});