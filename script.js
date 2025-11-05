// == CONFIGURATION ==
const API_BASE = "https://tencandles.infinityfreeapp.com/api/"; // InfinityFree
const WS_URL   = ""; // optional realtime relay

// == STATE ==
let roomCode=null,playerName=null,state={candles:Array(10).fill(true),scene:1,sceneDice:10,truths:[],last_roll:[]};
let ws;

// == HELPERS ==
async function post(url,data){return fetch(API_BASE+url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(data)}).then(r=>r.json());}
async function get(url){return fetch(API_BASE+url).then(r=>r.json());}
function notify(event){if(ws&&ws.readyState===1)ws.send(JSON.stringify({event,join:roomCode}));}

// == ELEMENTS ==
const lobby=document.getElementById("lobby"),game=document.getElementById("gameArea");
const roomInput=document.getElementById("roomInput"),passInput=document.getElementById("passwordInput"),nameInput=document.getElementById("nameInput"),joinBtn=document.getElementById("joinRoom");
const candlesEl=document.getElementById("candles"),blowOut=document.getElementById("blowOut"),relight=document.getElementById("relight");
const rollBtn=document.getElementById("rollDice"),rollResult=document.getElementById("rollResult");
const truthText=document.getElementById("truthText"),addTruth=document.getElementById("addTruth"),truthsList=document.getElementById("truthsList");
const saveTraits=document.getElementById("saveTraits"),playersDisplay=document.getElementById("playersDisplay");

joinBtn.onclick=async()=>{
  roomCode=roomInput.value.trim();playerName=nameInput.value.trim();if(!roomCode||!playerName)return alert("Enter both fields");
  await post("create_room.php",{room_code:roomCode,password:passInput.value});
  await post("add_player.php",{room_code:roomCode,player_name:playerName});
  connectWS();
  lobby.style.display="none";game.style.display="block";
  loadAll();
};

function connectWS(){
  if(!WS_URL)return;
  ws=new WebSocket(WS_URL);
  ws.onopen=()=>ws.send(JSON.stringify({join:roomCode}));
  ws.onmessage=(e)=>{const d=JSON.parse(e.data);if(d.event)loadAll();};
  ws.onclose=()=>setTimeout(connectWS,3000);
}

async function loadAll(){
  const room=await get(`get_room.php?room_code=${roomCode}`);
  if(room.error)return; state=room;
  renderCandles();renderTruths();renderRoll();
  const players=await get(`get_players.php?room_code=${roomCode}`);renderPlayers(players);
}

function renderCandles(){
  candlesEl.innerHTML="";
  state.candles.forEach((lit,i)=>{
    const d=document.createElement("div");
    d.className="candle "+(lit?"lit":"out");d.dataset.index=i;d.innerHTML=`<span>${i+1}</span>`;
    candlesEl.appendChild(d);
  });
}
candlesEl.onclick=async e=>{
  const c=e.target.closest(".candle");if(!c)return;
  const i=+c.dataset.index;state.candles[i]=!state.candles[i];
  await saveRoom();notify("candles");
};
blowOut.onclick=async()=>{
  const i=state.candles.findIndex(c=>c);
  if(i>=0)state.candles[i]=false;state.scene++;state.sceneDice=state.candles.filter(Boolean).length;
  await saveRoom();notify("candles");
};
relight.onclick=async()=>{
  state={candles:Array(10).fill(true),scene:1,sceneDice:10,truths:[],last_roll:[]};
  await saveRoom();notify("candles");
};

rollBtn.onclick=async()=>{
  const res=await post("roll_dice.php",{room_code:roomCode,count:state.sceneDice});
  state.last_roll=JSON.parse(res);renderRoll();notify("roll");
};
function renderRoll(){rollResult.textContent=state.last_roll.length?`Last roll: ${state.last_roll.join(", ")}`:"";}

addTruth.onclick=async()=>{
  const t=truthText.value.trim();if(!t)return;
  state.truths.push(`${playerName}: ${t}`);truthText.value="";
  await saveRoom();notify("truth");
};
function renderTruths(){truthsList.innerHTML="";state.truths.forEach(t=>{const li=document.createElement("li");li.textContent=t;truthsList.appendChild(li);});}

async function saveRoom(){
  await post("update_room.php",{room_code:roomCode,candles:JSON.stringify(state.candles),scene:state.scene,sceneDice:state.sceneDice,truths:JSON.stringify(state.truths),last_roll:JSON.stringify(state.last_roll)});
}

saveTraits.onclick=async()=>{
  const v=document.getElementById("virtue").value,vi=document.getElementById("vice").value,m=document.getElementById("moment").value,b=document.getElementById("brink").value;
  const burned=JSON.stringify({virtue:false,vice:false,moment:false,brink:false});
  await post("update_player.php",{room_code:roomCode,player_name:playerName,virtue:v,vice:vi,moment:m,brink:b,burned});
  notify("traits");
};

async function burnTrait(trait){
  await post("burn_trait.php",{room_code:roomCode,player_name:playerName,trait});
  notify("burn");
}

function renderPlayers(list){
  playersDisplay.innerHTML="";
  list.forEach(p=>{
    const div=document.createElement("div");
    div.className="card";
    div.innerHTML=`<strong>${p.player_name}</strong><br>
      Virtue: ${p.virtue||"-"} ${p.burned?.virtue?"🔥":""} <button onclick="burnTrait('virtue')">Burn</button><br>
      Vice: ${p.vice||"-"} ${p.burned?.vice?"🔥":""} <button onclick="burnTrait('vice')">Burn</button><br>
      Moment: ${p.moment||"-"} ${p.burned?.moment?"🔥":""} <button onclick="burnTrait('moment')">Burn</button><br>
      Brink: ${p.brink||"-"} ${p.burned?.brink?"🔥":""} <button onclick="burnTrait('brink')">Burn</button>`;
    playersDisplay.appendChild(div);
  });
}
