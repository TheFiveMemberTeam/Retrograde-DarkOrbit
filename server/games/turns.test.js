import { PHASE_STATES, PHASE_TIMINGS } from "./game_globals";
import * as turns from "./turns";

describe("turn phases and timings", () => {
    test("phases", async () => {
        const sleep_mock = jest.fn(async () => {});

        let game = {};
        const phases = [PHASE_STATES.GAME_SETUP_PHASE,
                        PHASE_STATES.INFORMATION_PHASE,
                        PHASE_STATES.DISCUSSION_PHASE,
                        PHASE_STATES.ACTION_PHASE,
                        PHASE_STATES.SERVER_PROCESSING_PHASE];
        let resultingPhases = [];

        async function doTurn(phase) {
            game.currentState = phase;
            await turns.execute_turn(game, "", sleep_mock);
            resultingPhases.push(game.currentState);
        }

        for(const phase of phases) {
            await doTurn(phase);
        }

        const expectedPhases = ["Information phase", "Discussion phase", "Action phase", "Server processing", "Information phase"];

        expect(resultingPhases).toEqual(expectedPhases);
    });

    test("timings", async () => {
        const sleep_mock = jest.fn(async () => {});
        const lobbyCode = "TestLobbyCode";
        let game = {};

        game.currentState = PHASE_STATES.INFORMATION_PHASE;
        await turns.execute_turn(game, lobbyCode, sleep_mock);
        expect(sleep_mock).toHaveBeenCalledWith(PHASE_TIMINGS.INFORMATION_PHASE_LENGTH);

        game.currentState = PHASE_STATES.DISCUSSION_PHASE;
        await turns.execute_turn(game, lobbyCode, sleep_mock);
        expect(sleep_mock).toHaveBeenCalledWith(PHASE_TIMINGS.DISCUSSION_PHASE_LENGTH);

        game.currentState = PHASE_STATES.ACTION_PHASE;
        await turns.execute_turn(game, lobbyCode, sleep_mock);
        expect(sleep_mock).toHaveBeenCalledWith(PHASE_TIMINGS.ACTION_PHASE_LENGTH);
    });

    test("should call updateTimer with the correct parameters", () => {
        const lobbyCode = "testCode";
        const update_timer_mock = jest.fn(() => {});
        turns.set_timer_update_callback(update_timer_mock);
        turns.updateClientsPhase(PHASE_STATES.INFORMATION_PHASE, PHASE_TIMINGS.INFORMATION_PHASE_LENGTH, lobbyCode);
        expect(update_timer_mock).toHaveBeenCalledWith(PHASE_STATES.INFORMATION_PHASE, PHASE_TIMINGS.INFORMATION_PHASE_LENGTH, lobbyCode);
        turns.set_timer_update_callback(() => {});
    });



});