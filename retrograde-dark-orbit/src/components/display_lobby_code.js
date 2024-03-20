export default function DisplayLobbyCode(props) {
    // Access the code prop
    const { LobbyCode } = props;
    return (
      <div className="bg-slate-900 text-xl text-white m-1 py-2 px-10 rounded-xl">
        Lobby Code: {LobbyCode}
      </div>
    );
  }
  