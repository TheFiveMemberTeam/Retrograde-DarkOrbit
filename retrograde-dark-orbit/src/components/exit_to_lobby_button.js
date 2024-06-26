"use client"

import { getItem } from "../server/storage";
import { navigate } from "./navigation";

export default function ExitToLobbyButton({navigator = navigate}) {
    return(
        <button className="bg-slate-900 text-grey-100 m-1 px-4 py-2 rounded-xl text-xl hover:bg-slate-800 disabled:bg-slate-950"
        onClick={() => {navigator(`/lobby?code=${getItem("code")}`)}}>
                X
        </button>
    );
}