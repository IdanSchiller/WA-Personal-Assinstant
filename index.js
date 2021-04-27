const fs = require('fs');
let axios = require("axios");
const express = require('express');
const app = express();
var later = require('later');
var request = require('request');
const {MongoClient} = require('mongodb');
const accountSid = process.env.SID
const authToken = process.env.TOKEN
const bodyParser = require('body-parser');
const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));

later.date.localTime();

load_reminders();



app.post('/incoming', (req, res) => {
  console.log(req.body)
  const twiml = new MessagingResponse();
  var msg = req.body.Body
  const msg_arr = msg.split(" ");
  var msg_to_return="ERROR";
  var index = Object.values(responseMap).indexOf(true) // checks if the bot was waiting for response from the user and need to resume a task
  if(index!==-1){
    var funToStart = Object.keys(responseMap)[index]
    msg_to_return = responseFunctionsMap[funToStart](msg_arr)
  }else{
    msg_to_return = preform(msg_arr);
  }
  twiml.message
  twiml.message(msg_to_return);

// adds the last msg that was received from the user
lastUserMsgsList = readItemsFromFile("lastUserMsgs")
  lastUserMsgsList.unshift(msg);
  lastUserMsgsList.length=10;
  writeToItemsInFile("lastUserMsgs",lastUserMsgsList);

// adds the bot massage
if(msg_to_return!==undefined){
  lastBotMsgsList = readItemsFromFile("lastBotMsgs");
  lastBotMsgsList.unshift(msg_to_return);
  lastBotMsgsList.length=10;
  writeToItemsInFile("lastBotMsgs",lastBotMsgsList);
}
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});


app.get('/', (req, res) => {
	res.send('Hello Express app');
});

app.listen(3000, () => console.log('server started'));


const ok_emoji_lib = ["👍","👌","🤙","✌️","💪","✔️"]

const show_sub_menu = {
    'all':show_all,
    "shopping": show_shopping,
    "meetings" : show_meetings,
    "reminders" : show_reminders,
    "lists" : show_lists,
    "list" : show_single_list,
    "today" : show_today
}
const add_sub_menu = { // command === 'תוסיף ל'
    "shopping": add_to_shoppings,
    "meetings" : add_to_meetings,
    "list" : add_to_list,
    "today": add_to_today,
    "reminders": add_to_reminders
}
const delete_sub_menu = {
    'all':delete_all,
    "shopping": delete_shopping,
    "meetings" : delete_meetings,
    "reminders" : delete_reminders,
    "lists" : delete_lists,
    "list" : delete_single_list,
    "today" : delete_today
}
const remind_sub_menu = { // not in use for now
    "list_name": remind_list,
    "msg" : remind_msg,
    "this": remind_this, // this = "את זה"
}
const send_sub_menu = {
  "toNumber" :send_toNumber,
  "toContact": send_toContact
}
const responseMap = {
    "remind_this_after_when" : false,
    "delete_meetings" : false,
    "delete_reminders":false
}
const responseFunctionsMap = {
    "remind_this_after_when": remind_this_after_when,
    "delete_meetings" : delete_single_meeting,
    "delete_reminders" : delete_single_reminder
}
const hebrew_command_map = {
    "תראה" : "show",
    "הראה" : "show",
    "תוסיף" : "add",
    "הוסף" : "add",
    "תזכיר" : "remind",
    "הזכר" : "remind",
    "תפריט" : "menu",
    "תמחק" : "delete",
    "מחק" : "delete",
    "תשלח" : "send",
    "שלח" : "send",
    "קניתי" : "bought",
    "הכל": "all",
    "קניות":"shopping",
    "פגישות":"meetings",
    "תזכורות":"reminders",
    "רשימות":"lists",
    "רשימה":"list",
    "היום":"today",
    "לקנות": "to_buy",
    "חניתי":"parked",
    "איפה":"where"

}
const command_sub_menu_for_print = {
    "show":show_sub_menu,
    "add": add_sub_menu,
    "remind": undefined,
    "menu" : undefined,
    "delete" : delete_sub_menu,
    "send": send_sub_menu,
    "bought" : undefined,
    "parked":undefined,
    "where": undefined
}
const command_menu = {
    "show":show_sub_command,
    "add": add_sub_command,
    "remind": remind_sub_command,
    "menu" : display_commands,
    "delete" : delete_sub_command,
    "send": send_sub_command,
    "bought" : bought_command,
    "to_buy" : to_buy,
    "parked": parked_command,
    "where": where_I_parked_command
}

/**
 * ! functions for PARKED_COMMAND
 */
