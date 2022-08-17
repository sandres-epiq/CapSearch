let clientId;
let clientSecret;
let accessToken;
let accessLib = [["ID1", "SECRET1"], ["ID2", "SECRET2"], ["ID3", "SECRET3"], ["ID4", "SECRET4"], ["ID5", "SECRET5"], ["ID6", "SECRET6"], ["ID7", "SECRET7"], ["ID8", "SECRET8"], ["ID9", "SECRET9"], ["ID10", "SECRET10"]];
//accessLib is an array of [client id, client secret] codes for different production apps
let allValues = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1, 10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91, 100, 110, 120, 130, 150, 160, 180, 200, 220, 240, 270, 300, 330, 360, 390, 430, 470, 510, 560, 620, 680, 750, 820, 910, 1000, 1100, 1200, 1300, 1500, 1600, 1800, 2000, 2200, 2400, 2700, 3000, 3300, 3600, 3900, 4300, 4700, 5100, 5600, 6200, 6800, 7500, 8200, 9100, 10000, 15000, 22000, 33000, 47000, 68000, 100000, 150000, 220000, 330000, 470000, 680000, 1000000];
let voltageLib = [["6.3V", 252155], ["10V", 74515], ["16V", 108742], ["25V", 159247], ["50V", 238738]]; //Voltages and their digikey search parameter IDs
let allSciValues = sciList();
let allSciValuesMod = sciListMod();
let outputLib = [];
//outputLib contains the search results from each Package + Temp Rating + Voltage Rating + Capacitance search.
//Inside each outputLib object is an array called Options which contains all the different tolerances available for the combination of parameters. (see the parseTolerance function)
let postState = [];
//postState contains either undefined, "POST", or "RETURNED" at each index. When initiating digikey searches, a slot in postState is set to "POST." When the result comes back from digikey, the slot is set to "RETURNED."
let redirectURI = "YOUR REDIRECT URI HERE";
let preferredMans = ["Murata Electronics", "YAGEO", "Taiyo Yuden", "TDK Corporation", "Samsung Electro-Mechanics"];



function formatCookies(element){
    if(document.getElementById(element).type == "checkbox"){
        document.cookie = element + "=" + document.getElementById(element).checked + "; ";
    }
    else {
        document.cookie = element + "=" + document.getElementById(element).value + "; ";
    }
} //Called whenever a page element is changed. The chosen value is stored in the page's cookie, so that whenever the site is reloaded this is the default value.

function applyCookies(){
    let currentCookies = parseCookie();
    for(const element in currentCookies){
        if(document.getElementById(element) != null){
            if(document.getElementById(element).type == "checkbox"){
                document.getElementById(element).checked = currentCookies[element];
            }
            else{
                document.getElementById(element).value = currentCookies[element];
            }
        }
    }
} //Called when the site is loaded. Applies any dropdown defaults stored in the page's cookie.

const parseCookie = () => //Returns an object with each name-value pair from the page's cookie
    document.cookie
        .split(';')
        .reduce((res, c) => {
            const [key, val] = c.trim().split('=').map(decodeURIComponent)
            try {
                return Object.assign(res, { [key]: JSON.parse(val) })
            } catch (e) {
                return Object.assign(res, { [key]: val })
            }
        }, {});



document.getElementById("go").addEventListener("click", function(){
    document.cookie = "websiteState=go";
    document.cookie = "burstLimit=0";
    getAuthCode();
}); //The burstLimit cookie tells how many searches have been performed. This is tracked, since digikey caps searches to 120 per minute.

function getAuthCode(){

    if(!("tokenIndex" in parseCookie()) || parseCookie().tokenIndex > accessLib.length - 2){
        document.cookie = "tokenIndex=0";
    }
    else{
        document.cookie = "tokenIndex=" + (Number(parseCookie().tokenIndex) + 1);
    }
    window.location.assign("https://api.digikey.com/v1/oauth2/authorize?response_type=code&client_id=" + accessLib[parseCookie().tokenIndex][0] + "&redirect_uri=" + encodeURIComponent(redirectURI))

} //The auth process begins. To do this, the code redirects the window to a certain digikey url, encoded with both the client id and the redirect url. (The next step occurs in the onload event)

