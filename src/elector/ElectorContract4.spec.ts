/**
 * Copyright (c) Whales Corp. 
 * All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createTestClient4 } from "../utils/createTestClient4";
import { Address, internal } from "ton-core";
import { ElectorContract4 } from "./ElectorContract4";

let client = createTestClient4("mainnet");
const ec = new ElectorContract4(client);
const KNOWN_BLOCK = 31091335;


describe('ElectorContract4', () => {
    
    it('should return correct past elections list', async () => {
        expect(await ec.getPastElectionsList(KNOWN_BLOCK)).toEqual([ { id: 1689210632, unfreezeAt: 1689308936, stakeHeld: 32768 } ]);
    });

    it('should return correct past elections records', async () => {
        const pastElections = await ec.getPastElections(KNOWN_BLOCK);
        
        expect(pastElections[0].id).toEqual(1689210632);
        expect(pastElections[0].unfreezeAt).toEqual(1689308936);
        expect(pastElections[0].stakeHeld).toEqual(32768);
        expect(pastElections[0].totalStake).toEqual(225866876807023064n);
        expect(pastElections[0].bonuses).toEqual(36694814715610n);
        const knownFrozenValue = pastElections[0].frozen.get('403869299230672796703006364351191686950742896222119560255724029012167972875');
        expect(knownFrozenValue!["address"].equals(Address.parse('Ef9-ttkkYiPuruCZp58Ip1Y87ua_868G_6VYiRPxAZF-gJzd'))).toBe(true);
        expect(knownFrozenValue!["weight"]).toEqual(3881868472023786n);
        expect(knownFrozenValue!["stake"]).toEqual(760490202020000n);

    });

    it('should return correct election entities', async () => {
        const electionEntities = await ec.getElectionEntities(KNOWN_BLOCK);

        expect(electionEntities!.minStake).toEqual(300000000000000n);
        expect(electionEntities!.allStakes).toEqual(237218561486530661n);
        expect(electionEntities!.endElectionsTime).toEqual(1689267976);
        expect(electionEntities!.startWorkTime).toEqual(1689276168);
        expect(electionEntities!.entities[0].pubkey).toEqual(Buffer.from('020a19785bb59d046bf1e62745263cf2cc91e5a47db997249b60c159b19443e7', 'hex'));
        expect(electionEntities!.entities[0].stake).toEqual(380271797094836n);
        expect(electionEntities!.entities[0].address.equals(Address.parse('Ef8W1vCpA1tr9xr6QSXSxcVSdn1Sm7SYX_PCWQdClaWhales'))).toBe(true);
        expect(electionEntities!.entities[0].adnl).toEqual(Buffer.from('1e7a93ab3274c5367c6ab8ea77790ef69df9af53657aa9da883238013aa7c03a', 'hex'));
      
    });
});