function parked_command(msg_arr){
  var where_I_parked_tmp = msg_arr.slice(1) 
  var where_I_parked = where_I_parked_tmp.join(" ")
  fs.writeFileSync("parking.txt",where_I_parked);
  return `אוקיי, אני אזכור את זה  🚗`
}

/**
 * Functions for WHERE_I_PARKED
 */
function where_I_parked_command(msg_arr){
  var where_I_parked = fs.readFileSync("parking.txt","utf8")
  fs.writeFileSync("parking.txt","לא יודע, לא אמרת לי  🤷‍♂️")
  return where_I_parked
}
/**
 *  ! functions for TO_BUY
 */
function to_buy(msg_arr){
    var junk_arr = ["junk"].concat(msg_arr);
    return add_to_shoppings(junk_arr)+`   ${get_random_ok_emoji()}`;
}

/** 
 * ! functions for REMINDE
 */
 /**
  * ? format of msg_arr by index:
  *     0. "remind"
  *     1. "to me"
  *     2. "list" OR message body
  *     if "list" then 3. <list name> 
  *     example: "תזכיר לי רשימה דברים לדירה! 1230 2.3"
  *     example: "תזכיר לי לקנות מלא דברים לדירה בב"ש! 1710 4.3"
  */
function remind_sub_command(msg_arr){
    var sub_command = msg_arr[2]; // msg_arr[0] = "תזכיר" msg_arr[1] = "לי" 
    return sub_command==="רשימה"? remind_list(msg_arr)+`  ${get_random_ok_emoji()}`:
    sub_command==="את" && msg_arr[3]==="זה"? remind_this():
    remind_msg(msg_arr)+`  ${get_random_ok_emoji()}`; 
    // could also decide that sub command for "remind me this" is "את" and use remind_sub_menu[sub_command] 
}
 /**
  * ? format of msg_arr by index:
  *     0. "remind"
  *     1. "to me"
  *     2-until sees "!" (index = !). reminder body
  *     index !+1 until end. dd.mm and hhmm no matter the order 
  */
function remind_msg(msg_arr){
    var indexOfPunctu = msg_arr.findIndex(str =>str.includes("!"));
    var toRemind_tmp = msg_arr.slice(2,indexOfPunctu+1).join(" ")
    var toRemind = toRemind_tmp.substring(0,toRemind_tmp.length-1) // drops the "!"
    var timeAndDate = msg_arr.slice(indexOfPunctu+1);
    var date = getDateFromTimeAndDateArr(timeAndDate);
    var time = getTimeFromTimeAndDateArr(timeAndDate);
    var response= set_reminder(time,date,toRemind);
    return response;
}
/**
 * ? msg_arr[3-!] = list name
 * ? msg_arr[!-end] = date And time not in order 
 * example: "תזכיר לי רשימה דברים לבית! מחר ב0945"
 */
function remind_list(msg_arr){
    var indexOfPunctu = msg_arr.findIndex(str =>str.includes("!"));
    var list_nameTmp = msg_arr.slice(3,indexOfPunctu+1).join(" ");
    var list_name = list_nameTmp.substring(0,list_nameTmp.length-1)
    var timeAndDate = msg_arr.slice(indexOfPunctu+1);
    var date = getDateFromTimeAndDateArr(timeAndDate);
    var time = getTimeFromTimeAndDateArr(timeAndDate);
    var toRemind =`לא מצאתי את הרשימה ${list_name}`;
    var content = fs.readFileSync("lists.json", 'utf8');
    var lists = JSON.parse(content).lists;
    if (lists.length!==0){ 
      lists.forEach((list)=>{
        if(list.listName===list_name){
          toRemind = `רשימה ${list_name}:\n${list.value.join("\n")}`;
        }
      });
    }
    var reminder = {toRemind:toRemind,time:time,date:date}
    fs.writeFileSync("reminders.json",JSON.stringify(reminder));
    var response = set_reminder(time,date,toRemind);
    return response;
}
/** @TODO need to make sure the msg_arr is only time and date
 * ? me: "remind me this" -> bot: "when?" -> me: "<time> <date>"
 * ? time: <time> date: <date> toRemind: message that the bot sent me before I sent "remind me this" 
 */