window.addEventListener('load', function(){
    applyCookies();
    populateOutput();

    if(window.location.href.includes("code=") && (parseCookie().websiteState == "go" || parseCookie().websiteState == "restarting")){ //Makes sure that the page was intentionally refreshed to complete the auth process - if not, the user must have manually refreshed it

        if(parseCookie().websiteState == "restarting"){
            outputLib = JSON.parse(window.name);
        }

        document.cookie = "websiteState=running"

        beginAuth(startSearching);  //Grabbing the returned auth code, which is encoded in the end of this website's url, and sending it to the beginAuth function
    }
    if(window.location.href.includes("code=") && parseCookie().websiteState == "authOnly"){
        document.cookie = "websiteState=running"
        beginAuth();
    }

}); //After the first step of auth, digikey redirects back to this site. An auth code used in authentication is encoded in the url.

function beginAuth(callback){

    clientId = accessLib[parseCookie().tokenIndex][0]; //Cycles through an array of client ids and client secrets. This way, when the 120/minute search limit is reached, a different client id and client secret are used.
    clientSecret = accessLib[parseCookie().tokenIndex][1];
    let loc = window.location.href;
    let authCode = loc.substring(loc.indexOf("code=") + 5, loc.indexOf("&scope="));

    let url = "https://api.digikey.com/v1/oauth2/token";

    let xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            authComplete(xhr, callback);
        }
    };

    let data = "code=" + authCode + "&client_id=" + clientId.toString() +
        "&client_secret=" + clientSecret.toString() + "&grant_type=authorization_code&" +
        "redirect_uri=" + encodeURIComponent(redirectURI)
    xhr.send(data);

} //With the auth code acquired previously, beginAuth uses a POST request to get back an access token that is used in every request sent to digikey. In the AuthComplete function, this access token is received and stored locally.

function authComplete(xhr, callback) {

    let response = JSON.parse(xhr.responseText);

    if("ErrorMessage" in response){
        throw(" - " + response.ErrorMessage + " (" + response.ErrorDetails + ")")
    }
    else{
        accessToken = response.access_token;
        console.log("client id: " + clientId + "\n\nrefresh timeout: " + response.refresh_token_expires_in + "\naccess timeout: " + response.expires_in + "\nrefresh token: " + response.refresh_token + "\naccess token: " + response.access_token);
    }

    if(parseCookie().websiteState == "running" && typeof callback == "function"){
        callback();
    }

} //After AuthComplete gets the access token back from digikey, it calls the callback function, which is startSearching().

function authOnly(){
    document.cookie = "websiteState=authOnly";
    getAuthCode();
} //Function which will authenticate through digikey to get an access token, but will not initiate any searches.


function startSearching() {
    if (parseCookie().burstLimit > 119) {
        restart();
    } //If there have been 120 searches with a given access token, the website will "restart" and use a new set of client ids and client secrets to get a new access token.

    document.body.style.cursor='wait';


        for (let i = 0; i < (allValues.length * voltageLib.length); i++) {//Begins searching for every possible voltage rating and capacitance for a given package and temperature coefficient
            if (outputLib[i] == undefined || !("Products" in outputLib[i])) { //Makes sure outputLib[i] has either not been defined, or that it doesn't have a "Products" array in it (the "Products" array is returned from each digikey search.)

                outputLib[i] =
                    {
                        Name: allSciValues[i % allValues.length] + " ???% " + voltageLib[Math.floor(i / allValues.length)][0] + " " + document.getElementById('package').value + " " + document.getElementById('di').value,
                        Value: allSciValues[i % allValues.length],
                        Voltage: voltageLib[Math.floor(i / allValues.length)][0]
                    }; //Each capacitance value is an item in the outputLib array. This array stores each piece of information that is displayed in the output text box.

                if ("burstLimit" in parseCookie()) {
                    if (parseCookie().burstLimit > 119) {
                        document.cookie = "websiteState=restart"; //This signals that the website needs to restart and get a new auth code with a different production app. It doesn't initiate it in case there are other POST requests that haven't been returned yet.
                        console.log("No more POST! Awaiting restart.");
                    } else {
                        document.cookie = "burstLimit=" + (parseCookie().burstLimit + 1); //Adds one to the burstLimit count for each new search.
                        partFinder3000(i)
                    }
                } else {
                    document.cookie = "burstLimit=0";
                }
            }
        }

} //Checks which items need to be searched for and initiates a search

