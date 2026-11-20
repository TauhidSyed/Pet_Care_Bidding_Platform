// J: I did not expect having to do server-side in 3 days.
/*- Setting Everything Up -*/  
const express = require('express');
const app = express();
const hostname = '127.0.0.1';
const port = 3000;
const path = require('path');
/* 
    J: This is a built-in module in Node.js to handle file and directory paths:
    It works by joining path segments into a valid path and inserts the correct
    separator for the OS (since windows does \X\Y\Z and others do /X/Y/Z).
*/
/*----- Reading Data ------*/
app.use(express.urlencoded());
// J: This reads form data (application/x-www-form-urlencoded) into req.body.

app.use(express.json());
// J: Reads request body, turns the string into a json, assigns it to req.body.
// J: Ill probably use this later so Ill just add it now.
/*----------- Authentication stuff -----------*/


/*----- Sending Files -----*/
app.use(express.static(path.join(__dirname, 'public')));
/* 
    J: This line effectively handles all the files that will be requested.
    So first, "__dirname" is a global variable from Node.js, which holds the
    absolute path of the directory thats currently executing the JS file.
    Eg: Since I have C:\Users\Whatever\Pet_Care_Bidding_Platform\server.js  
    then the __dirname will be C:\Users\Whatever\Pet_Care_Bidding_Platform.  
    So for path.join(__dirname, 'public'), "path" I explained earlier, the
    "join" part adds them together so join(__dirname, 'public') just adds
    public to the __dirname we had earlier, so it'll become:
    C:\Users\Whatever\Pet_Care_Bidding_Platform\public

    Then we have express.static, it needs a root directory so we use the stuff 
    from above for that, then it whenever theres a request, it takes the URL 
    path of the request, matches it to the thing being requested in the root 
    directory (not really but this explanation is long enough), and then sends
    it to the browser.
    The good thing is it only allows requests inside the root directory we 
    sent, so anything outside of \public wont be allowed so this code here and 
    anything else won't be shown.
    Remember though, it only calls next() if it fails to find a file that was
    requested, so since we are only doing links to html files we have, anything
    below this won't be seen. Which is fine if theres no errors

    app.use we learnt in class.
*/ 

//app.use(authentication, express.static(path.join(__dirname, 'private')));
// J: Authentications here for the rest of the files. Need to define a function called "authentication" for this to work. 

/*------- Error 404 -------*/
app.use((req, res) => res.status(404).send('Not found'));
// J: This basically handles anything that gets to this point and 

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});