function remind_this_after_when(msg_arr){ // msg_arr only contains time and date
    var lastUserMsgs = readItemsFromFile("lastBotMsgs") ;// get this messages some how as an array
    var toRemind = lastUserMsgs[1] // the message before the last message (which was "when")
    var time = getTimeFromTimeAndDateArr(msg_arr);
    var date = getDateFromTimeAndDateArr(msg_arr);
    var reminder = {toRemind:toRemind,time:time,date:date}
    fs.writeFileSync("reminders.json",JSON.stringify(reminder));
    responseMap.remind_this_after_when = false
    return set_reminder(time,date,toRemind) +`  ${get_random_ok_emoji()}`;
}
function remind_this(){
    responseMap.remind_this_after_when = true
    return "מתי להזכיר לך?"
}

function set_reminder(time,date,toRemind){
    // add to reminders list
    var day =Number(date.split(".")[0])
    var month = Number(date.split(".")[1])
    var hour =makeIsraelHour(Number(time.substring(0,2))); // the program time is -3 hours from israel
    var minute = Number(time.substring(2,4));
    var reminder = {toRemind:toRemind,time:time,date:date}

    var content = fs.readFileSync("reminders.json","utf8");
    var remindersFile = JSON.parse(content);
    var already_exist = false 
    for (var i=0; !already_exist && i<Object.values(remindersFile.items).length;i++){ // checks if this reminder is already exist and set new time and date for it
       already_exist = (Object.values(remindersFile.items)[i]).toRemind===toRemind;
       // need to rewrite this reminder in the file for the case that the time and date was changed but the toRemind is the same
    }
    if(!already_exist){ // it's a new reminder
    remindersFile.items.push(reminder)
    fs.writeFileSync("reminders.json",JSON.stringify(remindersFile));
    }
    else{
      console.log(`reminder was loaded: ${reminder.toRemind} \n`)
    }
    var sched=later.parse.recur().on(day).dayOfMonth().on(month).month().on(hour).hour().on(minute).minute(),
    b = later.setTimeout(function task(){
        send_reminder(toRemind)
    }
, sched);
   var timeString = `${time.substring(0,2)}:${time.substring(2,4)}`;
    return `קבעתי לך תזכורת לתאריך ${date} לשעה ${timeString}!`
}

function send_reminder(toRemind){

    client.messages
        .create({
          from: 'whatsapp:+14155238886',
          body: `תזכורת!!! ⏰📢\n${toRemind}`,
          to: 'whatsapp:+972546983157',
          })
          .then(deleteReminder(toRemind));

    function deleteReminder(toRemind){
          var content = fs.readFileSync("reminders.json","utf8");
    var reminders = JSON.parse(content)
    var index_to_delete = reminders.items.indexOf(toRemind)
    reminders.items.splice(index_to_delete);
    fs.writeFileSync("reminders.json",JSON.stringify(reminders));
    }   
}
function makeIsraelHour(hour){
  hour+=24-3 // the program time is -3 hours from israel
  return hour%24
}

/** 
 * ! functions for SEND
 */
function send_sub_command(msg_arr){
    const send_to_command = msg_arr[1].slice(1);// *שלח ל *תת פקודה
    return isNaN(send_to_command)?send_toContact(msg_arr):
    send_toNumber(msg_arr);
}

function send_toNumber(msg_arr){
    var numberToSend = `+972${msg_arr[1].slice(2)}`; //drops the 'ל0' at the beginning  
    var msgToSend = msg_arr.slice(2); // drops the 'send to<phoneNumber>
    var response = `https://wa.me/${numberToSend}?text=${msgToSend}`;
    return response;
}    
function send_toContact(){} //@TODO LATER
/** 
 * ! functions for BOUGHT
 */
function bought_command(msg_arr){
    var items_to_delete = msg_arr.slice(1);
    var response="";
    var content = fs.readFileSync('shopList.json', 'utf8');
    var shopList = JSON.parse(content);
    if (items_to_delete[0]==="הכל"){
       if (items_to_delete.length===1){
          return delete_shopping()
       }
        // "קניתי הכל חוץ מ"
        else{ // removes all the items in shopping list that aren't in items to delete

        items_to_delete = items_to_delete.slice(2); // drops the "הכל חוץ"

        // removes spaces
        items_to_delete = items_to_delete.map((word)=>{
    if (word.charAt(0)===" ")
        word=word.substring(1)
    if(word.charAt(word.length-1)===" ")
        word=word.substring(0,word.length-1)
    return word
      })
        items_to_delete[0] = items_to_delete[0].substring(1) // drops the "מ" from the first item name
        var exsiting_items = shopList.shopingItems
                console.log("1: ",items_to_delete,exsiting_items)

        // shopList.shopingItems = intersect(items_to_delete,exsiting_items);
        var newShopList =  exsiting_items.filter((x)=>items_to_delete.includes(x))
        // var newShopList_tmp = exsiting_items.map(value =>{
        //   console.log(items_to_delete.includes(value))
        // if(items_to_delete.includes(value)) return value
        // })
        }
        console.log("2: ",items_to_delete,newShopList)

    }else{ // removes all the items in shopping list that are in items to delete
        var newShopList =  exsiting_items.filter((x)=>!items_to_delete.includes(x))
    }
   fs.writeFileSync("shopList.json",JSON.stringify({shopingItems:newShopList}));
    response=`אוקיי בוס מחקתי את זה מרשימת הקניות.\n מה שיש שם עכשיו זה:\n ${show_shopping()}`;
    return response;
}
/** 
 * ! functions for MENU
 */
