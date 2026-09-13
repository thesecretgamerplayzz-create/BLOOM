
const moodButtons=document.querySelectorAll(".mood");
const todayMood=document.getElementById("todayMood");
const meterFill=document.getElementById("meterFill");
const streak=document.getElementById("streak");
const journalInput=document.getElementById("journalInput");
const journalCount=document.getElementById("journalCount");
const saveJournal=document.getElementById("saveJournal");

const focusDisplay=document.getElementById("focusDisplay");
const focusStatus=document.getElementById("focusStatus");
const startFocus=document.getElementById("startFocus");
const resetFocus=document.getElementById("resetFocus");

const themeToggle=document.getElementById("themeToggle");

let timer;
let seconds=1500;

load();

moodButtons.forEach(button=>{

button.onclick=()=>{

const mood=button.dataset.mood;
const value=button.dataset.value;

todayMood.textContent=mood;
meterFill.style.width=value+"%";

localStorage.setItem("todayMood",mood);
localStorage.setItem("todayValue",value);
localStorage.setItem("lastCheck",new Date().toDateString());

updateStreak();

};

});

saveJournal.onclick=()=>{

const entries=JSON.parse(localStorage.getItem("journals")||"[]");

entries.unshift({

text:journalInput.value,
date:new Date().toLocaleDateString()

});

localStorage.setItem("journals",JSON.stringify(entries));

journalInput.value="";

journalCount.textContent=entries.length;

};

startFocus.onclick=()=>{

if(timer)return;

focusStatus.textContent="Running";

timer=setInterval(()=>{

seconds--;

const m=Math.floor(seconds/60);
const s=seconds%60;

focusDisplay.textContent=
String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");

if(seconds<=0){

clearInterval(timer);
timer=null;

focusStatus.textContent="Finished";

}

},1000);

};

resetFocus.onclick=()=>{

clearInterval(timer);
timer=null;

seconds=1500;

focusDisplay.textContent="25:00";
focusStatus.textContent="Ready";

};

themeToggle.onclick=()=>{

document.body.classList.toggle("dark");

localStorage.setItem("theme",

document.body.classList.contains("dark")?"dark":"light"

);

};

function updateStreak(){

const last=new Date(localStorage.getItem("lastCheck"));
const today=new Date();

const diff=Math.floor((today-last)/86400000);

let count=Number(localStorage.getItem("streak")||0);

if(diff===0){

}else if(diff===1){

count++;

}else{

count=1;

}

localStorage.setItem("streak",count);

streak.textContent=count+" Days";

}

function load(){

todayMood.textContent=localStorage.getItem("todayMood")||"No check-in";

meterFill.style.width=(localStorage.getItem("todayValue")||0)+"%";

journalCount.textContent=JSON.parse(localStorage.getItem("journals")||"[]").length;

streak.textContent=(localStorage.getItem("streak")||0)+" Days";

if(localStorage.getItem("theme")==="dark"){

document.body.classList.add("dark");

}

}