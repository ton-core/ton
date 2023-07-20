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
const BLOCK_WITH_TWO_PAST_ELECTIONS_ENTRIES = 30910280;
const BLOCK_WITH_COMPLAINTS = 20579335;
const ELECTIONS_ID_WITH_COMPLAUINTS = 1652554259;


describe('ElectorContract4', () => {

    it('should return correct past elections list', async () => {
        expect(await ec.getPastElectionsList(BLOCK_WITH_TWO_PAST_ELECTIONS_ENTRIES)).toEqual([
            { id: 1688555272, unfreezeAt: 1688653586, stakeHeld: 32768 },
            { id: 1688620808, unfreezeAt: 1688719112, stakeHeld: 32768 }
        ]);
    });

    it('should return correct past elections records', async () => {
        const pastElections = await ec.getPastElections(BLOCK_WITH_TWO_PAST_ELECTIONS_ENTRIES);

        expect(pastElections[0].id).toEqual(1688555272);
        expect(pastElections[0].unfreezeAt).toEqual(1688653586);
        expect(pastElections[0].stakeHeld).toEqual(32768);
        expect(pastElections[0].totalStake).toEqual(223347831720943192n);
        expect(pastElections[0].bonuses).toEqual(53066684997045n);
        const knownFrozenValue0 = pastElections[0].frozen.get('12697811587540651918746850816771244166804229135431506663207437025351429985');
        expect(knownFrozenValue0!["address"].equals(Address.parse('Ef-vmU4VjsKZhFfEvB-N_fXY8zcyH4ih6n9DcMtIAsy3YezN'))).toBe(true);
        expect(knownFrozenValue0!["weight"]).toEqual(4395984999565357n);
        expect(knownFrozenValue0!["stake"]).toEqual(851605000000000n);

        expect(pastElections[1].id).toEqual(1688620808);
        expect(pastElections[1].unfreezeAt).toEqual(1688719112);
        expect(pastElections[1].stakeHeld).toEqual(32768);
        expect(pastElections[1].totalStake).toEqual(223158712619365653n);
        expect(pastElections[1].bonuses).toEqual(15934890731182n);
        const knownFrozenValue1 = pastElections[1].frozen.get('216824161582481026645351194108767366817492989435791853445305829924424560264');
        expect(knownFrozenValue1!["address"].equals(Address.parse('Ef_9j3g_jktlWpkCvQaEZ0qZ8qJH_fvyehUEAh0h5hZ1hCD6'))).toBe(true);
        expect(knownFrozenValue1!["weight"]).toEqual(2114850227378530n);
        expect(knownFrozenValue1!["stake"]).toEqual(409348990576338n);
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

    it('should return correct election entities', async () => {
        const complaints = await ec.getComplaints(BLOCK_WITH_COMPLAINTS, ELECTIONS_ID_WITH_COMPLAUINTS);
        expect(complaints[0].rewardAddress.equals(Address.parse('Ef9X6ObXojpUZza3NiS2TnRJ4KR7ler8cOjMRBt_swy4Qp2j'))).toBe(true);
        const actual = [];
        for (let index = 0; index < complaints.length; index++) {
            const i = complaints[index];
            actual.push(
                {
                    id: i.id,
                    publicKey: i.publicKey,
                    createdAt: i.createdAt,
                    severity: i.severity,
                    paid: i.paid,
                    suggestedFine: i.suggestedFine,
                    suggestedFinePart: i.suggestedFinePart,
                    remainingWeight: i.remainingWeight,
                    vsetId: i.vsetId
                })
        }

        let reference = [
            {
                id: 379521005702848989643384193113797265097098487558039864532068095002368386347n,
                publicKey: Buffer.from('acacc7367fc6e8f3e82bb28d839361ee66f34f1e340eed8c82b169f2445ad3d5', 'hex'),
                createdAt: 1652619999,
                severity: 2,
                paid: 73166159686n,
                suggestedFine: 101000000000n,
                suggestedFinePart: 0n,
                remainingWeight: -359195385677765603n,
                vsetId: 14191242232923186170167014319574873013310876234686300899233319663346106480898n
            },
            {
                id: 93107436140086431965669461777665246404945492454841054914941956954309397807780n,
                publicKey: Buffer.from('f5d09e351ca99e8850f393f294cc1ea7ae1ee73685fdec549903f8b7cadac48c', 'hex'),
                createdAt: 1652619993,
                severity: 1,
                paid: 73342231921n,
                suggestedFine: 101000000000n,
                suggestedFinePart: 0n,
                remainingWeight: -359195385677765603n,
                vsetId: 14191242232923186170167014319574873013310876234686300899233319663346106480898n
            }
        ]

        expect(reference).toEqual(actual);
    });
});