function display_commands(){
        var response=`הנה כל הפקודות:`;
        var show = `*תראה הכל* :=> מציג את כל הרשימות + קניות + פגישות + תזכורות - לממש
*תראה <רשימות/קניות/פגישות/תזכורות/היום>* :=> מציג את כל הרשימות/קניות/פגישות/תזכורות/היום הקיימות * - לסדר בתזכורות שיראה את השעה יפה
*תראה רשימה <שם רשימה>* :=> מראה את הרשימה עם שם <שם רשימה>
`
        var add = `*תוסיף ל<קניות> <מוצרים>* :=> מוסיף <מוצרים> ל<קניות>
*תוסיף ל<פגישות> <תוכן>. <היום>/<מחר>/<יום בשבוע>/ <יום בשבוע הבא>/<HHMM> <<D.M*:=> מוסיף לרשימת פגישות פגישה עם תוכן <תוכן> בשעה MM:HH בתאריך M.D
*תוסיף לרשימה <שם רשימה>: <תוכן>*:=> מוסיף <תוכן> ל<שם רשימה>. אם הרשימה לא קיימת, יוצר חדשה ומוסיף אליה
`
        var remind = `*תזכיר לי <מה שרוצים לזכור>! <HHMM> <<D.M /<היום>/<מחר>/<יום בשבוע>/ <יום בשבוע הבא>*:=> מוסיף לרשימת תזכורות תזכורת עם תוכן <מה שרוצים לזכור> בשעה MM:HH בתאריך M.D
*תזכיר לי רשימה <שם רשימה>! <HHMM> <<D.M* :=> מוסיף לרשימת תזכורות תזכורת עם תוכן הרשימה <שם רשימה> בשעה MM:HH בתאריך M.D
*תזכיר לי את זה* :=> מחזיר הודעה "מתי" ושם תזכורת עם התוכן של ההודעה שהוא שלח לפי ששלחתי "תזכיר לי את זה" בתאריך והשעה שהשבתי לו בהודעה הבאה... 
*תזכיר לי <רשימות/פגישות>*:=> מציג רשימה של רשימות/פגישות ומבקש אינדקס + תאריך + שעה להזכרה - – עוד אין
`
        var send = `*תשלח ל<XXXXXXXX05> <מה שרוצים לשלוח>* :=> מחזיר לינק לשליחת הודעה עם תוכן <מה שרוצים לשלוח> למספר  <XXXXXXXX05>
*תשלח ל<XXXXXXXX05>  <שם רשימה>* :=> מחזיר לינק לשליחת הודעה עם תוכן הרשימה <שם רשימה> למספר  <XXXXXXXX05> - לממש
*תשלח ל<שם> <מה שרוצים לשלוח>* :=> מחזיר לינק לשליחת הודעה עם תוכן <מה שרוצים לשלוח> למספר של איש קשר ששמור בתוכנה בשם <שם> - לממש
*תשלח ל<שם> <שם רשימה>* :=> שולח ל<שם> רשימה בשם <שם רשימה> - לממש
`
        var delete_command = `*תמחק רשימה <שם רשימה>* :=> מוחק את כל הרשימה עם שם <שם רשימה>
*תמחק <פגישות/תזכורות>* :=> מציג את כל הפגישות/תזכורות ומבקש אינדקס למחיקה
`
        var bought_and_to_buy = `לקנות <מוצר 1, מוצר 2, ...>* :=> מוסיף <מוצר 1, מוצר 2, ...> לרשימת הקניות
*קניתי <מוצר 1, מוצר 2, ...>* :=> מוחק <מוצר 1, מוצר 2, ...> מרשימת הקניות
*קניתי הכל*:=> מוחק הכל מרשימת הקניות
*קניתי הכל חוץ מ<מוצר 1, מוצר 2, ...>* :=> מוחק מרשימת הקניות הכל חוץ מ<<מוצר 1, מוצר 2, ...>
`
        var parking = `*חניתי <מקום>* :=> שומר את <מקום> כדי לדעת איפה חניתי
*איפה חניתי?* :=> מחזיר את <מקום> אם אמרתי לו איפה חניתי, אחרת מחזיר "לא יודע, לא אמרת לי"
`
        var today = `*תוסיף להיום <תוכן>* :=> מוסיף לרשימה היום את <תוכן>
*תראה מה יש לי היום* :=> מראה את כל הדברים שבתאריך של היום + משימות שהוספתי להיום
`

 send_mgs_to_me(show+add)
 send_mgs_to_me(remind+send)
 send_mgs_to_me(delete_command+parking+today+bought_and_to_buy)

    // Object.entries(command_sub_menu_for_print).forEach(function ([key,value]){
    //     var subCommandMenuStr="";
    //     if(value!==undefined){
    //     Object.entries(value).forEach(function([key,value]){subCommandMenuStr+=` - ${key}\n`})
    //     }
    //     response+=`${key}:\n${subCommandMenuStr}`
    // })
    return response;
}
/** 
 * ! functions for SHOW
 */