function partFinder3000(index){

    postState[index] = "POST";

    let url = "https://api.digikey.com/Search/v3/Products/Keyword";

    let xhr = new XMLHttpRequest();
    xhr.open("POST", url); //This POST request is the actual digikey search

    xhr.setRequestHeader("accept", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
    xhr.setRequestHeader("X-DIGIKEY-Client-Id", clientId);
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.send(JSON.stringify({

        "Keywords": "capacitor",
        "RecordCount": 50,
        "RecordStartPosition": 0,
        "Filters": {
            "ParametricFilters": [
                { //Category: caps
                    "ParameterId": -3,
                    "ValueId": "3"
                },
                { //Product status: active
                    "ParameterId": 1989,
                    "ValueId": "0"
                },
                { //Temp coefficient: dependent on user choice
                    "ParameterId": 17,
                    "ValueId": document.getElementById("di").options[document.getElementById("di").selectedIndex].getAttribute("valueid")
                },
                { //Package size: dependent on user choice
                    "ParameterId": 16,
                    "ValueId": document.getElementById("package").options[document.getElementById("package").selectedIndex].getAttribute("valueid")
                },
                { //Voltage rating: dependent on user choice
                    "ParameterId": 14,
                    "ValueId": voltageLib[Math.floor(index / allValues.length)][1]
                },
                { //Capacitance: each capacitance value in the allSciValuesMod is searched for
                    "ParameterId": 2049,
                    "ValueId": allSciValuesMod[index % allValues.length]
                }
            ]
        },
        "Sort": {
            "SortOption": "SortByQuantityAvailable",
            "Direction": "Descending",
            "SortParameterId": 0
        },
        "ExcludeMarketPlaceProducts": true
    })); //The protocol for this JSON structure is defined in the digikey API documentation


    xhr.onreadystatechange = function(){
        if (xhr.readyState === 4) {
            outputLib[index] = {...outputLib[index], ...JSON.parse(xhr.responseText)} //Adds the information received from digikey into the proper outputLib object. Now all the information is stored in one combined object

            if("Products" in outputLib[index]){ //This ensures that if there was an error with receiving information from a part, the code will not attempt to process that part's data

                let ItemReport = {
                    "ItemReport": outputLib[index].Products.length //Item report is the number of products available for a certain capacitance
                }
                outputLib[index] = {...outputLib[index], ...ItemReport}

                if(outputLib[index].Products.length > 0){ //Inserting a tolerance and temp coefficient value into the name of the capacitor. The values are taken from each tolerance option(?)
                    let toleranceOptions = {"Options": parseTolerance(index)};
                    outputLib[index] = {...outputLib[index], ...toleranceOptions}
                }
            }
            else{
                console.log("hold on partner, we got a problem with " + index);
            }
            populateOutput();

            postState[index] = "RETURNED"
            checkForRestart(); //Whenever a search is complete, this is called to check if a website restart is pending (this is needed when the burstLimit exceeds 120)
        }
    };
}; //Searches for a certain Package + Temp Rating + Voltage Rating + Capacitance

function checkForRestart(){
    if(parseCookie().websiteState == "restart" && !postState.includes("POST")){
        restart();
    } //Checks if a website restart is pending (occurs after 120 searches). Checks postState to see if there are any searches which haven't been returned from digikey. If there are any, it will not initiate a restart.
    else if(!postState.includes("POST")){
        document.body.style.cursor='auto';
        console.log("them searches are rounded up!");
        copyToClipboard();
    } //If there are no "POST" strings left in the postState array, all searches have been completed. Whatever data is displayed in the output textbox is copied to the clipboard.
}

function restart(){
    console.log("looks like everyone's done. restarting NOW")
    document.cookie = "websiteState=restarting";
    document.cookie = "burstLimit=0";
    window.name = JSON.stringify(outputLib);
    getAuthCode();
} //Sets cookies to indicate a website restart. Saves the current data retrieved from digikey into the window.name, just so that when the website restarts, all of the data already retrieved is not lost.


/*
HOW PARSETOLERANCE WORKS


When looking for capacitors, each search includes these parameters:

Package (0201, 0402)
Temp Rating (C0G/NP0, X5R, X7R)
Voltage Rating (6.3V, 10V, 16V, 25V, 50V)
Capacitance

However, it doesn't search for each possible tolerance, the combination of the parameters above yields results with only a handful of tolerances.
So, when the results for the search comes back, there are often results which have different tolerances.
parseTolerance first divides the different tolerances up into different "options".

Each "option" contains part choices, a digikey detailed description taken from one of the part choices, the option's tolerance, and the option's physical height.
The "option" also contains up to 3 sorted part choices. These are choices prioritized by manufacturer. The manufacturers in the preferredMans array are prioritized, and their order in the list indicates their desirability (where the item at index 0 is the best).

Once each tolerance is put into an option, each option is put into the "Options" array. Each outputLib item is an object containing information returned from the digikey search, and so
the "Options" array is added to the corresponding object.

parseTolerance is called for every item in outputLib.
 */
function parseTolerance(index){
    let options = [];
    for(let productIndex = 0; productIndex < outputLib[index].Products.length; productIndex ++){
        let product = outputLib[index].Products[productIndex];

        let currentTolerance = product.Parameters.find(item => item.ParameterId === 3).Value
        currentTolerance = currentTolerance.substring(currentTolerance.indexOf("±") + 1); //Formats "±0.1pF" as "0.1pF"

        let currentHeight = "";
        if(product.Parameters.find(item => item.ParameterId === 1501) != undefined) {
            currentHeight = product.Parameters.find(item => item.ParameterId === 1501).Value
        }
        currentHeight = currentHeight.substring(currentHeight.indexOf("(") + 1, currentHeight.indexOf(")")); //Formats "0.013" (0.33mm)" as "0.33mm"


        if(options.find(item => item.Tolerance === currentTolerance) === undefined){ //Groups same tolerances together. If there is a tolerance not already found in the option list, a new (tolerance) option is created. If a part choice has a tolerance already existing in an option, it is added to the option.
            options.push(
                {
                    "Tolerance": currentTolerance,
                    "DetailedDescription" : product.DetailedDescription,
                    "PartChoices": [{
                        "Manufacturer": product.Manufacturer.Value,
                        "PartNumber": product.DigiKeyPartNumber,
                        "ManPartNumber": product.ManufacturerPartNumber,
                        "Height": currentHeight,
                    }]
                }
            );
        }
        else{
            options.find(item => item.Tolerance == currentTolerance).PartChoices.push(
                {
                    "Manufacturer": product.Manufacturer.Value,
                    "PartNumber": product.DigiKeyPartNumber,
                    "ManPartNumber": product.ManufacturerPartNumber,
                    "Height": currentHeight,
                }
            )
        }
    } //Creates an "Options" array within an outputLib entry. Fills this with all of the products, sorted by tolerance.



    for(let optionIndex = 0; optionIndex < options.length; optionIndex++){

        let option = options[optionIndex];
        let sortedPartChoices = [];
        let usedMans = [];
        let man = 0;
        while(man < preferredMans.length && sortedPartChoices.length < 3){

            let preferredChoice = option.PartChoices.find(item => item.Manufacturer === preferredMans[man])
            if(preferredChoice !== undefined){
                sortedPartChoices.push(preferredChoice);
                usedMans.push(preferredMans[man]);
            }
            man++;

        } //First picks out any parts from a preferred manufacturer to put in the sorted part choices. It will not push 2 parts from the same manufacturer.

        let choiceIndex = 0;
        while(choiceIndex < option.PartChoices.length && sortedPartChoices.length < 3){

            let choice = option.PartChoices[choiceIndex];
            if(!usedMans.includes(choice.Manufacturer) && !sortedPartChoices.includes(choice)){
                usedMans.push(choice.Manufacturer);
                sortedPartChoices.push(choice);
            }
            choiceIndex++;

        } //If sorted part choices doesn't have 3 options, this fills it up with parts from non-preferred manufacturers. It also will not push 2 parts from the same manufacturer.

        let maxHeight = sortedPartChoices[0].Height;

        for(let sortedChoiceIndex = 0; sortedChoiceIndex < sortedPartChoices.length; sortedChoiceIndex++){

            let sortedPart = sortedPartChoices[sortedChoiceIndex];

            if(sortedPart.Height.substring(0, sortedPart.Height.indexOf("mm")) > maxHeight.substring(0, maxHeight.indexOf("mm"))){
                maxHeight = sortedPart.Height;
            }

        } //Finds what the max height is from the sorted part choices, and uses this as the defined height.


        let minTemp;
        let maxTemp;
        let tempCo = document.getElementById("di").value;
        if(tempCo == "C0G/NP0" || tempCo == "X7R"){
            minTemp = "-55°C";
            maxTemp = "125°C";
        }
        else if(document.getElementById("di").value == "X5R"){
            minTemp = "-55°C";
            maxTemp = "85°C";
        }
        else{
            minTemp = "???";
            maxTemp = "???";
        } //Determines min and max operating temperature from the temperature coefficient.

        options[optionIndex] = {...option, ...{"SortedPartChoices": sortedPartChoices, "Height": maxHeight, "MinTemp": minTemp, "MaxTemp": maxTemp}};
    } //Picks 3 part choices from the available products. Picks first by the order of manufacturers in preferredMans, and then simply by serial position since it is assumed to not matter. Only will pick one from each manufacturer (even if there are only 3 unsorted part choices, and all are from the same man)

    return options;
}

function populateOutput(){
    let realIndex = 0;
    let textOutput = "";
    let toggleIndex = document.getElementById("toggleIndex").checked //More info on this below - reference the "toggleIndex" event handler
    let toggleReal = document.getElementById("toggleReal").checked //More info on this below - reference the "toggleReal" event handler

    for(let index = 0; index < (allSciValues.length * voltageLib.length); index ++) {
        if (outputLib[index] != undefined && "Options" in outputLib[index]) {
            for (let optionIndex = 0; optionIndex < outputLib[index].Options.length; optionIndex++) { //Loops through each option in each part

                if (document.getElementById("info").value == "All") {
                    if (textOutput != "") {
                        textOutput += "\n";
                    }

                    textOutput += document.getElementById("package").value + "\t";
                    textOutput += outputLib[index].Name.replace("???%", outputLib[index].Options[optionIndex].Tolerance) + "\t";
                    textOutput += outputLib[index].Options[optionIndex].DetailedDescription + "\t";
                    textOutput += document.getElementById("di").value + "\t";
                    textOutput += outputLib[index].Options[optionIndex].Tolerance + "\t";
                    textOutput += outputLib[index].Options[optionIndex].MinTemp + "\t";
                    textOutput += outputLib[index].Options[optionIndex].MaxTemp + "\t";
                    textOutput += outputLib[index].Voltage + "\t";;
                    textOutput += outputLib[index].Options[optionIndex].Height + "\t";
                    textOutput += outputLib[index].Value + "\t";
                    for(let i = 0; i < 3; i++){
                        if(outputLib[index].Options[optionIndex].SortedPartChoices[i] != undefined){
                            textOutput += outputLib[index].Options[optionIndex].SortedPartChoices[i].ManPartNumber + "\t";
                        }
                        else{
                            textOutput += "\t";
                        }
                    }
                    for(let i = 0; i < 3; i++){
                        if(outputLib[index].Options[optionIndex].SortedPartChoices[i] != undefined){
                            textOutput += outputLib[index].Options[optionIndex].SortedPartChoices[i].Manufacturer + "\t";
                        }
                        else{
                            textOutput += "\t";
                        }
                    }
                    textOutput += String(realIndex).padStart(4, "0");


                }
                else {

                    if (textOutput != "") {
                        textOutput += "\n";
                    }
                    if (toggleIndex && optionIndex == 0) {
                        textOutput += "(" + allSciValues[index % allSciValues.length] + ") ";
                    }
                    if (toggleIndex && optionIndex > 0) {
                        for (let i = 0; i < ("(" + allSciValues[index % allSciValues.length] + ") ").length; i++) {
                            textOutput += " ";
                        }
                    }


                    let info = document.getElementById("info").value

                    if (info == "Value" || info == "ItemReport") {
                        textOutput += outputLib[index][info];
                    } else if (info == "Name") {
                        textOutput += outputLib[index].Name.replace("???%", outputLib[index].Options[optionIndex].Tolerance)
                    } else if (info.includes("DigiKeyPartNumber")) {
                        if (outputLib[index].Options[optionIndex].SortedPartChoices[info.substring(info.length - 1) - 1] != undefined) {
                            textOutput += outputLib[index].Options[optionIndex].SortedPartChoices[info.substring(info.length - 1) - 1].PartNumber; //Extracts array index (DigiKeyPartNumber1 -> 0)
                        } else {
                            textOutput += "undefined";
                        }
                    } else {
                        textOutput += outputLib[index].Options[optionIndex][info];
                    }
                }

                realIndex ++;

            }
        }
        else
            {
                if (!toggleReal) {
                    if (textOutput != "") {
                        textOutput += "\n";
                    }
                    if (toggleIndex) {
                        textOutput += "(" + allSciValues[index % allSciValues.length] + ") ";
                    }
                    textOutput += "undefined";
                }
            }

    }

    document.getElementById("output").value = textOutput;

} //Fills in the output text box with whatever the desired information is. If the information is set to "All," it outputs all the information needed to import parts into Altium. It is tab - seperated for each column and newline seperated for each row.
// If "All" is selected, the function will not put an index before each line when the Index checkbox is clicked. This is because doing so would mess with the output when it is copied and pasted into an excel spreadsheet.

function copyToClipboard(){

    let copyText = document.getElementById("output");
    copyText.select();
    navigator.clipboard.writeText(copyText.value);

} //Copies output text to clipboard



function sciList() {

    let output = []
    for(let i = 0; i < allValues.length; i++){
        output.push(sciNot(allValues[i]));
    }

    return output;

}

function sciListMod() {

    let output = []
    for(let i = 0; i < allValues.length; i++){
        output.push(sciNotMod(allValues[i]));
    }

    return output;

}

function sciNot(input){ //NOTE - the input should be in pF. This works for values 1 pF <= value < 100 μF.
    if(1 <= input && input < 10){
        return(Number(input).toFixed(1) + "pF");
    }
    else if(10 <= input && input < 1000){
        return(Number(input).toFixed(0) + "pF");
    }
    else if(1000 <= input && input < 10000){
        return(Number(input / 1000).toFixed(1) + "nF");
    }
    else if(10000 <= input && input < 1000000){
        return(Number(input / 1000).toFixed(0) + "nF");
    }
    else if(1000000 <= input && input < 10000000){
        return(Number(input / 1000000).toFixed(1) + "μF");
    }
    else if(10000000 <= input && input < 100000000){
        return(Number(input / 1000000).toFixed(0) + "μF");
    }
    else{
        return null;
    }
}

function sciNotMod(input){ //NOTE - the input should be in pF. This works for values 1 pF <= value < 100 μF. The 'mod' indicates that this outputs only in pF and μF, skipping over nF.
    if(1 <= input && input < 10){
        return(Number(input).toFixed(1) + "pF");
    }
    else if(10 <= input && input <= 10000){
        return(Number(input).toFixed(0) + "pF");
    }
    else if(10000 < input && input < 100000){
        return(Number(input / 1000000).toFixed(3) + "μF");
    }
    else if(100000 <= input && input < 1000000){
        return(Number(input / 1000000).toFixed(2) + "μF");
    }
    else if(1000000 <= input && input < 10000000){
        return(Number(input / 1000000).toFixed(1) + "μF");
    }
    else if(10000000 <= input && input < 100000000){
        return(Number(input / 1000000).toFixed(0) + "μF");
    }
    else{
        return null;
    }
} //These functions generate the standard capacitor values in scientific notation. The sciListMod and sciNotMod use a modified scientific notation that digikey uses, and so these are needed for the actual searching process.



document.getElementById("toggleIndex").addEventListener("click", function(){
    formatCookies("toggleIndex");
    populateOutput();
}); //Toggles the display of an index next to each item in the output text box

document.getElementById("toggleReal").addEventListener("click", function(){
    formatCookies("toggleReal");
    populateOutput();
}); //Toggles the display of values with no real part choices. Also shows all different tolerance options for a given part(?)

document.getElementById("info").addEventListener("change", function(){
    formatCookies("info");
    populateOutput();
    copyToClipboard();
}); //Called whenever the "Information to get" dropdown is changed. Both updates the values in the output text box and updates the page's cookie.