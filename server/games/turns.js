import { PHASE_STATES, PHASE_TIMINGS } from "./game_globals"

// used as a timer that does not block other code execution from happening
export const sleep_function = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

export async function execute_turn(game, sleep=sleep_function) {
    switch(game.currentState) {

        case PHASE_STATES.GAME_SETUP_PHASE:
            // call setupNewGame function?
            game.currentState = PHASE_STATES.INFORMATION_PHASE;
            break;

        case PHASE_STATES.INFORMATION_PHASE:
            updateClientsPhase(PHASE_STATES.INFORMATION_PHASE);
            // add function to send client the data for information phase here
            await sleep(PHASE_TIMINGS.INFORMATION_PHASE_LENGTH);
            game.currentState = PHASE_STATES.DISCUSSION_PHASE;
            break;

        case PHASE_STATES.DISCUSSION_PHASE:
            updateClientsPhase(PHASE_STATES.DISCUSSION_PHASE);
            // add function to enable client chat here
            await sleep(PHASE_TIMINGS.DISCUSSION_PHASE_LENGTH);
            game.currentState = PHASE_STATES.ACTION_PHASE;
            break;

        case PHASE_STATES.ACTION_PHASE:
            updateClientsPhase(PHASE_STATES.ACTION_PHASE);
            // add function to disable client chat here
            await sleep(PHASE_TIMINGS.ACTION_PHASE_LENGTH);
            game.currentState = PHASE_STATES.SERVER_PROCESSING_PHASE;
            break;

        case PHASE_STATES.SERVER_PROCESSING_PHASE:
            // add function to process clients' choices during action phase
            // add fucntion to check for win condition
            game.currentState = PHASE_STATES.INFORMATION_PHASE;
            break;
    }
}

function updateClientsPhase(phase) {
    // send phase to client
}