function show_sub_command(msg_arr){
    const heb_show_command = msg_arr[1];
    const show_command = hebrew_command_map[heb_show_command]
    return show_sub_menu[show_command](msg_arr);
}
function show_shopping(){
    var content = fs.readFileSync('shopList.json', 'utf8');
    var list = JSON.parse(content).shopingItems;
    var list_to_send="רשימת קניות ריקה\n";
    if (list.length!==0){ // list is not empty
      list_to_send="🛒 רשימת קניות: 🛒\n";
      for (var i=0; i<list.length; i++){
        list_to_send+=`${i+1}) ${list[i]}\n`;
      }
    }
    return list_to_send+"\n🍌 🧄 🍕 🍦 🥑 🍉";
}   
function show_meetings(){
    var content = fs.readFileSync('meetings.json', 'utf8');
    var list = JSON.parse(content).meetings;
    var listToSend=`אין כלום ברשימת פגישות\n`;
    if(list.length!==0){ // list is not empty
    listToSend=`הנה כל הפגישות שלך:\n📅 רשימת פגישות: 📅\n`;
    for (var i=0; i<list.length; i++){
      var meeting  = list[i];
      var meetStr="";
        meetStr = `${meeting.subject} ב${meeting.date} בשעה ${meeting.time}`;
        listToSend+=`${i+1}) ${meetStr}\n`;
      }
      }
      return listToSend
}
function show_single_list(msg_arr){
    const list_name = msg_arr.slice(2).join(" ") // msg_arr[0] = "show", msg_arr[1] = "list", msg_arr[2-end] = <list name>
    return printListFromLists(list_name);
}
function show_lists(){ 
    var content = fs.readFileSync("lists.json", 'utf8');
    var lists = JSON.parse(content).lists;
    var response="אין לך כלום ברשימות אח\n";
    if (lists.length!==0){ 
        response="📜 הנה כללללל הרשימות שלך: 📜\n";
        lists.forEach((list)=>{
          if(list.value.length!==0){
            response+=`-${list.listName}\n`
          }
          });
      }
      response+=`\n-------------------------------------------\n רוצה לראות אחת מהרשימות?\n שלח לי: "תראה רשימה <שם רשימה>"`
      return response
      

}
function show_reminders(){
    var list = readItemsFromFile("reminders");
    var listToSend=`אין כלום ברשימת תזכורות\n`;
    if(list.length!==0){ // list is not empty
        listToSend=`📢 רשימת תזכורות: 📢\n`;
        for (var i=0; i<list.length;i++){
            var reminder = list[i];
            var remStr="";
            var timeStr = `${reminder.time.substring(0,2)}:${reminder.time.substring(2,4)}`
            remStr = `${reminder.toRemind} ב${reminder.date} בשעה ${timeStr}`;    
            listToSend+=`${i+1}) ${remStr}\n`;
        }
    }
    return listToSend
 
}
function show_today(){ 
    return printListFromLists("היום");
}
function show_all(){ //@TODO print all list+shoppong....
}
function printListFromLists(listName){
    var content = fs.readFileSync("lists.json", 'utf8');
    var lists = JSON.parse(content).lists;
    var response="הרשימה ריקה\n";
    var found=false;
    if(lists.length!==0){ 
         lists.forEach((list)=>{
            if(list.listName===listName){
                response = `📜 ${listName}: 📜\n ${list.value.join("\n ")}`;
              found=true;
            }
            })
        if(!found){
            response=`וואלה לא מצאתי את הרשימה ${listName}`;
        }
      }
    return response;
}



/** 
 * ! functions for ADD
 */
function add_sub_command(msg_arr){
    const heb_add_command = msg_arr[1].slice(1); // *תוסיף ל *תת פקודה
    const add_command = hebrew_command_map[heb_add_command]
    return add_sub_menu[add_command](msg_arr)+`   ${get_random_ok_emoji()}`
}
function add_to_shoppings(msg_arr){
    var items_seperated_by_space = msg_arr.slice(2)
    var items_with_spaces = items_seperated_by_space.join(" ").split(",");
    // removes spaces from items
    var items = items_with_spaces.map((word)=>{
    if (word.charAt(0)===" ")
        word=word.substring(1)
    if(word.charAt(word.length-1)===" ")
        word=word.substring(0,word.length-1)
    
    return word
})

    var content = fs.readFileSync('shopList.json', 'utf8');
    var shopList = JSON.parse(content);
    shopList.shopingItems.push(...items);
    fs.writeFileSync("shopList.json",JSON.stringify(shopList));
    var response = `הוספתי ${items} לרשימת קניות 🛒`;
    return response;
}

// function remove_spaces_from(arr){ // removes spaces (if exist) from start and end  of item in arr 
//   arr.forEach(value => {
//     if (value.charAt(0)===" ") value = value.substring(1)
//     if (value.charAt(value.length-1)===" ") value=value.slice(0,-2)
//   })
//   return arr
// }
/**
 * ? format to add to list
 * msg_arr[0]="add", msg_arr[1]="to list" 
 * msg_arr[2-index of :] = <list name>
 * msg_arr[ : =end] = <content>
 */
function add_to_list(msg_arr){
       const list_name = get_list_name(msg_arr);
       var to_add = "";
       var response=`הוספתי לרשימה ${italicize(list_name)}`;
       var content = fs.readFileSync('lists.json', 'utf8');
       var listsFile = JSON.parse(content);
       (list_name==="הכל")? 
            response=`סורי, אי אפשר לשמור רשימה בשם "הכל"` :
        // (msg_arr.length<3)? // need to save last message
        //     to_add = fs.readFileSync("lastMsg.txt","utf8"):
         
         // need to save text from cuurent message

         to_add=get_add_to_list_content(msg_arr);
         var added=false;
         listsFile.lists.forEach(function (list){
           if(list.listName===list_name){
            list.value.push(to_add);
            added=true;
           }
           });
           if(!added){ // didn't find list name >> list doesn't exist
           var newList = {listName: list_name, value:[to_add]}
           listsFile.lists.push(newList);
           response = `שמע, לא מצאתי את הרשימה ${italicize(list_name)}... אז יצרתי רשימה כזאת והוספתי לשם מה שרצית `
           }
           fs.writeFileSync("lists.json",JSON.stringify(listsFile));
           return response;
}    
/**
 * ? format for adding a meeting:
 * msg_arr[0]="add", msg_arr[1]="to meetings" 
 * msg_arr[2-"."] = subject
 * msg_arr["." - end] = date/time - it finds by itself
 * example: "תוסיף לפגישות תור לרופא עור. 1450 5.4"
 */
function add_to_meetings(msg_arr){ 
    var indexOfPeriod = msg_arr.findIndex(str =>str.includes("."));
    var subjectTmp = msg_arr.slice(2,indexOfPeriod+1).join(" ")
    var subject = subjectTmp.substring(0,subjectTmp.length-1);
    var timeAndDate = msg_arr.slice(indexOfPeriod+1);
    var time = getTimeFromTimeAndDateArr(timeAndDate);
    var date = getDateFromTimeAndDateArr(timeAndDate);
    var timeString = `${time.substring(0,2)}:${time.substring(2,4)}`;
    var meeting = { subject:subject , time:timeString , date:date};
    var content = fs.readFileSync('meetings.json', 'utf8');
    var meetingsList = JSON.parse(content);
    meetingsList.meetings.push(meeting);
    fs.writeFileSync("meetings.json",JSON.stringify(meetingsList));
    var response=`הוספתי ${italicize(subject)} לרשימת פגישות בוס 📅`;
    return response;
}
function add_to_reminders(){

}

function add_to_today(){} // @TODO
function get_list_name(msg_arr){
    var indexOfColon = msg_arr.findIndex(str =>str.includes(":")); // get the index of the last word in list name
    var list_name = msg_arr.slice(2,indexOfColon+1).join(" "); // join the whole name to one string, drops the "תוסיף לרשימה"
    list_name = list_name.substring(0,list_name.length-1); // drops the colon(":")
    return list_name;
} 
function get_add_to_list_content(msg_arr){
    var indexOfColon = msg_arr.findIndex(str =>str.includes(":")); // get the index of the last word in lisr name
    var content = msg_arr.slice(indexOfColon+1).join(" "); // join the whole content to one string
    return content;

};

function getDateFromTimeAndDateArr(timeAndDate){
  var now =  new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"})
  var day = now.split(",")[0].split("/")[1]
  var month = now.split(",")[0].split("/")[0]



  for (var i=0 ; i<timeAndDate.length ; i++){
      var str = timeAndDate[i];
      if(isNaN(str)){ //it's probably the date, unless the date is of format dd.mm
          if(str==="היום"){ 
              return `${String(day).padStart(2, '0')}.${String(month.padStart(2, '0'))}`
          }
          else if(str==="מחר"){
              var tommorow =  new Date()              
              tommorow.setDate(tommorow.getDate()+1)
              return `${String(tommorow.getDate()).padStart(2, '0')}.${String(month).padStart(2, '0')}`
          }
          else if(str.includes("/") || str.includes(".")){
              if (str.charAt(0)==="ב"){ // it starts with "ב"
                  str = str.substring(1);
              }
              str = str.replace(/[/]/g, "."); // change the "/" to "."
              return str
              
          }
          else { // its "day" followed by "next" or the time that starts with "ב"
              if(str.charAt(0)==="ב"){ //it starts with "ב"
                  str = str.substring(1);
              }
              if(isNaN(str)){ // it's a "day", not the time
                var numOfNext = timeAndDate.filter(function(x){ return x === "הבא"; }).length;
                var newDate = getDateFromString(str,numOfNext);
                return `${String(newDate.getDate()).padStart(2, '0')}.${String(newDate.getMonth() + 1).padStart(2, '0')}.${newDate.getFullYear()}`
              
              }
          }
        }
        else if (str.includes(".")){
            return str
          }
      }
}


function getTimeFromTimeAndDateArr(timeAndDate){ // gets an array of time and date and takes the element that is not the date. can include "ב" before the time
var time=undefined
timeAndDate.forEach((x)=>{
  isNaN(x)? x.charAt(0)=="ב" && !isNaN(x.substr(1)) && !x.includes(".")? time = x.substring(1): // x starts with "ב" so the number after it is the time
  x: // x is not a number so he his a word representing a date
  x.includes(".") || x.includes("/")? x: // x is the date
  time =x; // x is a number and not a date so he his the time
})
  return time
}  


function getDateFromString(str,number_of_weeks){ //"today", "tommorow", "sunday", "monday",... num_of_weeks - number of weeks ahead = number of "הבא"
var nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Jerusalem"})
var day = nowStr.split(",")[0].split("/")[1]
var now =  new Date()
now.setDate(day)
const currDay = now.getDay()+1
var strDay = days_map[str];
var num_of_weeks = 1+number_of_weeks;
var newDate = new Date(now);
newDate.setDate(now.getDate()+(num_of_weeks*7+strDay-currDay));

    return  newDate
}

const days_map={
    "ראשון":1,
    "בראשון": 1,
    "שני":2,
    "בשני":2,
    "שלישי":3,
    "רביעי":4,
    "חמישי":5,
    "שישי":6,
    "שבת":7,
    "בשלישי":3,
    "ברביעי":4,
    "בחמישי":5,
    "בשישי":6,
    "בשבת":7
}




/** 
 * ! functions for DELETE
 */
function delete_sub_command(msg_arr){
    const heb_delete_command = msg_arr[1];
    const delete_command = hebrew_command_map[heb_delete_command];
    return delete_sub_menu[delete_command](msg_arr)+`  ${get_random_ok_emoji()}`;

}
function delete_shopping(msg_arr){
    const empty_list = {shopingItems:[]}
    fs.writeFileSync("shopList.json",JSON.stringify(empty_list));
    const response = ("מחקתי את כל רשימת הקניות");
    return response;

}
function delete_meetings(msg_arr){ 
    responseMap.delete_meetings=true
    return  show_meetings()+"\n\nאיזו פגישה למחוק? (בחר מספר פגישה או הכל)"
}
function delete_single_list(msg_arr){
    var listName = msg_arr.slice(2).join(" ") // drops the "תמחק רשימה" at the beginning 
    var found = deleteList(listName);
    var response = "";
    !found? response=`לא הצלחתי למחוק את הרשימה ${listName}...`:
    response = `מחקתי את הרשימה ${listName}`;
    return response;

}
function delete_lists(msg_arr){ // maybe make an option to delete all lists at once
    const choose_what_to_delete =`תבחר מה אתה רוצה למחוק ושלח לי: "תמחק רשימה <שם רשימה>:"`
    return show_lists()+"\n\n"+choose_what_to_delete;
}
function deleteList(listName){
    var content = fs.readFileSync("lists.json", 'utf8');
   var lists = JSON.parse(content).lists;
   var found=false;
    if (lists.length!==0){ 
   var index_to_delete = lists.map(function(l) { return l.listName; }).indexOf(listName);
   if(index_to_delete!==-1){
     found=true
       lists.splice(index_to_delete);
   }
  //    lists.forEach((list)=>{
  //      if(list.listName===listName){
  //        list.value=[];
  //        found=true;
  //      }
  //    });
     var listsAfterDel = {lists : lists};
     fs.writeFileSync("lists.json",JSON.stringify(listsAfterDel));
     }
     return found;
}
function delete_all(msg_arr){ //TODO
}
function delete_reminders(msg_arr){ 
    responseMap.delete_reminders=true
    return  show_meetings()+"\n\nאיזו תזכורת למחוק? (בחר מספר תזכורת או הכל)"
} 
function delete_today(msg_arr){} //TODO delete today's list
function delete_single_meeting(msg_arr){
    var index_to_delete = msg_arr[0];
    var content = fs.readFileSync('meetings.json', 'utf8');
    var list = JSON.parse(content).meetings;
    var response=`מחקתי את ${bold(index_to_delete)} מרשימת הפגישות`;
    !isNaN(index_to_delete)? list.splice(index_to_delete-1,1):
    index_to_delete==="הכל"? list = []:
    response = `לא הצלחתי למחוק את ${bold(index_to_delete)}`;
    fs.writeFileSync("meetings.json",JSON.stringify({meetings:list}));
    responseMap.delete_meetings=false;
    return response
}

// generics
function delete_single_from_list(msg_arr){
    var delete_from = lastMsg[1] // last message from user was "<תמחק <רשימות/פגישות/תזכירים/קניות"
    var index_to_delete = msg_arr[0];
    var content = fs.readFileSync(`${delete_from}.json`, 'utf8');
    var list = JSON.parse(content).items;
    var response=`מחקתי את ${italicize(index_to_delete)}`;
    !isNaN(index_to_delete)? list.splice(index_to_delete-1,1):
    index_to_delete==="הכל"? list={items:[]}:
    response = `לא הצלחתי למחוק את ${italicize(index_to_delete)}`;
    fs.writeFileSync(`${delete_from}.json`,JSON.stringify(list));
    return response
}
function delete_single_reminder(msg_arr){
    var index_to_delete = msg_arr[0];
    var content = fs.readFileSync('reminders.json', 'utf8');
    var list = JSON.parse(content).items;
    var response=`מחקתי את ${bold(index_to_delete)} מרשימת התזכורות`;
    !isNaN(index_to_delete)? list.splice(index_to_delete-1,1):
    index_to_delete==="הכל"? list = []:
    response = `לא הצלחתי למחוק את ${bold(index_to_delete)}`;
    fs.writeFileSync("reminders.json",JSON.stringify({items:list}));
    responseMap.delete_reminders=false;
    return response
}


function readItemsFromFile(fileName){
    var content = fs.readFileSync(`${fileName}.json`, 'utf8');
    return JSON.parse(content).items;
  }
function writeToItemsInFile(fileName,toWrite){
    fs.writeFileSync(`${fileName}.json`,JSON.stringify({items:toWrite}));
  }

  function load_reminders(){
    var reminders = readItemsFromFile("reminders");
      reminders.forEach((r)=>{
        set_reminder(r.time,r.date,r.toRemind);
    
      })
    }
  

function  preform(msg_arr){
    const heb_command = msg_arr[0];
    const command = hebrew_command_map[heb_command]; // translates the command to english
    return command_menu[command](msg_arr); //exectue the function coresponding to the command
}

function italicize(str){
  return `_${str}_`
} 
function bold(str){
  return `*${str}*`
} 

function get_random_ok_emoji(){
  var rand_index = getRandomInt(ok_emoji_lib.length)
  return ok_emoji_lib[rand_index];
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function send_mgs_to_me(msg){
    client.messages
        .create({
          from: 'whatsapp:+14155238886',
          body: `${msg}`,
          to: 'whatsapp:+972546983157',
          })
          .then();
}


function intersect(a, b) {
    return [...new Set(a)].filter(x => {
      console.log()
      new Set(b).has(x)});
}

